import { DEFAULT_PROJECT_NAME } from '../constants'
import type {
  SuiteTask,
  TaskActivity,
  TaskChecklist,
  TaskChecklistItem,
  TaskColumn,
  TaskComment,
  TaskFilters,
  TaskLinkType,
  TaskPriority,
  TaskProject,
  TaskRepeat,
  TaskResourceLink,
  TaskStatus,
  TasksStore,
} from '../types'

export const TASK_STATUSES: TaskStatus[] = ['inbox', 'doing', 'review', 'done']

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
}

export const DEFAULT_TASK_COLUMNS: TaskColumn[] = TASK_STATUSES.map(id => ({
  id,
  label: TASK_STATUS_LABELS[id],
  ...(id === 'done' ? { done: true } : {}),
}))

export const DEFAULT_FILTERS: TaskFilters = {
  query: '',
  status: 'all',
  label: '',
}

export function createId(prefix: string): string {
  const cryptoId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${prefix}_${cryptoId}`
}

export function emptyTasksStore(now = new Date().toISOString()): TasksStore {
  return starterBoardStore(DEFAULT_PROJECT_NAME, now)
}

/** A fresh single-board store — one project, default columns, no tasks. */
export function starterBoardStore(
  name = DEFAULT_PROJECT_NAME,
  now = new Date().toISOString(),
): TasksStore {
  const project = createProject(name, '', now)
  return {
    schemaVersion: 1,
    projects: [project],
    columns: cloneDefaultTaskColumns(),
    tasks: [],
    activity: [],
  }
}

export function createProject(
  name: string,
  description = '',
  now = new Date().toISOString(),
): TaskProject {
  return {
    id: createId('project'),
    name: name.trim() || DEFAULT_PROJECT_NAME,
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

export function createTask(
  projectId: string,
  title: string,
  statusOrNow: TaskStatus | string = 'inbox',
  maybeNow?: string,
): SuiteTask {
  const status =
    maybeNow || !isIsoLikeDate(statusOrNow)
      ? statusOrNow.trim() || 'inbox'
      : 'inbox'
  const now =
    maybeNow ??
    (status === statusOrNow ? new Date().toISOString() : statusOrNow)
  return {
    id: createId('task'),
    projectId,
    title: title.trim(),
    notes: '',
    status,
    order: Date.parse(now) || Date.now(),
    priority: 'normal',
    labels: [],
    links: [],
    checklists: [],
    comments: [],
    blockedBy: [],
    missions: [],
    createdAt: now,
    updatedAt: now,
  }
}

function isIsoLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value))
}

/** In-board task history rows (shown in the Activity view and card panel). */
export function createActivity(
  taskId: string,
  type: string,
  text: string,
  now = new Date().toISOString(),
): TaskActivity {
  return {
    id: createId('activity'),
    taskId,
    type,
    text,
    at: now,
  }
}

export function normalizeTasksStore(
  raw: unknown,
  now = new Date().toISOString(),
): TasksStore {
  if (!raw || typeof raw !== 'object') return emptyTasksStore(now)
  const candidate = raw as Partial<TasksStore>
  const projects = Array.isArray(candidate.projects)
    ? candidate.projects.filter(isProject)
    : []
  const columns = normalizeTaskColumns(candidate.columns)
  const tasks = Array.isArray(candidate.tasks)
    ? candidate.tasks.filter(isTask).map(task => normalizeTask(task, now))
    : []
  const activity = Array.isArray(candidate.activity)
    ? candidate.activity.filter(isActivity)
    : []
  if (projects.length === 0) {
    const fallback = createProject(DEFAULT_PROJECT_NAME, '', now)
    return {
      schemaVersion: 1,
      projects: [fallback],
      columns,
      tasks: tasks.map(task => ({ ...task, projectId: fallback.id })),
      activity,
    }
  }
  const projectIds = new Set(projects.map(project => project.id))
  return {
    schemaVersion: 1,
    projects,
    columns,
    tasks: tasks.filter(task => projectIds.has(task.projectId)),
    activity,
  }
}

export function cloneDefaultTaskColumns(): TaskColumn[] {
  return DEFAULT_TASK_COLUMNS.map(column => ({ ...column }))
}

export function normalizeTaskColumns(value: unknown): TaskColumn[] {
  const rawColumns = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const columns: TaskColumn[] = []
  for (const column of rawColumns) {
    if (!column || typeof column !== 'object') continue
    const candidate = column as Partial<TaskColumn>
    const id = candidate.id?.trim()
    const label = candidate.label?.trim()
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    columns.push({
      id,
      label,
      ...(candidate.collapsed ? { collapsed: true } : {}),
      ...(candidate.hidden ? { hidden: true } : {}),
      ...(candidate.done ? { done: true } : {}),
      ...(typeof candidate.wipLimit === 'number' && candidate.wipLimit > 0
        ? { wipLimit: Math.floor(candidate.wipLimit) }
        : {}),
    })
  }
  for (const column of DEFAULT_TASK_COLUMNS) {
    if (!seen.has(column.id)) {
      seen.add(column.id)
      columns.push({ ...column })
    }
  }
  return columns
}

export function taskColumnsForStore(store: TasksStore): TaskColumn[] {
  return normalizeTaskColumns(store.columns)
}

export function taskStatusLabel(
  columns: TaskColumn[],
  status: TaskStatus,
): string {
  return (
    columns.find(column => column.id === status)?.label ??
    TASK_STATUS_LABELS[status] ??
    status
  )
}

export function createTaskColumn(
  label: string,
  existingColumns: TaskColumn[],
): TaskColumn | null {
  const trimmed = label.trim()
  if (!trimmed) return null
  const existingIds = new Set(existingColumns.map(column => column.id))
  const base =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'column'
  let id = base
  let suffix = 2
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return { id, label: trimmed }
}

export function moveTaskStatus(
  task: SuiteTask,
  status: TaskStatus,
  now = new Date().toISOString(),
  order?: number,
  completed = status === 'done',
): SuiteTask {
  return {
    ...task,
    status,
    order: order ?? task.order,
    updatedAt: now,
    completedAt: completed ? task.completedAt ?? now : undefined,
  }
}

export function updateTaskDetails(
  task: SuiteTask,
  patch: Partial<
    Pick<
      SuiteTask,
      | 'title'
      | 'notes'
      | 'priority'
      | 'ownerName'
      | 'labels'
      | 'dueAt'
      | 'links'
      | 'checklists'
      | 'comments'
      | 'blockedBy'
      | 'parentId'
      | 'estimateHours'
      | 'loggedHours'
      | 'repeat'
      | 'remindAt'
      | 'missions'
      | 'archivedAt'
    >
  >,
  now = new Date().toISOString(),
): SuiteTask {
  const has = (key: string): boolean =>
    Object.prototype.hasOwnProperty.call(patch, key)
  const hours = (value: number | undefined): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.round(value * 4) / 4
      : undefined
  return {
    ...task,
    title: patch.title?.trim() ?? task.title,
    notes: patch.notes ?? task.notes,
    priority: patch.priority ?? task.priority,
    ownerName: has('ownerName')
      ? patch.ownerName?.trim() || undefined
      : task.ownerName,
    labels: patch.labels ?? task.labels,
    dueAt: has('dueAt') ? patch.dueAt?.trim() || undefined : task.dueAt,
    links: patch.links ?? task.links,
    checklists: patch.checklists ?? task.checklists,
    comments: patch.comments ?? task.comments,
    blockedBy: patch.blockedBy
      ? Array.from(new Set(patch.blockedBy.filter(id => id && id !== task.id)))
      : task.blockedBy,
    parentId: has('parentId')
      ? patch.parentId && patch.parentId !== task.id
        ? patch.parentId
        : undefined
      : task.parentId,
    estimateHours: has('estimateHours')
      ? hours(patch.estimateHours)
      : task.estimateHours,
    loggedHours: has('loggedHours') ? hours(patch.loggedHours) : task.loggedHours,
    repeat: has('repeat')
      ? patch.repeat && patch.repeat !== 'none'
        ? patch.repeat
        : undefined
      : task.repeat,
    remindAt: has('remindAt') ? patch.remindAt?.trim() || undefined : task.remindAt,
    missions: patch.missions ?? task.missions,
    archivedAt: has('archivedAt') ? patch.archivedAt || undefined : task.archivedAt,
    updatedAt: now,
  }
}

export const TASK_REPEATS: TaskRepeat[] = ['none', 'daily', 'weekly', 'monthly']

/** Cards this task waits on that are not done yet (a done blocker no longer blocks). */
export function openBlockers(task: SuiteTask, store: TasksStore): SuiteTask[] {
  const doneStatuses = new Set(
    taskColumnsForStore(store).filter(column => column.done).map(column => column.id),
  )
  return task.blockedBy
    .map(id => store.tasks.find(candidate => candidate.id === id))
    .filter((candidate): candidate is SuiteTask => Boolean(candidate))
    .filter(candidate => !doneStatuses.has(candidate.status) && !candidate.archivedAt)
}

export const isBlocked = (task: SuiteTask, store: TasksStore): boolean =>
  openBlockers(task, store).length > 0

/** Cards that wait on this one. */
export function blocks(task: SuiteTask, store: TasksStore): SuiteTask[] {
  return store.tasks.filter(candidate => candidate.blockedBy.includes(task.id))
}

export function subtasksOf(task: SuiteTask, store: TasksStore): SuiteTask[] {
  return store.tasks
    .filter(candidate => candidate.parentId === task.id)
    .sort((a, b) => a.order - b.order)
}

/** Open cards in a column, for the WIP limit: archived and done cards never count. */
export function columnLoad(store: TasksStore, status: TaskStatus): number {
  return store.tasks.filter(task => task.status === status && !task.archivedAt).length
}

/** True when one more card would exceed the column's limit. */
export function columnAtLimit(store: TasksStore, status: TaskStatus): boolean {
  const column = taskColumnsForStore(store).find(candidate => candidate.id === status)
  if (!column?.wipLimit) return false
  return columnLoad(store, status) >= column.wipLimit
}

export const DEFAULT_ARCHIVE_DONE_AFTER_DAYS = 14

/** Done cards older than the board's archive window leave the board (they stay in the file). */
export function archiveDoneTasks(
  store: TasksStore,
  now = new Date().toISOString(),
): TasksStore {
  const project = store.projects[0]
  const days = project?.archiveDoneAfterDays ?? DEFAULT_ARCHIVE_DONE_AFTER_DAYS
  if (!days) return store
  const cutoff = Date.parse(now) - days * 86_400_000
  const doneStatuses = new Set(
    taskColumnsForStore(store).filter(column => column.done).map(column => column.id),
  )
  let changed = false
  const tasks = store.tasks.map(task => {
    if (task.archivedAt || !doneStatuses.has(task.status)) return task
    const completed = Date.parse(task.completedAt ?? task.updatedAt)
    if (!Number.isFinite(completed) || completed > cutoff) return task
    changed = true
    return { ...task, archivedAt: now }
  })
  return changed ? { ...store, tasks } : store
}

/** A done card that repeats comes back as a fresh open card with the next due date. */
export function nextRepeatDue(dueAt: string | undefined, repeat: TaskRepeat | undefined, from = new Date()): string | undefined {
  if (!repeat || repeat === 'none') return undefined
  const base = dueAt ? new Date(`${dueAt.slice(0, 10)}T00:00:00`) : from
  const next = new Date(base)
  if (repeat === 'daily') next.setDate(next.getDate() + 1)
  if (repeat === 'weekly') next.setDate(next.getDate() + 7)
  if (repeat === 'monthly') next.setMonth(next.getMonth() + 1)
  // Never schedule into the past: step forward until the next occurrence is ahead of today.
  const today = new Date(from); today.setHours(0, 0, 0, 0)
  while (next < today) {
    if (repeat === 'daily') next.setDate(next.getDate() + 1)
    else if (repeat === 'weekly') next.setDate(next.getDate() + 7)
    else next.setMonth(next.getMonth() + 1)
  }
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none'

export function dueBucket(task: Pick<SuiteTask, 'dueAt'>, from = new Date()): DueBucket {
  if (!task.dueAt) return 'none'
  const today = new Date(from); today.setHours(0, 0, 0, 0)
  const due = new Date(`${task.dueAt.slice(0, 10)}T00:00:00`)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
}

export function checklistProgress(task: SuiteTask): {
  done: number
  total: number
} {
  const items = task.checklists.flatMap(checklist => checklist.items)
  return {
    done: items.filter(item => item.done).length,
    total: items.length,
  }
}

export const TASK_LINK_TYPES: TaskLinkType[] = [
  'file',
  'writer',
  'book',
  'chapter',
  'chat-message',
  'agent-run',
  'mail',
  'video',
  'calendar',
  'issue',
  'canvas',
  'sheets',
  'mission',
]

/** Loose input for a resource link — agent payloads may omit title or type. */
export type TaskResourceLinkInput = Partial<Omit<TaskResourceLink, 'id'>> & {
  id?: string
}

export function normalizeResourceLink(
  input: TaskResourceLinkInput,
): TaskResourceLink {
  const title = input.title?.trim() ?? ''
  const path = input.path?.trim()
  const appSlug = input.appSlug?.trim()
  const resourceId = input.resourceId?.trim()
  const type =
    input.type && (TASK_LINK_TYPES as string[]).includes(input.type)
      ? input.type
      : 'file'
  return {
    id: input.id ?? createId('link'),
    type,
    title: title || path || resourceId || 'Resource',
    ...(path ? { path } : {}),
    ...(appSlug ? { appSlug } : {}),
    ...(resourceId ? { resourceId } : {}),
  }
}

export function visibleTasksForProject(
  store: TasksStore,
  projectId: string,
  filters: TaskFilters,
): SuiteTask[] {
  const query = filters.query.trim().toLowerCase()
  const label = filters.label.trim().toLowerCase()
  return store.tasks
    .filter(task => task.projectId === projectId && !task.archivedAt)
    .filter(task => filters.status === 'all' || task.status === filters.status)
    .filter(task =>
      label
        ? task.labels.some(candidate => candidate.toLowerCase() === label)
        : true,
    )
    .filter(task => {
      const due = filters.due ?? ''
      if (!due) return true
      const bucket = dueBucket(task)
      if (due === 'overdue') return bucket === 'overdue'
      if (due === 'today') return bucket === 'today' || bucket === 'overdue'
      if (due === 'week') return bucket === 'today' || bucket === 'tomorrow' || bucket === 'week' || bucket === 'overdue'
      if (due === 'none') return bucket === 'none'
      return true
    })
    .filter(task => !filters.priority || task.priority === filters.priority)
    .filter(task => {
      if (!query) return true
      const haystack = [
        task.title,
        task.notes,
        task.status,
        task.priority,
        task.ownerName ?? '',
        ...task.labels,
        ...task.checklists.flatMap(checklist => [
          checklist.title,
          ...checklist.items.map(item => item.text),
        ]),
        ...task.comments.flatMap(comment => [comment.authorName, comment.text]),
        ...task.links.flatMap(link => [
          link.title,
          link.path ?? '',
          link.appSlug ?? '',
          link.resourceId ?? '',
        ]),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
    .sort(compareTasks)
}

export function labelsForProject(
  store: TasksStore,
  projectId: string,
): string[] {
  return Array.from(
    new Set(
      store.tasks
        .filter(task => task.projectId === projectId)
        .flatMap(task => task.labels)
        .map(label => label.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))
}

function compareTasks(a: SuiteTask, b: SuiteTask): number {
  if (a.status === b.status && a.order !== b.order) return a.order - b.order
  const due = (a.dueAt ?? '').localeCompare(b.dueAt ?? '')
  if (a.dueAt && b.dueAt && due !== 0) return due
  if (a.dueAt && !b.dueAt) return -1
  if (!a.dueAt && b.dueAt) return 1
  return b.updatedAt.localeCompare(a.updatedAt)
}

function isProject(value: unknown): value is TaskProject {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'name' in value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string',
  )
}

function isTask(value: unknown): value is SuiteTask {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'projectId' in value &&
      'title' in value &&
      'status' in value &&
      typeof value.id === 'string' &&
      typeof value.projectId === 'string' &&
      typeof value.title === 'string' &&
      typeof value.status === 'string',
  )
}

function normalizeTask(task: SuiteTask, now: string): SuiteTask {
  return {
    ...task,
    notes: task.notes ?? '',
    order:
      typeof task.order === 'number'
        ? task.order
        : Date.parse(task.createdAt ?? task.updatedAt ?? now) || Date.now(),
    priority: task.priority ?? 'normal',
    labels: Array.isArray(task.labels) ? task.labels : [],
    links: Array.isArray(task.links) ? task.links : [],
    checklists: Array.isArray(task.checklists)
      ? task.checklists.filter(isChecklist).map(normalizeChecklist)
      : [],
    comments: Array.isArray(task.comments)
      ? task.comments.filter(isComment)
      : [],
    blockedBy: Array.isArray(task.blockedBy)
      ? task.blockedBy.filter((id): id is string => typeof id === 'string')
      : [],
    missions: Array.isArray(task.missions)
      ? task.missions.filter(
          (mission): mission is SuiteTask['missions'][number] =>
            Boolean(mission && typeof mission === 'object' && typeof mission.id === 'string'),
        )
      : [],
    createdAt: task.createdAt ?? now,
    updatedAt: task.updatedAt ?? now,
  }
}

function normalizeChecklist(checklist: TaskChecklist): TaskChecklist {
  return {
    ...checklist,
    items: Array.isArray(checklist.items)
      ? checklist.items.filter(isChecklistItem)
      : [],
  }
}

function isChecklist(value: unknown): value is TaskChecklist {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'title' in value &&
      typeof value.id === 'string' &&
      typeof value.title === 'string',
  )
}

function isChecklistItem(value: unknown): value is TaskChecklistItem {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'text' in value &&
      typeof value.id === 'string' &&
      typeof value.text === 'string',
  )
}

function isComment(value: unknown): value is TaskComment {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'text' in value &&
      typeof value.id === 'string' &&
      typeof value.text === 'string',
  )
}

function isActivity(value: unknown): value is TaskActivity {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'taskId' in value &&
      'at' in value &&
      typeof value.id === 'string' &&
      typeof value.taskId === 'string' &&
      typeof value.at === 'string',
  )
}

export function priorityLabel(priority: TaskPriority): string {
  return priority === 'normal' ? 'Normal' : priority === 'high' ? 'High' : 'Low'
}
