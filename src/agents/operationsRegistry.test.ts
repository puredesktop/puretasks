import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FILTERS,
  createActivity,
  createTask,
  moveTaskStatus,
  starterBoardStore,
  updateTaskDetails,
} from '../lib/taskModel'
import type { SuiteTask, TasksStore } from '../types'
import { PURETASKS_ATOMIC_TOOL_SCHEMAS } from './atomicToolSchemas'
import {
  AgentTasksToolError,
  EXPOSED_TOOL_NAMES,
  PURETASKS_AGENT_TOOL_NAMES,
  PURETASKS_ALL_ATOMIC_TOOL_NAMES,
  PURETASKS_CORE_TOOL_NAMES,
  PURETASKS_EXTENDED_TOOL_NAMES,
  PURETASKS_FUNCTION_NAMES,
  PURETASKS_META_TOOL_NAMES,
  type TasksAgentToolContext,
} from './catalog'
import type { TasksAgentBoardApi } from './context'
import {
  PURETASKS_OPERATIONS_REGISTRY,
  buildPureTasksHandlers,
} from './operationsRegistry'

const invoke = (shortName: string, args: Record<string, unknown> = {}) => ({
  toolCallId: `tc_${shortName}`,
  shortName,
  arguments: args,
})

const RELEASE_VERBS = new Set([
  'send',
  'sends',
  'sending',
  'merge',
  'merges',
  'merging',
  'publish',
  'publishes',
  'publishing',
  'deposit',
  'deposits',
  'depositing',
  'deploy',
  'deploys',
  'deploying',
  'post',
  'posts',
  'posting',
])

function makeRichStore(): {
  store: TasksStore
  ids: {
    projectId: string
    overdueInbox: string
    todayDoing: string
    blockedReview: string
    blockerDoing: string
    subtask1: string
    doneRecent: string
    doneArchived: string
    staleDoing: string
    repeatingTask: string
  }
} {
  const store = starterBoardStore('Q4 Launch', '2026-11-01T09:00:00.000Z')
  const projectId = store.projects[0].id
  store.columns = [
    { id: 'inbox', label: 'Inbox' },
    { id: 'doing', label: 'Doing', wipLimit: 3 },
    { id: 'review', label: 'Review', review: true },
    { id: 'done', label: 'Done', done: true },
  ]

  const overdueInbox = updateTaskDetails(
    createTask(projectId, 'Approve launch budget', 'inbox', '2026-11-01T09:00:00.000Z'),
    {
      priority: 'high',
      dueAt: '2026-11-18',
      labels: ['finance', 'launch'],
      estimateHours: 2,
    },
    '2026-11-18T10:00:00.000Z',
  )

  const blockerDoing = updateTaskDetails(
    createTask(projectId, 'Finalize API contract', 'doing', '2026-11-05T09:00:00.000Z'),
    {
      priority: 'high',
      ownerName: 'Ada',
      dueAt: '2026-11-23',
      labels: ['backend', 'launch'],
      estimateHours: 6,
      loggedHours: 3,
      notes: 'OpenAPI v3 spec for checkout endpoints.',
      checklists: [
        {
          id: 'chk_1',
          title: 'Spec checks',
          createdAt: '2026-11-05T09:00:00.000Z',
          updatedAt: '2026-11-20T09:00:00.000Z',
          items: [
            {
              id: 'ci_1',
              text: 'Auth headers',
              done: true,
              createdAt: '2026-11-05T09:00:00.000Z',
              updatedAt: '2026-11-20T09:00:00.000Z',
            },
            {
              id: 'ci_2',
              text: 'Error codes',
              done: false,
              createdAt: '2026-11-05T09:00:00.000Z',
              updatedAt: '2026-11-20T09:00:00.000Z',
            },
          ],
        },
      ],
      missions: [
        {
          id: 'mission_1',
          title: 'Draft API contract',
          createdAt: '2026-11-21T09:00:00.000Z',
          phase: 'running',
        },
      ],
    },
    '2026-11-22T12:00:00.000Z',
  )

  const subtask1 = updateTaskDetails(
    createTask(projectId, 'Write schema examples', 'doing', '2026-11-19T09:00:00.000Z'),
    {
      parentId: blockerDoing.id,
      ownerName: 'Ada',
      priority: 'normal',
      dueAt: '2026-11-24',
      estimateHours: 2,
    },
    '2026-11-22T15:00:00.000Z',
  )

  const staleDoing = updateTaskDetails(
    createTask(projectId, 'Audit telemetry pipeline', 'doing', '2026-11-02T09:00:00.000Z'),
    {
      ownerName: 'Grace',
      priority: 'normal',
      dueAt: '2026-11-27',
      labels: ['ops'],
      estimateHours: 4,
      loggedHours: 1,
      blockedBy: ['task_missing_ghost'],
    },
    '2026-11-10T09:00:00.000Z',
  )

  const blockedReview = updateTaskDetails(
    createTask(projectId, 'Ship checkout UI', 'review', '2026-11-12T09:00:00.000Z'),
    {
      ownerName: 'Linus',
      priority: 'high',
      dueAt: '2026-11-26',
      labels: ['frontend', 'launch'],
      blockedBy: [blockerDoing.id],
      estimateHours: 5,
    },
    '2026-11-15T09:00:00.000Z',
  )

  const doneRecent = moveTaskStatus(
    updateTaskDetails(
      createTask(projectId, 'Provision staging DB', 'inbox', '2026-11-17T09:00:00.000Z'),
      {
        ownerName: 'Grace',
        labels: ['ops'],
        estimateHours: 3,
        loggedHours: 2.5,
      },
      '2026-11-19T14:00:00.000Z',
    ),
    'done',
    '2026-11-20T14:00:00.000Z',
    undefined,
    true,
  )

  const doneArchived = updateTaskDetails(
    moveTaskStatus(
      updateTaskDetails(
        createTask(projectId, 'Configure CI secrets', 'inbox', '2026-11-16T09:00:00.000Z'),
        {
          ownerName: 'Ada',
          estimateHours: 1,
          loggedHours: 1,
        },
        '2026-11-18T10:00:00.000Z',
      ),
      'done',
      '2026-11-19T10:00:00.000Z',
      undefined,
      true,
    ),
    { archivedAt: '2026-11-21T10:00:00.000Z' },
    '2026-11-21T10:00:00.000Z',
  )

  const repeatingTask = updateTaskDetails(
    createTask(projectId, 'Weekly launch standup notes', 'inbox', '2026-11-21T09:00:00.000Z'),
    {
      ownerName: 'Ada',
      dueAt: '2026-11-24',
      repeat: 'weekly',
    },
    '2026-11-22T09:00:00.000Z',
  )

  store.tasks = [
    overdueInbox,
    blockerDoing,
    subtask1,
    staleDoing,
    blockedReview,
    doneRecent,
    doneArchived,
    repeatingTask,
  ]

  store.activity = [
    createActivity(blockerDoing.id, 'update', 'Updated spec checklist', '2026-11-22T12:00:00.000Z'),
    createActivity(doneRecent.id, 'move', 'Moved to Done', '2026-11-20T14:00:00.000Z'),
    createActivity(overdueInbox.id, 'create', 'Created task', '2026-11-18T10:00:00.000Z'),
  ]

  return {
    store,
    ids: {
      projectId,
      overdueInbox: overdueInbox.id,
      todayDoing: blockerDoing.id,
      blockedReview: blockedReview.id,
      blockerDoing: blockerDoing.id,
      subtask1: subtask1.id,
      doneRecent: doneRecent.id,
      doneArchived: doneArchived.id,
      staleDoing: staleDoing.id,
      repeatingTask: repeatingTask.id,
    },
  }
}

function makeFixture(initialStore?: TasksStore, selectedTaskId?: string | null) {
  let store = initialStore ?? makeRichStore().store
  const openBoardPath = '/boards/q4-launch.tasks'

  const boardList = vi.fn(async () => [
    { path: openBoardPath, name: 'Q4 Launch', isDraft: false },
    { path: '/boards/archive.tasks', name: 'Old Archive', isDraft: false },
  ])
  const boardCreate = vi.fn(async (name: string, description = '') => {
    const next = starterBoardStore(name)
    next.projects[0].description = description
    store = next
    return { path: `/boards/${name.toLowerCase()}.tasks`, project: next.projects[0] }
  })
  const boardOpen = vi.fn(async () => {})
  const boardDelete = vi.fn(async () => {})
  const boardRename = vi.fn()
  const boardSetDescription = vi.fn()
  const boardSetArchiveDoneAfterDays = vi.fn()
  const boardCreateMission = vi.fn(async (taskId: string, kind: string) => ({
    id: `mission_${taskId}_${kind}`,
    title: `Mission (${kind})`,
  }))

  const board: TasksAgentBoardApi = {
    path: openBoardPath,
    status: 'filed',
    list: boardList,
    create: boardCreate,
    open: boardOpen,
    rename: boardRename,
    setDescription: boardSetDescription,
    delete: boardDelete,
    setArchiveDoneAfterDays: boardSetArchiveDoneAfterDays,
    createMission: boardCreateMission,
  }

  const ctx: TasksAgentToolContext = {
    storePath: openBoardPath,
    get store() {
      return store
    },
    get activeProject() {
      return store.projects[0]
    },
    get selectedTask(): SuiteTask | null {
      if (!selectedTaskId) return null
      return store.tasks.find(t => t.id === selectedTaskId) ?? null
    },
    filters: DEFAULT_FILTERS,
    viewMode: 'board',
    board,
    applyStoreUpdate: async producer => {
      store = producer(store)
      return store
    },
  }

  const handlers = buildPureTasksHandlers(() => ctx)

  return {
    getStore: () => store,
    ctx,
    handlers,
    mocks: {
      boardList,
      boardCreate,
      boardOpen,
      boardDelete,
      boardCreateMission,
    },
  }
}

describe('PureTasks Operations Registry & Manifest Sync', () => {
  it('enforces 3-tier exposure invariants and audit summary', () => {
    const summary = PURETASKS_OPERATIONS_REGISTRY.auditSummary()
    expect(summary).toEqual({
      appSlug: 'tasks',
      functions: 6,
      coreTools: 7,
      extendedTools: 22,
      metaTools: 3,
      totalExposed: 16,
      totalAtomicTools: 29,
      totalRegistered: 35,
      schemaReductionPercent: 45,
    })

    expect(PURETASKS_OPERATIONS_REGISTRY.exposedToolNames).toEqual([
      ...EXPOSED_TOOL_NAMES,
    ])
    expect(PURETASKS_OPERATIONS_REGISTRY.exposedToolNames).toEqual([
      ...PURETASKS_AGENT_TOOL_NAMES,
    ])
    expect(PURETASKS_OPERATIONS_REGISTRY.extendedToolNames).toEqual([
      ...PURETASKS_EXTENDED_TOOL_NAMES,
    ])
    expect(PURETASKS_OPERATIONS_REGISTRY.allAtomicToolNames).toEqual([
      ...PURETASKS_ALL_ATOMIC_TOOL_NAMES,
    ])
    expect(PURETASKS_FUNCTION_NAMES).toHaveLength(6)
    expect(PURETASKS_CORE_TOOL_NAMES).toHaveLength(7)
    expect(PURETASKS_META_TOOL_NAMES).toHaveLength(3)
    expect(PURETASKS_ATOMIC_TOOL_SCHEMAS).toHaveLength(29)
  })

  it('matches plugin.json app.agents.tools 1:1', () => {
    const manifest = JSON.parse(readFileSync('plugin.json', 'utf8')) as {
      app: { agents: { tools: unknown[] } }
    }
    expect(manifest.app.agents.tools).toEqual([
      ...PURETASKS_OPERATIONS_REGISTRY.manifestTools,
    ])
  })

  it('satisfies manifest quality and safety rules on every exposed entry', () => {
    for (const entry of PURETASKS_OPERATIONS_REGISTRY.manifestTools) {
      expect(entry.description.trim().length).toBeGreaterThanOrEqual(80)
      expect(typeof entry.requiresApproval).toBe('boolean')
      expect(['read', 'write', 'destructive', 'external', 'release']).toContain(
        entry.risk,
      )
      const firstDescWord =
        entry.description
          .trim()
          .split(/[^A-Za-z]+/)
          .find(Boolean)
          ?.toLowerCase() ?? ''
      const firstNameWord =
        entry.name
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .split(/[^A-Za-z]+/)
          .find(Boolean)
          ?.toLowerCase() ?? ''
      if (entry.risk !== 'release') {
        expect(RELEASE_VERBS.has(firstDescWord)).toBe(false)
        expect(RELEASE_VERBS.has(firstNameWord)).toBe(false)
      }
    }

    const deleteProject = PURETASKS_OPERATIONS_REGISTRY.coreTools.find(
      t => t.name === 'deleteTaskProject',
    )
    expect(deleteProject?.deletesPermanently).toBe(true)
    expect(deleteProject?.exposure).toBe('always')
  })
})

describe('PureTasks Composite App Functions (fn_*)', () => {
  it('fn_boardBriefingAndSchedule computes schedule buckets, review queue, blockers, stale cards, and missions', async () => {
    const { store, ids } = makeRichStore()
    const { handlers } = makeFixture(store, ids.blockerDoing)

    const raw = await handlers.fn_boardBriefingAndSchedule(
      invoke('fn_boardBriefingAndSchedule', {
        asOfDate: '2026-11-23',
        staleDays: 5,
      }),
    )
    const parsed = JSON.parse(raw.content)
    expect(parsed.ok).toBe(true)
    expect(parsed.opClass).toBe('function')
    expect(parsed.function).toBe('fn_boardBriefingAndSchedule')

    const { data } = parsed
    expect(data.knownBoardCount).toBe(2)
    expect(data.totals.overdue).toBe(1)
    expect(data.totals.dueToday).toBe(1)
    expect(data.totals.dueTomorrow).toBe(2)
    expect(data.totals.inReview).toBe(1)
    expect(data.totals.blocked).toBe(1)
    expect(data.totals.stale).toBe(2)
    expect(data.totals.archived).toBe(1)
    expect(data.schedule.overdue[0].id).toBe(ids.overdueInbox)
    expect(data.schedule.dueToday[0].id).toBe(ids.todayDoing)
    expect(data.blockedCards[0].id).toBe(ids.blockedReview)
    expect(data.blockedCards[0].waitingOn[0].id).toBe(ids.blockerDoing)
    expect(data.activeMissions).toHaveLength(1)
    expect(data.activeMissions[0].missionId).toBe('mission_1')

    // Doing column has 3 open cards with wipLimit: 3 -> atWipLimit true
    const doingCol = data.columns.find((c: { id: string }) => c.id === 'doing')
    expect(doingCol.atWipLimit).toBe(true)

    // Owner filter scopes properly
    const adaOnly = JSON.parse(
      (
        await handlers.fn_boardBriefingAndSchedule(
          invoke('fn_boardBriefingAndSchedule', {
            asOfDate: '2026-11-23',
            ownerName: 'ada',
          }),
        )
      ).content,
    )
    expect(adaOnly.data.totals.open).toBe(3)
    expect(adaOnly.data.totals.overdue).toBe(0)
  })

  it('fn_workloadAndHealthAudit audits owner workload, WIP limits, bottlenecks, and hygiene findings', async () => {
    const { store, ids } = makeRichStore()
    const { handlers } = makeFixture(store)

    const parsed = JSON.parse(
      (
        await handlers.fn_workloadAndHealthAudit(
          invoke('fn_workloadAndHealthAudit', { asOfDate: '2026-11-23' }),
        )
      ).content,
    )
    expect(parsed.ok).toBe(true)
    const { data } = parsed
    expect(data.healthScore).toBeLessThan(100)
    expect(data.ownerWorkload.some((o: { ownerName: string }) => o.ownerName === 'Ada')).toBe(true)
    expect(
      data.ownerWorkload.some((o: { ownerName: string }) => o.ownerName === 'Unassigned'),
    ).toBe(true)
    expect(data.bottlenecks).toHaveLength(1)
    expect(data.bottlenecks[0].taskId).toBe(ids.blockerDoing)
    expect(data.bottlenecks[0].blocksOpenCount).toBe(1)

    const findingCodes = data.findings.map((f: { code: string }) => f.code)
    expect(findingCodes).toContain('wip-limit-pressure')
    expect(findingCodes).toContain('overdue-in-inbox')
    expect(findingCodes).toContain('unassigned-high-priority')
    expect(findingCodes).toContain('dependency-bottlenecks')
    expect(findingCodes).toContain('dangling-dependencies')

    await expect(
      handlers.fn_workloadAndHealthAudit(
        invoke('fn_workloadAndHealthAudit', { status: 'nonexistent' }),
      ),
    ).rejects.toThrow(AgentTasksToolError)
  })

  it('fn_getTaskDossier returns full card, subtasks, dependencies, checklists, and scoped activity', async () => {
    const { store, ids } = makeRichStore()
    const { handlers } = makeFixture(store, ids.blockerDoing)

    // Defaults to selected task
    const parsed = JSON.parse(
      (
        await handlers.fn_getTaskDossier(
          invoke('fn_getTaskDossier', { asOfDate: '2026-11-23' }),
        )
      ).content,
    )
    expect(parsed.ok).toBe(true)
    const { data } = parsed
    expect(data.task.id).toBe(ids.blockerDoing)
    expect(data.checklistSummary.done).toBe(1)
    expect(data.checklistSummary.total).toBe(2)
    expect(data.checklistSummary.completionPct).toBe(50)
    expect(data.subtasks).toHaveLength(1)
    expect(data.subtasks[0].id).toBe(ids.subtask1)
    expect(data.dependencies.blocks).toHaveLength(1)
    expect(data.dependencies.blocks[0].id).toBe(ids.blockedReview)
    expect(data.activity).toHaveLength(1)

    // Subtask dossier resolves parent link
    const childDossier = JSON.parse(
      (
        await handlers.fn_getTaskDossier(
          invoke('fn_getTaskDossier', { taskId: ids.subtask1 }),
        )
      ).content,
    )
    expect(childDossier.data.parent.id).toBe(ids.blockerDoing)
  })

  it('fn_captureStructuredTask atomically creates card, checklists, subtasks, links, and comment', async () => {
    const { store } = makeRichStore()
    const { handlers, getStore } = makeFixture(store)
    const initialCount = getStore().tasks.length

    const parsed = JSON.parse(
      (
        await handlers.fn_captureStructuredTask(
          invoke('fn_captureStructuredTask', {
            title: 'Release v2.0 announcement',
            status: 'inbox',
            priority: 'high',
            ownerName: 'Ada',
            labels: ['launch', 'comms'],
            dueAt: '2026-11-28',
            links: [
              {
                type: 'writer',
                title: 'Announcement draft',
                path: '/docs/v2-announcement.doc',
                appSlug: 'writer',
              },
            ],
            checklists: [
              {
                title: 'Launch checklist',
                items: ['Draft copy', 'Legal review', 'Schedule social'],
              },
            ],
            subtasks: [
              { title: 'Prepare screenshots', ownerName: 'Linus', priority: 'normal' },
              { title: 'Verify changelog links', ownerName: 'Grace' },
            ],
            initialComment: {
              text: 'Kickoff captured from launch sync.',
              authorName: 'Planner',
            },
          }),
        )
      ).content,
    )

    expect(parsed.ok).toBe(true)
    expect(parsed.data.checklistsCreated).toBe(1)
    expect(parsed.data.checklistItemsCreated).toBe(3)
    expect(parsed.data.subtasks).toHaveLength(2)
    expect(parsed.data.commentId).toBeTruthy()
    expect(getStore().tasks.length).toBe(initialCount + 3)

    const mainCard = getStore().tasks.find(t => t.id === parsed.data.task.id)!
    expect(mainCard.checklists[0].items).toHaveLength(3)
    expect(mainCard.comments[0].authorName).toBe('Planner')
    expect(mainCard.links[0].path).toBe('/docs/v2-announcement.doc')
    for (const sub of parsed.data.subtasks) {
      expect(sub.parentId).toBe(mainCard.id)
    }

    // Atomicity check: attempting to capture into full WIP-limited `doing` column leaves store untouched
    const countBeforeFail = getStore().tasks.length
    await expect(
      handlers.fn_captureStructuredTask(
        invoke('fn_captureStructuredTask', {
          title: 'Over-limit card',
          status: 'doing',
          subtasks: [{ title: 'Should never be created' }],
        }),
      ),
    ).rejects.toThrow(AgentTasksToolError)
    expect(getStore().tasks.length).toBe(countBeforeFail)
  })

  it('fn_batchTriageTasks supports dryRun preview, label merge, comments, and WIP enforcement', async () => {
    const { store, ids } = makeRichStore()
    const { handlers, getStore } = makeFixture(store)

    // 1. Dry run leaves store untouched
    const dry = JSON.parse(
      (
        await handlers.fn_batchTriageTasks(
          invoke('fn_batchTriageTasks', {
            dryRun: true,
            reason: 'Morning triage',
            updates: [
              {
                taskId: ids.overdueInbox,
                ownerName: 'Ada',
                dueAt: '2026-11-25',
                addLabels: ['triaged'],
                removeLabels: ['finance'],
                comment: 'Rescheduled during triage.',
              },
            ],
          }),
        )
      ).content,
    )
    expect(dry.ok).toBe(true)
    expect(dry.data.dryRun).toBe(true)
    expect(dry.data.changedCount).toBe(1)
    expect(dry.data.changes[0].changedFields).toEqual(
      expect.arrayContaining(['ownerName', 'dueAt', 'labels', 'comment']),
    )
    // Verify store was NOT mutated
    const untouched = getStore().tasks.find(t => t.id === ids.overdueInbox)!
    expect(untouched.ownerName).toBeUndefined()
    expect(untouched.labels).toEqual(['finance', 'launch'])

    // 2. Real persisted batch
    const applied = JSON.parse(
      (
        await handlers.fn_batchTriageTasks(
          invoke('fn_batchTriageTasks', {
            reason: 'Morning triage',
            updates: [
              {
                taskId: ids.overdueInbox,
                ownerName: 'Ada',
                dueAt: '2026-11-25',
                addLabels: ['triaged'],
                removeLabels: ['finance'],
                comment: 'Rescheduled during triage.',
              },
              {
                taskId: ids.staleDoing,
                status: 'review',
                priority: 'high',
              },
            ],
          }),
        )
      ).content,
    )
    expect(applied.ok).toBe(true)
    expect(applied.data.dryRun).toBe(false)
    expect(applied.data.processedCount).toBe(2)

    const updatedInbox = getStore().tasks.find(t => t.id === ids.overdueInbox)!
    expect(updatedInbox.ownerName).toBe('Ada')
    expect(updatedInbox.dueAt).toBe('2026-11-25')
    expect(updatedInbox.labels).toEqual(['launch', 'triaged'])
    expect(updatedInbox.comments).toHaveLength(1)

    const movedStale = getStore().tasks.find(t => t.id === ids.staleDoing)!
    expect(movedStale.status).toBe('review')
    expect(movedStale.priority).toBe('high')
  })

  it('fn_periodReviewDigest reports completed (including archived), throughput, repeating cadence, and carryover', async () => {
    const { store, ids } = makeRichStore()
    const { handlers } = makeFixture(store)

    const parsed = JSON.parse(
      (
        await handlers.fn_periodReviewDigest(
          invoke('fn_periodReviewDigest', {
            days: 7,
            upcomingDays: 7,
            asOfDate: '2026-11-23',
          }),
        )
      ).content,
    )
    expect(parsed.ok).toBe(true)
    const { data } = parsed

    // Both doneRecent (Nov 20) and doneArchived (Nov 19) fall in the 7-day window!
    expect(data.metrics.completedCount).toBe(2)
    expect(data.completedInWindow.map((t: { id: string }) => t.id)).toEqual([
      ids.doneRecent,
      ids.doneArchived,
    ])
    expect(data.metrics.completedLoggedHours).toBe(3.5)
    expect(data.repeatingTasks).toHaveLength(1)
    expect(data.repeatingTasks[0].id).toBe(ids.repeatingTask)
    expect(data.repeatingTasks[0].nextRepeatDue).toBe('2026-12-01')
    expect(data.carryoverInProgress.length).toBeGreaterThanOrEqual(2)
    expect(data.upcomingDeadlines.length).toBeGreaterThanOrEqual(3)
  })
})

describe('PureTasks Core Tools & Extended Escape-Hatch Routing', () => {
  it('runs direct core tools including createMissionFromTask and permanent-delete deleteTaskProject', async () => {
    const { store, ids } = makeRichStore()
    const { handlers, mocks } = makeFixture(store, ids.blockerDoing)

    const ctxRes = JSON.parse(
      (await handlers.getTasksContext(invoke('getTasksContext'))).content,
    )
    expect(ctxRes.activeProject.name).toBe('Q4 Launch')

    const missionRes = JSON.parse(
      (
        await handlers.createMissionFromTask(
          invoke('createMissionFromTask', {
            taskId: ids.blockerDoing,
            kind: 'steps',
          }),
        )
      ).content,
    )
    expect(missionRes.mission.id).toContain(ids.blockerDoing)
    expect(mocks.boardCreateMission).toHaveBeenCalledWith(
      ids.blockerDoing,
      'steps',
    )

    // deleteTaskProject refuses open board
    await expect(
      handlers.deleteTaskProject(
        invoke('deleteTaskProject', { path: '/boards/q4-launch.tasks' }),
      ),
    ).rejects.toThrow(AgentTasksToolError)

    // deleteTaskProject succeeds on non-open board
    const delRes = JSON.parse(
      (
        await handlers.deleteTaskProject(
          invoke('deleteTaskProject', { path: '/boards/archive.tasks' }),
        )
      ).content,
    )
    expect(delRes.deletedPath).toBe('/boards/archive.tasks')
    expect(mocks.boardDelete).toHaveBeenCalledWith('/boards/archive.tasks')
  })

  it('discovers extended tools via discoverAppTools by query, category, and exact names', async () => {
    const { handlers } = makeFixture()

    const byCategory = JSON.parse(
      (
        await handlers.discoverAppTools(
          invoke('discoverAppTools', { category: 'checklists' }),
        )
      ).content,
    )
    expect(byCategory.operations).toHaveLength(6)
    expect(
      byCategory.operations.every(
        (op: { invokeVia: string }) => op.invokeVia === 'callExtendedTool',
      ),
    ).toBe(true)

    const byName = JSON.parse(
      (
        await handlers.discoverAppTools(
          invoke('discoverAppTools', {
            names: ['listTaskColumns', 'deleteTask', 'nonexistentTool'],
          }),
        )
      ).content,
    )
    expect(byName.operations[0]).toMatchObject({
      name: 'listTaskColumns',
      found: true,
      invokeVia: 'callExtendedReadTool',
    })
    expect(byName.operations[1]).toMatchObject({
      name: 'deleteTask',
      found: true,
      invokeVia: 'callExtendedTool',
      requiresConfirmDestructive: true,
    })
    expect(byName.operations[2]).toMatchObject({
      name: 'nonexistentTool',
      found: false,
    })
  })

  it('routes read-only extended tools through callExtendedReadTool and refuses mutating/direct tools', async () => {
    const { handlers } = makeFixture()

    const cols = JSON.parse(
      (
        await handlers.callExtendedReadTool(
          invoke('callExtendedReadTool', { tool: 'listTaskColumns' }),
        )
      ).content,
    )
    expect(cols.map((c: { id: string }) => c.id)).toEqual([
      'inbox',
      'doing',
      'review',
      'done',
    ])

    // Refuses mutating extended tool
    await expect(
      handlers.callExtendedReadTool(
        invoke('callExtendedReadTool', {
          tool: 'createTaskColumn',
          arguments: { label: 'QA' },
        }),
      ),
    ).rejects.toThrow(/callExtendedTool/i)

    // Refuses already directly exposed tool
    await expect(
      handlers.callExtendedReadTool(
        invoke('callExtendedReadTool', { tool: 'getTask' }),
      ),
    ).rejects.toThrow(/directly/i)

    // Refuses unknown tool
    await expect(
      handlers.callExtendedReadTool(
        invoke('callExtendedReadTool', { tool: 'doesNotExist' }),
      ),
    ).rejects.toThrow(AgentTasksToolError)
  })

  it('routes mutating/destructive extended tools through callExtendedTool with destructive confirmation gate', async () => {
    const { store, ids } = makeRichStore()
    const { handlers, getStore } = makeFixture(store)

    // Write extended tool succeeds
    const colRes = JSON.parse(
      (
        await handlers.callExtendedTool(
          invoke('callExtendedTool', {
            tool: 'createTaskColumn',
            arguments: { label: 'Blocked' },
          }),
        )
      ).content,
    )
    expect(colRes.column.label).toBe('Blocked')

    // Destructive extended tool refused without confirmDestructive: true
    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', {
          tool: 'deleteTask',
          arguments: { taskId: ids.repeatingTask },
        }),
      ),
    ).rejects.toThrow(/confirmDestructive/i)

    // Destructive extended tool succeeds WITH confirmDestructive: true and returns deletedSnapshot
    const delRes = JSON.parse(
      (
        await handlers.callExtendedTool(
          invoke('callExtendedTool', {
            tool: 'deleteTask',
            confirmDestructive: true,
            arguments: { taskId: ids.repeatingTask },
          }),
        )
      ).content,
    )
    expect(delRes.deletedTaskId).toBe(ids.repeatingTask)
    expect(delRes.deletedSnapshot.task.id).toBe(ids.repeatingTask)
    expect(
      getStore().tasks.some(t => t.id === ids.repeatingTask),
    ).toBe(false)

    // Refuses read-only extended tool
    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', { tool: 'listTaskColumns' }),
      ),
    ).rejects.toThrow(/callExtendedReadTool/i)

    // Refuses permanently-deleting direct tool
    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', {
          tool: 'deleteTaskProject',
          confirmDestructive: true,
          arguments: { path: '/boards/archive.tasks' },
        }),
      ),
    ).rejects.toThrow(/directly/i)
  })
})
