/**
 * High-level composite PureTasks App Functions (`fn_*`).
 *
 * Each function collapses 3–15 atomic tool round-trips into one auditable call
 * using PureTasks' own deterministic board model (`taskModel`, `agentReadTools`,
 * `agentWriteTools`) and routing every mutation atomically through
 * `context.applyStoreUpdate`.
 */
import {
  defineAppFunction,
  type AppFunctionDefinition,
} from '@purescience/platform-ui/bridge/appFunctions'
import {
  AgentTasksToolError,
  getTasksAgentContext,
  listTaskActivityAgentSnapshot,
  toTaskRow,
} from '../lib/agentReadTools'
import {
  createTaskAgentMutation,
  createTaskChecklistAgentMutation,
  createTaskCommentAgentMutation,
  updateTaskAgentMutation,
} from '../lib/agentWriteTools'
import {
  blocks,
  checklistProgress,
  columnAtLimit,
  columnLoad,
  createActivity,
  dueBucket,
  isReviewColumn,
  nextRepeatDue,
  openBlockers,
  subtasksOf,
  taskColumnsForStore,
  taskStatusLabel,
  type TaskResourceLinkInput,
} from '../lib/taskModel'
import type {
  SuiteTask,
  TaskColumn,
  TaskPriority,
  TaskRepeat,
  TasksStore,
} from '../types'
import type { TasksAgentToolContext } from './context'
import {
  optionalBoolean,
  optionalNumber,
  optionalNumberOrNull,
  optionalObjectArray,
  optionalString,
  optionalStringArray,
  optionalStringOrNull,
  requiredString,
} from './handlers/agentArgs'
import { taskChangeSummary } from './handlers/replies'

const DAY_MS = 86_400_000

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
}

const VALID_PRIORITIES = new Set<string>(['low', 'normal', 'high'])

const RESOURCE_LINK_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['file', 'writer', 'book', 'chapter', 'chat-message', 'agent-run'],
    },
    title: { type: 'string' },
    path: { type: 'string', description: 'Filesystem path if file/package.' },
    appSlug: { type: 'string' },
    resourceId: { type: 'string' },
  },
} as const

function parseReferenceDate(raw: string | undefined): Date {
  if (!raw) return new Date()
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`)
    if (Number.isFinite(parsed.getTime())) return parsed
  }
  const parsed = new Date(trimmed)
  if (!Number.isFinite(parsed.getTime())) {
    throw new AgentTasksToolError(
      `Invalid date "${raw}". Expected YYYY-MM-DD or an ISO date string.`,
    )
  }
  return parsed
}

function daysBetween(isoOrDate: string, reference: Date): number {
  const ts = Date.parse(isoOrDate)
  if (!Number.isFinite(ts)) return 0
  return Math.max(0, Math.floor((reference.getTime() - ts) / DAY_MS))
}

function doneStatusSet(columns: TaskColumn[]): Set<string> {
  return new Set(columns.filter(column => column.done).map(column => column.id))
}

function reviewStatusSet(columns: TaskColumn[]): Set<string> {
  return new Set(
    columns.filter(column => isReviewColumn(column)).map(column => column.id),
  )
}

function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function parsePriority(
  raw: string | undefined,
  field = 'priority',
): TaskPriority | undefined {
  if (raw === undefined) return undefined
  if (!VALID_PRIORITIES.has(raw)) {
    throw new AgentTasksToolError(`${field} must be low, normal, or high.`)
  }
  return raw as TaskPriority
}

function compareUrgent(a: SuiteTask, b: SuiteTask): number {
  const dueCmp = (a.dueAt ?? '9999-99-99').localeCompare(b.dueAt ?? '9999-99-99')
  if (dueCmp !== 0) return dueCmp
  const prioCmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (prioCmp !== 0) return prioCmp
  return a.order - b.order
}

function briefingRow(
  task: SuiteTask,
  columns: TaskColumn[],
  store: TasksStore,
  refDate: Date,
) {
  const progress = checklistProgress(task)
  const blockers = openBlockers(task, store)
  return {
    ...toTaskRow(task),
    columnLabel: taskStatusLabel(columns, task.status),
    ageDays: daysBetween(task.updatedAt, refDate),
    blockedByCount: blockers.length,
    checklistDone: progress.done,
    checklistTotal: progress.total,
    subtaskCount: subtasksOf(task, store).length,
    estimateHours: task.estimateHours,
    loggedHours: task.loggedHours,
  }
}

// ── 1. fn_boardBriefingAndSchedule ───────────────────────────────────────────

const fn_boardBriefingAndSchedule = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_boardBriefingAndSchedule',
  category: 'briefing',
  risk: 'read',
  requiresApproval: false,
  replaces: [
    'getTasksContext',
    'listTaskColumns',
    'listTasks',
    'listTaskActivity',
    'listTaskProjects',
  ],
  description:
    'Build a single-call board briefing for the open PureTasks board: active project context, column loads with WIP limits, overdue/today/tomorrow/this-week schedule buckets, human review queue with wait ages, blocked cards with their unmet blockers, stale in-progress cards, active shell missions, and recent activity.',
  inputSchema: {
    type: 'object',
    properties: {
      asOfDate: {
        type: 'string',
        description:
          'Optional reference date (YYYY-MM-DD or ISO) for schedule buckets and ages. Defaults to today.',
      },
      staleDays: {
        type: 'integer',
        minimum: 1,
        maximum: 180,
        description:
          'Days without update before a non-inbox, non-done card counts as stale. Defaults to 5.',
      },
      recentActivityLimit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description:
          'Maximum recent activity entries to include. Defaults to 10.',
      },
      ownerName: {
        type: 'string',
        description:
          'Optional case-insensitive owner filter to scope the briefing to one person.',
      },
    },
  },
  run: async (ctx, args) => {
    const refDate = parseReferenceDate(optionalString(args, 'asOfDate'))
    const staleDays = clampInt(optionalNumber(args, 'staleDays'), 5, 1, 180)
    const activityLimit = clampInt(
      optionalNumber(args, 'recentActivityLimit'),
      10,
      1,
      50,
    )
    const ownerFilter = optionalString(args, 'ownerName')?.toLowerCase()

    const store = ctx.store
    const project = ctx.activeProject ?? store.projects[0] ?? null
    const columns = taskColumnsForStore(store)
    const doneStatuses = doneStatusSet(columns)
    const reviewStatuses = reviewStatusSet(columns)

    const context = getTasksAgentContext({
      storePath: ctx.board.path,
      boardStatus: ctx.board.status,
      store,
      activeProject: project,
      selectedTaskId: ctx.selectedTask?.id ?? null,
      filters: ctx.filters,
      viewMode: ctx.viewMode,
    })

    let knownBoardCount: number | null = null
    if (typeof ctx.board.list === 'function') {
      try {
        knownBoardCount = (await ctx.board.list()).length
      } catch {
        knownBoardCount = null
      }
    }

    const activeTasks = store.tasks
      .filter(task => (!project || task.projectId === project.id) && !task.archivedAt)
      .filter(task =>
        ownerFilter
          ? (task.ownerName ?? '').trim().toLowerCase() === ownerFilter
          : true,
      )

    const openTasks = activeTasks.filter(task => !doneStatuses.has(task.status))
    const doneTasks = activeTasks.filter(task => doneStatuses.has(task.status))

    const overdue: ReturnType<typeof briefingRow>[] = []
    const dueToday: ReturnType<typeof briefingRow>[] = []
    const dueTomorrow: ReturnType<typeof briefingRow>[] = []
    const dueThisWeek: ReturnType<typeof briefingRow>[] = []
    let noDueDateCount = 0

    for (const task of [...openTasks].sort(compareUrgent)) {
      const bucket = dueBucket(task, refDate)
      if (bucket === 'overdue') overdue.push(briefingRow(task, columns, store, refDate))
      else if (bucket === 'today') dueToday.push(briefingRow(task, columns, store, refDate))
      else if (bucket === 'tomorrow') dueTomorrow.push(briefingRow(task, columns, store, refDate))
      else if (bucket === 'week') dueThisWeek.push(briefingRow(task, columns, store, refDate))
      else if (bucket === 'none') noDueDateCount += 1
    }

    const reviewQueue = openTasks
      .filter(task => reviewStatuses.has(task.status))
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
      .map(task => briefingRow(task, columns, store, refDate))

    const blockedCards = openTasks
      .map(task => ({ task, blockers: openBlockers(task, store) }))
      .filter(entry => entry.blockers.length > 0)
      .sort((a, b) => compareUrgent(a.task, b.task))
      .map(({ task, blockers }) => ({
        ...briefingRow(task, columns, store, refDate),
        waitingOn: blockers.map(blocker => ({
          id: blocker.id,
          title: blocker.title,
          status: blocker.status,
          ownerName: blocker.ownerName,
        })),
      }))

    const staleCards = openTasks
      .filter(
        task =>
          task.status !== 'inbox' &&
          daysBetween(task.updatedAt, refDate) >= staleDays,
      )
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
      .map(task => briefingRow(task, columns, store, refDate))

    const activeMissions = activeTasks.flatMap(task =>
      task.missions
        .filter(
          mission =>
            !mission.phase ||
            ['planning', 'planned', 'running', 'needsYou', 'failed'].includes(
              mission.phase,
            ),
        )
        .map(mission => ({
          taskId: task.id,
          taskTitle: task.title,
          missionId: mission.id,
          missionTitle: mission.title,
          phase: mission.phase ?? 'unknown',
          createdAt: mission.createdAt,
        })),
    )

    const columnSummary = columns.map(column => {
      const count = activeTasks.filter(task => task.status === column.id).length
      const totalBoardColumnCount = columnLoad(store, column.id)
      return {
        id: column.id,
        label: column.label,
        taskCount: count,
        done: Boolean(column.done),
        review: isReviewColumn(column),
        hidden: Boolean(column.hidden),
        collapsed: Boolean(column.collapsed),
        wipLimit: column.wipLimit ?? null,
        atWipLimit: column.wipLimit
          ? totalBoardColumnCount >= column.wipLimit
          : false,
      }
    })

    const recentActivity = listTaskActivityAgentSnapshot({
      store,
      limit: activityLimit,
    })

    const boardName = project?.name ?? 'Untitled board'
    const summary =
      `${boardName}: ${openTasks.length} open (${doneTasks.length} done), ` +
      `${overdue.length} overdue, ${dueToday.length} due today, ` +
      `${reviewQueue.length} in review, ${blockedCards.length} blocked, ${staleCards.length} stale.`

    return {
      summary,
      mutated: false,
      data: {
        context,
        knownBoardCount,
        asOfDate: refDate.toISOString().slice(0, 10),
        ownerFilter: ownerFilter ?? null,
        totals: {
          open: openTasks.length,
          done: doneTasks.length,
          archived: store.tasks.filter(
            task => (!project || task.projectId === project.id) && Boolean(task.archivedAt),
          ).length,
          overdue: overdue.length,
          dueToday: dueToday.length,
          dueTomorrow: dueTomorrow.length,
          dueThisWeek: dueThisWeek.length,
          noDueDate: noDueDateCount,
          inReview: reviewQueue.length,
          blocked: blockedCards.length,
          stale: staleCards.length,
        },
        columns: columnSummary,
        schedule: {
          overdue,
          dueToday,
          dueTomorrow,
          dueThisWeek,
        },
        reviewQueue,
        blockedCards,
        staleCards,
        activeMissions,
        recentActivity,
      },
    }
  },
})

// ── 2. fn_workloadAndHealthAudit ─────────────────────────────────────────────

const fn_workloadAndHealthAudit = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_workloadAndHealthAudit',
  category: 'analytics',
  risk: 'read',
  requiresApproval: false,
  replaces: ['listTaskColumns', 'listTasks', 'getTask'],
  description:
    'Audit workload balance, WIP limits, time estimates vs logged hours, dependency bottlenecks, and board hygiene across the open PureTasks board. Returns per-owner workload, WIP pressure, label counts, top blocker cards, concrete hygiene findings, and a 0-100 board health score.',
  inputSchema: {
    type: 'object',
    properties: {
      asOfDate: {
        type: 'string',
        description:
          'Optional reference date (YYYY-MM-DD or ISO) for overdue checks. Defaults to today.',
      },
      status: {
        type: 'string',
        description:
          'Optional column/status id to scope the audit to one column.',
      },
      label: {
        type: 'string',
        description: 'Optional case-insensitive label filter.',
      },
    },
  },
  run: async (ctx, args) => {
    const refDate = parseReferenceDate(optionalString(args, 'asOfDate'))
    const statusFilter = optionalString(args, 'status')
    const labelFilter = optionalString(args, 'label')?.toLowerCase()

    const store = ctx.store
    const project = ctx.activeProject ?? store.projects[0] ?? null
    const columns = taskColumnsForStore(store)
    const doneStatuses = doneStatusSet(columns)

    if (statusFilter && !columns.some(column => column.id === statusFilter)) {
      throw new AgentTasksToolError(`Unknown column: ${statusFilter}`)
    }

    const activeTasks = store.tasks
      .filter(task => (!project || task.projectId === project.id) && !task.archivedAt)
      .filter(task => (!statusFilter ? true : task.status === statusFilter))
      .filter(task =>
        labelFilter
          ? task.labels.some(label => label.toLowerCase() === labelFilter)
          : true,
      )

    const openTasks = activeTasks.filter(task => !doneStatuses.has(task.status))

    // Per-owner workload aggregation
    const ownerBuckets = new Map<
      string,
      {
        ownerName: string
        openCount: number
        highPriorityCount: number
        overdueCount: number
        blockedCount: number
        estimateHours: number
        loggedHours: number
      }
    >()

    for (const task of openTasks) {
      const key = task.ownerName?.trim() || 'Unassigned'
      const current = ownerBuckets.get(key) ?? {
        ownerName: key,
        openCount: 0,
        highPriorityCount: 0,
        overdueCount: 0,
        blockedCount: 0,
        estimateHours: 0,
        loggedHours: 0,
      }
      current.openCount += 1
      if (task.priority === 'high') current.highPriorityCount += 1
      if (dueBucket(task, refDate) === 'overdue') current.overdueCount += 1
      if (openBlockers(task, store).length > 0) current.blockedCount += 1
      current.estimateHours += task.estimateHours ?? 0
      current.loggedHours += task.loggedHours ?? 0
      ownerBuckets.set(key, current)
    }

    const ownerWorkload = [...ownerBuckets.values()]
      .map(entry => ({
        ...entry,
        estimateHours: Math.round(entry.estimateHours * 100) / 100,
        loggedHours: Math.round(entry.loggedHours * 100) / 100,
        remainingHours:
          Math.round(Math.max(0, entry.estimateHours - entry.loggedHours) * 100) /
          100,
      }))
      .sort((a, b) => b.openCount - a.openCount || a.ownerName.localeCompare(b.ownerName))

    // Label breakdown
    const labelStats = new Map<string, { label: string; open: number; done: number }>()
    for (const task of activeTasks) {
      const isDone = doneStatuses.has(task.status)
      for (const rawLabel of task.labels) {
        const label = rawLabel.trim()
        if (!label) continue
        const entry = labelStats.get(label) ?? { label, open: 0, done: 0 }
        if (isDone) entry.done += 1
        else entry.open += 1
        labelStats.set(label, entry)
      }
    }

    // Column WIP audit
    const wipAudit = columns.map(column => {
      const count = columnLoad(store, column.id)
      const wipLimit = column.wipLimit ?? null
      const utilizationPct = wipLimit ? Math.round((count / wipLimit) * 100) : null
      return {
        id: column.id,
        label: column.label,
        taskCount: count,
        wipLimit,
        utilizationPct,
        status: !wipLimit
          ? 'unbounded'
          : count > wipLimit
            ? 'over-limit'
            : count === wipLimit
              ? 'at-limit'
              : 'healthy',
      }
    })

    // Dependency bottlenecks (open cards that block other open cards)
    const bottlenecks = openTasks
      .map(task => {
        const dependents = blocks(task, store).filter(
          candidate => !doneStatuses.has(candidate.status) && !candidate.archivedAt,
        )
        return { task, dependents }
      })
      .filter(entry => entry.dependents.length > 0)
      .sort((a, b) => b.dependents.length - a.dependents.length)
      .map(({ task, dependents }) => ({
        taskId: task.id,
        title: task.title,
        status: task.status,
        ownerName: task.ownerName ?? null,
        priority: task.priority,
        blocksOpenCount: dependents.length,
        blockedTaskIds: dependents.map(item => item.id),
      }))

    // Hygiene checks
    const taskIdSet = new Set(store.tasks.map(task => task.id))
    const unassignedHighPriority = openTasks
      .filter(task => task.priority === 'high' && !task.ownerName?.trim())
      .map(toTaskRow)
    const overdueInInbox = openTasks
      .filter(
        task => task.status === 'inbox' && dueBucket(task, refDate) === 'overdue',
      )
      .map(toTaskRow)
    const missingDueHighPriority = openTasks
      .filter(task => task.priority === 'high' && !task.dueAt)
      .map(toTaskRow)
    const danglingDependencies = openTasks
      .map(task => ({
        taskId: task.id,
        title: task.title,
        missingBlockerIds: task.blockedBy.filter(id => !taskIdSet.has(id)),
      }))
      .filter(entry => entry.missingBlockerIds.length > 0)

    const findings: Array<{
      severity: 'high' | 'medium' | 'low'
      code: string
      message: string
      count: number
    }> = []

    const overOrAtWip = wipAudit.filter(
      col => col.status === 'over-limit' || col.status === 'at-limit',
    )
    if (overOrAtWip.length > 0) {
      findings.push({
        severity: 'high',
        code: 'wip-limit-pressure',
        message: `${overOrAtWip.length} column(s) are at or over WIP limit: ${overOrAtWip.map(c => `${c.label} (${c.taskCount}/${c.wipLimit})`).join(', ')}.`,
        count: overOrAtWip.length,
      })
    }
    if (overdueInInbox.length > 0) {
      findings.push({
        severity: 'high',
        code: 'overdue-in-inbox',
        message: `${overdueInInbox.length} overdue card(s) have never left Inbox.`,
        count: overdueInInbox.length,
      })
    }
    if (unassignedHighPriority.length > 0) {
      findings.push({
        severity: 'medium',
        code: 'unassigned-high-priority',
        message: `${unassignedHighPriority.length} high-priority open card(s) have no owner assigned.`,
        count: unassignedHighPriority.length,
      })
    }
    if (missingDueHighPriority.length > 0) {
      findings.push({
        severity: 'low',
        code: 'high-priority-no-due-date',
        message: `${missingDueHighPriority.length} high-priority open card(s) have no due date.`,
        count: missingDueHighPriority.length,
      })
    }
    if (bottlenecks.length > 0) {
      findings.push({
        severity: 'medium',
        code: 'dependency-bottlenecks',
        message: `${bottlenecks.length} open card(s) are actively blocking downstream work (top blocker: "${bottlenecks[0].title}" blocking ${bottlenecks[0].blocksOpenCount}).`,
        count: bottlenecks.length,
      })
    }
    if (danglingDependencies.length > 0) {
      findings.push({
        severity: 'low',
        code: 'dangling-dependencies',
        message: `${danglingDependencies.length} card(s) reference missing blocker ids.`,
        count: danglingDependencies.length,
      })
    }

    const penalty = findings.reduce(
      (sum, item) =>
        sum +
        (item.severity === 'high'
          ? 15
          : item.severity === 'medium'
            ? 8
            : 4),
      0,
    )
    const healthScore = Math.max(0, Math.min(100, 100 - penalty))

    const totalEstimatedHours =
      Math.round(
        openTasks.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0) * 100,
      ) / 100
    const totalLoggedHours =
      Math.round(
        openTasks.reduce((sum, task) => sum + (task.loggedHours ?? 0), 0) * 100,
      ) / 100

    return {
      summary: `Board health ${healthScore}/100 across ${openTasks.length} open cards (${ownerWorkload.length} owner bucket(s), ${bottlenecks.length} blocker(s), ${findings.length} finding(s)).`,
      mutated: false,
      data: {
        projectName: project?.name ?? 'Untitled board',
        healthScore,
        scope: {
          status: statusFilter ?? 'all',
          label: labelFilter ?? null,
          openCards: openTasks.length,
          totalActiveCards: activeTasks.length,
        },
        hours: {
          totalEstimatedHours,
          totalLoggedHours,
          estimatedCardCount: openTasks.filter(t => t.estimateHours !== undefined)
            .length,
        },
        ownerWorkload,
        wipAudit,
        labels: [...labelStats.values()].sort(
          (a, b) => b.open + b.done - (a.open + a.done),
        ),
        bottlenecks,
        hygiene: {
          unassignedHighPriority,
          overdueInInbox,
          missingDueHighPriority,
          danglingDependencies,
        },
        findings,
      },
    }
  },
})

// ── 3. fn_getTaskDossier ─────────────────────────────────────────────────────

const fn_getTaskDossier = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_getTaskDossier',
  category: 'tasks',
  risk: 'read',
  requiresApproval: false,
  replaces: ['getTask', 'listTasks', 'listTaskColumns', 'listTaskActivity'],
  description:
    'Assemble a complete 360-degree dossier for one task card on the open board (defaults to the currently selected task): full card fields, notes, checklist completion breakdown, parent card, subtasks, open and resolved blockers, downstream blocked cards, links, missions, and recent task-scoped activity.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description:
          'Optional task id from listTasks. Defaults to the currently selected task.',
      },
      activityLimit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description:
          'Maximum task-scoped activity entries to return. Defaults to 20.',
      },
      asOfDate: {
        type: 'string',
        description:
          'Optional reference date (YYYY-MM-DD or ISO) for dueBucket calculation. Defaults to today.',
      },
    },
  },
  run: async (ctx, args) => {
    const taskId = optionalString(args, 'taskId') ?? ctx.selectedTask?.id
    if (!taskId) {
      throw new AgentTasksToolError(
        'No task is selected. Pass taskId — ids come from listTasks.',
      )
    }
    const store = ctx.store
    const task = store.tasks.find(candidate => candidate.id === taskId)
    if (!task) {
      throw new AgentTasksToolError(`Unknown task: ${taskId}`)
    }

    const refDate = parseReferenceDate(optionalString(args, 'asOfDate'))
    const activityLimit = clampInt(
      optionalNumber(args, 'activityLimit'),
      20,
      1,
      100,
    )
    const columns = taskColumnsForStore(store)
    const column = columns.find(c => c.id === task.status) ?? null
    const doneStatuses = doneStatusSet(columns)

    const parent = task.parentId
      ? store.tasks.find(candidate => candidate.id === task.parentId) ?? null
      : null

    const subtasks = subtasksOf(task, store).map(child => {
      const progress = checklistProgress(child)
      return {
        ...toTaskRow(child),
        columnLabel: taskStatusLabel(columns, child.status),
        done: doneStatuses.has(child.status),
        checklistDone: progress.done,
        checklistTotal: progress.total,
      }
    })

    const blockerRecords = task.blockedBy.map(id => {
      const found = store.tasks.find(candidate => candidate.id === id)
      if (!found) {
        return {
          id,
          found: false as const,
          resolved: false,
        }
      }
      const resolved = doneStatuses.has(found.status) || Boolean(found.archivedAt)
      return {
        id: found.id,
        found: true as const,
        title: found.title,
        status: found.status,
        columnLabel: taskStatusLabel(columns, found.status),
        ownerName: found.ownerName ?? null,
        dueAt: found.dueAt ?? null,
        resolved,
      }
    })

    const activeBlockers = blockerRecords.filter(b => !b.resolved)
    const resolvedBlockers = blockerRecords.filter(b => b.resolved)

    const downstream = blocks(task, store).map(dep => ({
      ...toTaskRow(dep),
      columnLabel: taskStatusLabel(columns, dep.status),
      done: doneStatuses.has(dep.status),
    }))

    const overallChecklist = checklistProgress(task)
    const checklists = task.checklists.map(checklist => {
      const done = checklist.items.filter(item => item.done).length
      const total = checklist.items.length
      return {
        id: checklist.id,
        title: checklist.title,
        done,
        total,
        completionPct: total > 0 ? Math.round((done / total) * 100) : 100,
        items: checklist.items,
      }
    })

    const activity = listTaskActivityAgentSnapshot({
      store,
      taskId: task.id,
      limit: activityLimit,
    })

    const summary =
      `Dossier for "${task.title}" (${column?.label ?? task.status}, ${task.priority}): ` +
      `${overallChecklist.done}/${overallChecklist.total} checklist items, ` +
      `${subtasks.length} subtask(s), ${activeBlockers.length} open blocker(s), ${downstream.length} dependent(s).`

    return {
      summary,
      mutated: false,
      data: {
        task,
        column: column
          ? {
              id: column.id,
              label: column.label,
              done: Boolean(column.done),
              review: isReviewColumn(column),
            }
          : { id: task.status, label: task.status, done: false, review: false },
        schedule: {
          dueAt: task.dueAt ?? null,
          dueBucket: dueBucket(task, refDate),
          repeat: task.repeat ?? null,
          nextRepeatDue: nextRepeatDue(task.dueAt, task.repeat, refDate) ?? null,
          remindAt: task.remindAt ?? null,
        },
        checklistSummary: {
          done: overallChecklist.done,
          total: overallChecklist.total,
          completionPct:
            overallChecklist.total > 0
              ? Math.round((overallChecklist.done / overallChecklist.total) * 100)
              : null,
          checklists,
        },
        parent: parent
          ? {
              id: parent.id,
              title: parent.title,
              status: parent.status,
              columnLabel: taskStatusLabel(columns, parent.status),
            }
          : null,
        subtasks,
        dependencies: {
          isBlocked: activeBlockers.length > 0,
          openBlockers: activeBlockers,
          resolvedBlockers,
          blocks: downstream,
        },
        activity,
      },
    }
  },
})

// ── 4. fn_captureStructuredTask ──────────────────────────────────────────────

const fn_captureStructuredTask = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_captureStructuredTask',
  category: 'tasks',
  risk: 'write',
  requiresApproval: true,
  replaces: [
    'createTask',
    'createTaskChecklist',
    'createTaskChecklistItem',
    'addTaskResourceLink',
    'createTaskComment',
  ],
  description:
    'Capture a complete structured work unit on the open board in one atomic write: creates the main task card (with notes, labels, priority, owner, due date, estimates, repeat, reminder, blockers, and resource links) plus optional checklists, child subtasks linked via parentId, and an initial comment. Call getTasksContext first.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Main task title.' },
      projectId: { type: 'string' },
      status: { type: 'string', description: 'Column id; defaults to inbox.' },
      notes: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] },
      ownerName: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' } },
      dueAt: { type: 'string', description: 'YYYY-MM-DD or ISO date.' },
      links: { type: 'array', items: RESOURCE_LINK_SCHEMA },
      blockedBy: { type: 'array', items: { type: 'string' } },
      parentId: { type: ['string', 'null'] },
      estimateHours: { type: ['number', 'null'], minimum: 0 },
      repeat: {
        type: ['string', 'null'],
        enum: ['none', 'daily', 'weekly', 'monthly', null],
      },
      remindAt: { type: ['string', 'null'] },
      checklists: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
          required: ['title'],
        },
      },
      subtasks: {
        type: 'array',
        description: 'Child cards linked via parentId to the new card.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'string' },
            notes: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            ownerName: { type: 'string' },
            dueAt: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
            estimateHours: { type: 'number', minimum: 0 },
          },
          required: ['title'],
        },
      },
      initialComment: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          authorName: { type: 'string' },
        },
        required: ['text'],
      },
    },
    required: ['title'],
  },
  run: async (ctx, args) => {
    const title = requiredString(args, 'title')
    const projectId = optionalString(args, 'projectId')
    const status = optionalString(args, 'status')
    const notes = optionalString(args, 'notes')
    const priority = parsePriority(optionalString(args, 'priority'))
    const ownerName = optionalString(args, 'ownerName')
    const labels = optionalStringArray(args, 'labels')
    const dueAt = optionalString(args, 'dueAt')
    const links = optionalObjectArray<TaskResourceLinkInput>(args, 'links')
    const blockedBy = optionalStringArray(args, 'blockedBy')
    const parentId = optionalStringOrNull(args, 'parentId')
    const estimateHours = optionalNumberOrNull(args, 'estimateHours')
    const repeat = optionalStringOrNull(args, 'repeat') as
      | TaskRepeat
      | null
      | undefined
    const remindAt = optionalStringOrNull(args, 'remindAt')

    const rawChecklists = optionalObjectArray<Record<string, unknown>>(
      args,
      'checklists',
    )
    const rawSubtasks = optionalObjectArray<Record<string, unknown>>(
      args,
      'subtasks',
    )
    const rawComment = args.initialComment
    if (
      rawComment !== undefined &&
      (!rawComment || typeof rawComment !== 'object' || Array.isArray(rawComment))
    ) {
      throw new AgentTasksToolError('initialComment must be an object.')
    }

    const checklistsSpec = (rawChecklists ?? []).map((entry, idx) => {
      const checklistTitle = optionalString(entry, 'title')
      if (!checklistTitle) {
        throw new AgentTasksToolError(`checklists[${idx}].title is required.`)
      }
      const items = optionalStringArray(entry, 'items') ?? []
      return { title: checklistTitle, items }
    })

    const subtasksSpec = (rawSubtasks ?? []).map((entry, idx) => {
      const subTitle = optionalString(entry, 'title')
      if (!subTitle) {
        throw new AgentTasksToolError(`subtasks[${idx}].title is required.`)
      }
      return {
        title: subTitle,
        status: optionalString(entry, 'status'),
        notes: optionalString(entry, 'notes'),
        priority: parsePriority(
          optionalString(entry, 'priority'),
          `subtasks[${idx}].priority`,
        ),
        ownerName: optionalString(entry, 'ownerName'),
        dueAt: optionalString(entry, 'dueAt'),
        labels: optionalStringArray(entry, 'labels'),
        estimateHours: optionalNumber(entry, 'estimateHours'),
      }
    })

    const commentSpec = rawComment
      ? {
          text: requiredString(
            rawComment as Record<string, unknown>,
            'text',
          ),
          authorName: optionalString(
            rawComment as Record<string, unknown>,
            'authorName',
          ),
        }
      : null

    let mainTask: SuiteTask | undefined
    const createdSubtasks: SuiteTask[] = []
    let createdChecklistCount = 0
    let createdChecklistItemCount = 0
    let createdCommentId: string | null = null

    await ctx.applyStoreUpdate(store => {
      const activeProjectId =
        ctx.activeProject?.id ?? store.projects[0]?.id ?? ''
      let next = store

      const createdMain = createTaskAgentMutation(
        next,
        {
          title,
          projectId,
          status,
          notes,
          priority,
          ownerName,
          labels,
          dueAt,
          links,
          blockedBy,
          parentId,
          estimateHours,
          repeat,
          remindAt,
        },
        activeProjectId,
      )
      next = createdMain.store
      const mainId = createdMain.result.task.id

      for (const spec of checklistsSpec) {
        const res = createTaskChecklistAgentMutation(next, {
          taskId: mainId,
          title: spec.title,
          items: spec.items,
        })
        next = res.store
        createdChecklistCount += 1
        createdChecklistItemCount += res.result.checklist.items.length
      }

      if (commentSpec) {
        const res = createTaskCommentAgentMutation(next, {
          taskId: mainId,
          text: commentSpec.text,
          authorName: commentSpec.authorName,
        })
        next = res.store
        createdCommentId = res.result.comment.id
      }

      for (const sub of subtasksSpec) {
        const subRes = createTaskAgentMutation(
          next,
          {
            title: sub.title,
            projectId,
            status: sub.status ?? status,
            notes: sub.notes,
            priority: sub.priority,
            ownerName: sub.ownerName,
            dueAt: sub.dueAt,
            labels: sub.labels,
            estimateHours: sub.estimateHours,
            parentId: mainId,
          },
          activeProjectId,
        )
        next = subRes.store
        createdSubtasks.push(subRes.result.task)
      }

      mainTask = next.tasks.find(candidate => candidate.id === mainId)!
      return next
    })

    const summaryParts = [
      `Captured "${mainTask!.title}" in ${mainTask!.status}`,
    ]
    if (createdChecklistCount > 0) {
      summaryParts.push(
        `${createdChecklistCount} checklist(s) (${createdChecklistItemCount} item(s))`,
      )
    }
    if (createdSubtasks.length > 0) {
      summaryParts.push(`${createdSubtasks.length} subtask(s)`)
    }
    if (createdCommentId) {
      summaryParts.push('1 comment')
    }

    return {
      summary: `${summaryParts.join(', ')}.`,
      mutated: true,
      data: {
        task: taskChangeSummary(mainTask!),
        checklistsCreated: createdChecklistCount,
        checklistItemsCreated: createdChecklistItemCount,
        commentId: createdCommentId,
        subtasks: createdSubtasks.map(taskChangeSummary),
      },
    }
  },
})

// ── 5. fn_batchTriageTasks ───────────────────────────────────────────────────

interface NormalizedTriageItem {
  taskId: string
  status?: string
  priority?: TaskPriority
  ownerName?: string
  dueAt?: string
  labels?: string[]
  addLabels?: string[]
  removeLabels?: string[]
  estimateHours?: number | null
  loggedHours?: number | null
  repeat?: TaskRepeat | null
  remindAt?: string | null
  comment?: string
  commentAuthor?: string
  force?: boolean
}

const fn_batchTriageTasks = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_batchTriageTasks',
  category: 'triage',
  risk: 'write',
  requiresApproval: true,
  replaces: ['updateTask', 'createTaskComment', 'applyTaskBoardPatch'],
  description:
    'Triage, reschedule, reprioritize, reassign, relabel (with non-destructive addLabels/removeLabels), or move multiple task cards in one atomic transaction with optional dryRun preview and triage comments. Enforces column WIP limits unless force is true on an entry.',
  inputSchema: {
    type: 'object',
    properties: {
      dryRun: {
        type: 'boolean',
        description: 'Preview diffs and WIP checks without saving.',
      },
      reason: { type: 'string', description: 'Optional triage activity note.' },
      updates: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            status: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            ownerName: { type: 'string' },
            dueAt: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
            addLabels: { type: 'array', items: { type: 'string' } },
            removeLabels: { type: 'array', items: { type: 'string' } },
            estimateHours: { type: ['number', 'null'], minimum: 0 },
            loggedHours: { type: ['number', 'null'], minimum: 0 },
            repeat: {
              type: ['string', 'null'],
              enum: ['none', 'daily', 'weekly', 'monthly', null],
            },
            remindAt: { type: ['string', 'null'] },
            comment: { type: 'string' },
            commentAuthor: { type: 'string' },
            force: { type: 'boolean' },
          },
          required: ['taskId'],
        },
      },
    },
    required: ['updates'],
  },
  run: async (ctx, args) => {
    const dryRun = optionalBoolean(args, 'dryRun') ?? false
    const reason = optionalString(args, 'reason')
    const rawUpdates = optionalObjectArray<Record<string, unknown>>(
      args,
      'updates',
    )
    if (!rawUpdates || rawUpdates.length === 0) {
      throw new AgentTasksToolError(
        'updates must be a non-empty array of triage update objects.',
      )
    }

    const updates: NormalizedTriageItem[] = rawUpdates.map((entry, idx) => {
      const taskId = optionalString(entry, 'taskId')
      if (!taskId) {
        throw new AgentTasksToolError(`updates[${idx}].taskId is required.`)
      }
      return {
        taskId,
        status: optionalString(entry, 'status'),
        priority: parsePriority(
          optionalString(entry, 'priority'),
          `updates[${idx}].priority`,
        ),
        ownerName:
          typeof entry.ownerName === 'string' ? entry.ownerName : undefined,
        dueAt: typeof entry.dueAt === 'string' ? entry.dueAt : undefined,
        labels: optionalStringArray(entry, 'labels'),
        addLabels: optionalStringArray(entry, 'addLabels'),
        removeLabels: optionalStringArray(entry, 'removeLabels'),
        estimateHours: optionalNumberOrNull(entry, 'estimateHours'),
        loggedHours: optionalNumberOrNull(entry, 'loggedHours'),
        repeat: optionalStringOrNull(entry, 'repeat') as
          | TaskRepeat
          | null
          | undefined,
        remindAt: optionalStringOrNull(entry, 'remindAt'),
        comment: optionalString(entry, 'comment'),
        commentAuthor: optionalString(entry, 'commentAuthor'),
        force: optionalBoolean(entry, 'force'),
      }
    })

    interface TriageChangeRecord {
      taskId: string
      title: string
      changedFields: string[]
      before: {
        status: string
        priority: TaskPriority
        ownerName: string | null
        dueAt: string | null
        labels: string[]
      }
      after: ReturnType<typeof taskChangeSummary>
      commentAdded: boolean
    }

    const runBatch = (
      store: TasksStore,
    ): { nextStore: TasksStore; changes: TriageChangeRecord[] } => {
      let next = store
      const changes: TriageChangeRecord[] = []

      for (const item of updates) {
        const before = next.tasks.find(candidate => candidate.id === item.taskId)
        if (!before) {
          throw new AgentTasksToolError(`Unknown task: ${item.taskId}`)
        }

        let mergedLabels = item.labels
        if (
          mergedLabels === undefined &&
          (item.addLabels?.length || item.removeLabels?.length)
        ) {
          const removeSet = new Set(
            (item.removeLabels ?? []).map(label => label.toLowerCase()),
          )
          const kept = before.labels.filter(
            label => !removeSet.has(label.toLowerCase()),
          )
          const seen = new Set(kept.map(label => label.toLowerCase()))
          for (const added of item.addLabels ?? []) {
            if (!seen.has(added.toLowerCase())) {
              kept.push(added)
              seen.add(added.toLowerCase())
            }
          }
          mergedLabels = kept
        }

        const updateRes = updateTaskAgentMutation(next, {
          taskId: item.taskId,
          status: item.status,
          priority: item.priority,
          ...(item.ownerName !== undefined
            ? { ownerName: item.ownerName }
            : {}),
          ...(item.dueAt !== undefined ? { dueAt: item.dueAt } : {}),
          labels: mergedLabels,
          estimateHours: item.estimateHours,
          loggedHours: item.loggedHours,
          repeat: item.repeat,
          remindAt: item.remindAt,
          force: item.force,
        })
        next = updateRes.store

        let commentAdded = false
        if (item.comment) {
          const commentRes = createTaskCommentAgentMutation(next, {
            taskId: item.taskId,
            text: item.comment,
            authorName: item.commentAuthor,
          })
          next = commentRes.store
          commentAdded = true
        }

        const after = next.tasks.find(candidate => candidate.id === item.taskId)!
        const changedFields: string[] = []
        if (before.status !== after.status) changedFields.push('status')
        if (before.priority !== after.priority) changedFields.push('priority')
        if ((before.ownerName ?? '') !== (after.ownerName ?? '')) {
          changedFields.push('ownerName')
        }
        if ((before.dueAt ?? '') !== (after.dueAt ?? '')) {
          changedFields.push('dueAt')
        }
        if (JSON.stringify(before.labels) !== JSON.stringify(after.labels)) {
          changedFields.push('labels')
        }
        if (before.estimateHours !== after.estimateHours) {
          changedFields.push('estimateHours')
        }
        if (before.loggedHours !== after.loggedHours) {
          changedFields.push('loggedHours')
        }
        if (before.repeat !== after.repeat) changedFields.push('repeat')
        if (before.remindAt !== after.remindAt) changedFields.push('remindAt')
        if (commentAdded) changedFields.push('comment')

        changes.push({
          taskId: after.id,
          title: after.title,
          changedFields,
          before: {
            status: before.status,
            priority: before.priority,
            ownerName: before.ownerName ?? null,
            dueAt: before.dueAt ?? null,
            labels: before.labels,
          },
          after: taskChangeSummary(after),
          commentAdded,
        })
      }

      if (reason && changes.length > 0) {
        const at = new Date().toISOString()
        const entries = [...new Set(changes.map(c => c.taskId))].map(taskId =>
          createActivity(taskId, 'agent', `Batch triage: ${reason}`, at),
        )
        next = {
          ...next,
          activity: [...entries, ...next.activity].slice(0, 400),
        }
      }

      return { nextStore: next, changes }
    }

    let finalChanges: TriageChangeRecord[] = []
    let columnLoads: Array<{
      id: string
      label: string
      taskCount: number
      wipLimit: number | null
      atWipLimit: boolean
    }> = []

    const summarizeColumns = (store: TasksStore) =>
      taskColumnsForStore(store).map(column => ({
        id: column.id,
        label: column.label,
        taskCount: columnLoad(store, column.id),
        wipLimit: column.wipLimit ?? null,
        atWipLimit: columnAtLimit(store, column.id),
      }))

    if (dryRun) {
      const preview = runBatch(ctx.store)
      finalChanges = preview.changes
      columnLoads = summarizeColumns(preview.nextStore)
    } else {
      await ctx.applyStoreUpdate(store => {
        const applied = runBatch(store)
        finalChanges = applied.changes
        columnLoads = summarizeColumns(applied.nextStore)
        return applied.nextStore
      })
    }

    const touchedCount = finalChanges.filter(
      c => c.changedFields.length > 0,
    ).length

    return {
      summary: `${dryRun ? 'Dry-run preview:' : 'Triaged'} ${finalChanges.length} task(s) (${touchedCount} with field/comment changes)${reason ? ` — ${reason}` : ''}.`,
      mutated: !dryRun && touchedCount > 0,
      data: {
        dryRun,
        reason: reason ?? null,
        processedCount: finalChanges.length,
        changedCount: touchedCount,
        changes: finalChanges,
        columnLoads,
      },
    }
  },
})

// ── 6. fn_periodReviewDigest ─────────────────────────────────────────────────

const fn_periodReviewDigest = defineAppFunction<TasksAgentToolContext>({
  name: 'fn_periodReviewDigest',
  category: 'review',
  risk: 'read',
  requiresApproval: false,
  replaces: ['getTasksContext', 'listTaskColumns', 'listTasks', 'listTaskActivity'],
  description:
    'Compile a periodic review and completion digest over the open PureTasks board (default 7-day lookback, including recently archived done cards): completed work with hours logged, newly added cards and net throughput, repeating task schedule, upcoming deadlines, carryover in-progress items, and activity volume.',
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'integer',
        minimum: 1,
        maximum: 90,
        description:
          'Lookback window in days for completed and created cards. Defaults to 7.',
      },
      upcomingDays: {
        type: 'integer',
        minimum: 1,
        maximum: 60,
        description:
          'Lookahead window in days for upcoming open deadlines. Defaults to 7.',
      },
      asOfDate: {
        type: 'string',
        description:
          'Optional reference date (YYYY-MM-DD or ISO). Defaults to today.',
      },
      ownerName: {
        type: 'string',
        description:
          'Optional case-insensitive owner filter to scope the digest.',
      },
    },
  },
  run: async (ctx, args) => {
    const days = clampInt(optionalNumber(args, 'days'), 7, 1, 90)
    const upcomingDays = clampInt(
      optionalNumber(args, 'upcomingDays'),
      7,
      1,
      60,
    )
    const refDate = parseReferenceDate(optionalString(args, 'asOfDate'))
    const ownerFilter = optionalString(args, 'ownerName')?.toLowerCase()

    const store = ctx.store
    const project = ctx.activeProject ?? store.projects[0] ?? null
    const columns = taskColumnsForStore(store)
    const doneStatuses = doneStatusSet(columns)

    const refMs = refDate.getTime()
    const windowStartMs = refMs - days * DAY_MS
    const upcomingEndMs = refMs + upcomingDays * DAY_MS

    const projectTasks = store.tasks
      .filter(task => (!project || task.projectId === project.id))
      .filter(task =>
        ownerFilter
          ? (task.ownerName ?? '').trim().toLowerCase() === ownerFilter
          : true,
      )

    // Completed in window (includes archived done cards whose completedAt falls in range!)
    const completedInWindow = projectTasks
      .filter(task => {
        if (!doneStatuses.has(task.status)) return false
        const doneAt = Date.parse(task.completedAt ?? task.updatedAt)
        return Number.isFinite(doneAt) && doneAt >= windowStartMs && doneAt <= refMs
      })
      .sort(
        (a, b) =>
          Date.parse(b.completedAt ?? b.updatedAt) -
          Date.parse(a.completedAt ?? a.updatedAt),
      )
      .map(task => ({
        ...toTaskRow(task),
        completedAt: task.completedAt ?? task.updatedAt,
        archived: Boolean(task.archivedAt),
        estimateHours: task.estimateHours ?? null,
        loggedHours: task.loggedHours ?? null,
      }))

    const createdInWindow = projectTasks
      .filter(task => {
        const createdAt = Date.parse(task.createdAt)
        return (
          Number.isFinite(createdAt) &&
          createdAt >= windowStartMs &&
          createdAt <= refMs
        )
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(toTaskRow)

    const openTasks = projectTasks.filter(
      task => !doneStatuses.has(task.status) && !task.archivedAt,
    )

    const upcomingDeadlines = openTasks
      .filter(task => {
        if (!task.dueAt) return false
        const dueMs = Date.parse(`${task.dueAt.slice(0, 10)}T12:00:00`)
        return (
          Number.isFinite(dueMs) &&
          dueMs >= refMs - DAY_MS &&
          dueMs <= upcomingEndMs
        )
      })
      .sort(compareUrgent)
      .map(task => ({
        ...toTaskRow(task),
        columnLabel: taskStatusLabel(columns, task.status),
        dueBucket: dueBucket(task, refDate),
      }))

    const carryoverInProgress = openTasks
      .filter(task => {
        if (task.status === 'inbox') return false
        const createdAt = Date.parse(task.createdAt)
        return Number.isFinite(createdAt) && createdAt < windowStartMs
      })
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map(task => ({
        ...briefingRow(task, columns, store, refDate),
        createdDaysAgo: daysBetween(task.createdAt, refDate),
      }))

    const repeatingTasks = projectTasks
      .filter(task => !task.archivedAt && task.repeat && task.repeat !== 'none')
      .map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        repeat: task.repeat!,
        dueAt: task.dueAt ?? null,
        nextRepeatDue: nextRepeatDue(task.dueAt, task.repeat, refDate) ?? null,
        ownerName: task.ownerName ?? null,
      }))

    const windowActivity = store.activity.filter(entry => {
      const atMs = Date.parse(entry.at)
      return Number.isFinite(atMs) && atMs >= windowStartMs && atMs <= refMs
    })

    const activityByType: Record<string, number> = {}
    for (const entry of windowActivity) {
      activityByType[entry.type] = (activityByType[entry.type] ?? 0) + 1
    }

    const completedLoggedHours =
      Math.round(
        completedInWindow.reduce((sum, item) => sum + (item.loggedHours ?? 0), 0) *
          100,
      ) / 100
    const completedEstimatedHours =
      Math.round(
        completedInWindow.reduce(
          (sum, item) => sum + (item.estimateHours ?? 0),
          0,
        ) * 100,
      ) / 100

    const netThroughput = completedInWindow.length - createdInWindow.length
    const boardName = project?.name ?? 'Untitled board'

    return {
      summary:
        `${boardName} (${days}d review): ${completedInWindow.length} completed, ` +
        `${createdInWindow.length} created (net ${netThroughput >= 0 ? '+' : ''}${netThroughput}), ` +
        `${upcomingDeadlines.length} upcoming deadline(s) in next ${upcomingDays}d, ` +
        `${carryoverInProgress.length} carryover in-progress.`,
      mutated: false,
      data: {
        projectName: boardName,
        window: {
          days,
          upcomingDays,
          fromDate: new Date(windowStartMs).toISOString().slice(0, 10),
          asOfDate: refDate.toISOString().slice(0, 10),
          ownerFilter: ownerFilter ?? null,
        },
        metrics: {
          completedCount: completedInWindow.length,
          createdCount: createdInWindow.length,
          netThroughput,
          openCount: openTasks.length,
          completedLoggedHours,
          completedEstimatedHours,
          activityCount: windowActivity.length,
        },
        completedInWindow,
        createdInWindow,
        upcomingDeadlines,
        carryoverInProgress,
        repeatingTasks,
        activityByType,
      },
    }
  },
})

export const PURETASKS_FUNCTIONS: readonly AppFunctionDefinition<TasksAgentToolContext>[] =
  [
    fn_boardBriefingAndSchedule,
    fn_workloadAndHealthAudit,
    fn_getTaskDossier,
    fn_captureStructuredTask,
    fn_batchTriageTasks,
    fn_periodReviewDigest,
  ]
