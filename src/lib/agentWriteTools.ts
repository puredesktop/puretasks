import {
  TASK_REPEATS,
  TASK_STATUSES,
  columnAtLimit,
  createActivity,
  createId,
  createTask,
  createTaskColumn,
  moveTaskStatus,
  normalizeResourceLink,
  taskColumnsForStore,
  taskStatusLabel,
  type TaskResourceLinkInput,
  updateTaskDetails,
} from './taskModel'
import type {
  SuiteTask,
  TaskChecklist,
  TaskChecklistItem,
  TaskComment,
  TaskColumn,
  TaskPriority,
  TaskRepeat,
  TaskProject,
  TaskResourceLink,
  TaskStatus,
  TasksStore,
} from '../types'
import { AgentTasksToolError } from './agentReadTools'

/**
 * Board-level (project) operations are not patch operations: a `.tasks`
 * package holds exactly one project, so creating, deleting, or restoring a
 * project means creating, deleting, or opening another package — that goes
 * through the board tools (createTaskProject, deleteTaskProject,
 * openTaskProject, updateTaskProject), never through the in-package store.
 */
export const REJECTED_PROJECT_PATCH_OPERATIONS = [
  'createProject',
  'updateProject',
  'deleteProject',
  'restoreProject',
] as const

export interface AgentMutationResult<T = unknown> {
  ok: true
  result: T
  store: TasksStore
}

export type AgentBoardPatchOperation =
  | {
      type: 'createColumn'
      label: string
      beforeStatus?: TaskStatus
      collapsed?: boolean
      hidden?: boolean
      done?: boolean
    }
  | {
      type: 'updateColumn'
      status: TaskStatus
      label?: string
      beforeStatus?: TaskStatus | null
      collapsed?: boolean
      hidden?: boolean
      done?: boolean
      wipLimit?: number
    }
  | { type: 'deleteColumn'; status: TaskStatus; targetStatus: TaskStatus }
  | ({ type: 'restoreColumn' } & DeletedTaskColumnSnapshot)
  | ({
      type: 'createTask'
      title: string
      projectId?: string
      status?: TaskStatus
      notes?: string
      priority?: TaskPriority
      ownerName?: string
      labels?: string[]
      dueAt?: string
      links?: TaskResourceLinkInput[]
    } & TaskExtraFields)
  | ({
      type: 'updateTask'
      taskId: string
      title?: string
      status?: TaskStatus
      beforeTaskId?: string
      notes?: string
      priority?: TaskPriority
      ownerName?: string
      labels?: string[]
      dueAt?: string
      links?: TaskResourceLinkInput[]
      /** Move into a column at its WIP limit anyway. */
      force?: boolean
    } & TaskExtraFields)
  | { type: 'deleteTask'; taskId: string }
  | ({ type: 'restoreTask' } & DeletedTaskSnapshot)
  | {
      type: 'createTaskComment'
      taskId: string
      text: string
      authorName?: string
    }
  | {
      type: 'updateTaskComment'
      taskId: string
      commentId: string
      text?: string
      authorName?: string
    }
  | { type: 'deleteTaskComment'; taskId: string; commentId: string }
  | {
      type: 'createTaskChecklist'
      taskId: string
      title: string
      items?: string[]
    }
  | {
      type: 'updateTaskChecklist'
      taskId: string
      checklistId: string
      title?: string
    }
  | { type: 'deleteTaskChecklist'; taskId: string; checklistId: string }
  | {
      type: 'createTaskChecklistItem'
      taskId: string
      checklistId: string
      text: string
      done?: boolean
    }
  | {
      type: 'updateTaskChecklistItem'
      taskId: string
      checklistId: string
      itemId: string
      text?: string
      done?: boolean
    }
  | {
      type: 'deleteTaskChecklistItem'
      taskId: string
      checklistId: string
      itemId: string
    }
  | {
      type: 'addTaskResourceLink'
      taskId: string
      link: TaskResourceLinkInput
    }
  | { type: 'removeTaskResourceLink'; taskId: string; linkId: string }

/**
 * Compact shape of the board after a patch — counts, not the store. The
 * per-operation results in `applied` already carry the created/updated
 * records, so a dry run never needs to echo every card back to the model.
 */
/** The fields beyond the original card shape; all optional, omitted = preserved. */
export interface TaskExtraFields {
  blockedBy?: string[]
  parentId?: string | null
  estimateHours?: number | null
  loggedHours?: number | null
  repeat?: TaskRepeat | null
  remindAt?: string | null
}

function extraPatch(store: TasksStore, taskId: string | null, input: TaskExtraFields): Partial<Parameters<typeof updateTaskDetails>[1]> {
  const patch: Partial<Parameters<typeof updateTaskDetails>[1]> = {}
  if (input.blockedBy !== undefined) {
    for (const id of input.blockedBy) {
      if (id === taskId) throw new AgentTasksToolError('A card cannot block itself.')
      requireTask(store, id)
    }
    patch.blockedBy = input.blockedBy
  }
  if (input.parentId !== undefined) {
    if (input.parentId) { if (input.parentId === taskId) throw new AgentTasksToolError('A card cannot be its own subtask.'); requireTask(store, input.parentId) }
    patch.parentId = input.parentId ?? undefined
  }
  if (input.estimateHours !== undefined) patch.estimateHours = input.estimateHours ?? undefined
  if (input.loggedHours !== undefined) patch.loggedHours = input.loggedHours ?? undefined
  if (input.repeat !== undefined) {
    if (input.repeat && !TASK_REPEATS.includes(input.repeat)) throw new AgentTasksToolError(`repeat must be one of ${TASK_REPEATS.join(', ')}.`)
    patch.repeat = input.repeat ?? undefined
  }
  if (input.remindAt !== undefined) patch.remindAt = input.remindAt ?? undefined
  return patch
}

export interface AgentBoardPatchPreview {
  columns: Array<{ id: TaskStatus; label: string; taskCount: number }>
  taskCount: number
  touchedTaskIds: string[]
}

export interface AgentBoardPatchSummary {
  applied: Array<{ type: string; result: unknown }>
  dryRun?: true
  preview: AgentBoardPatchPreview
}

export interface DeletedTaskColumnSnapshot {
  column: TaskColumn
  movedTasks: Array<{
    taskId: string
    previousStatus: TaskStatus
    targetStatus: TaskStatus
  }>
}

export interface DeletedTaskSnapshot {
  task: SuiteTask
  activity: TasksStore['activity']
}

function nowIso(): string {
  return new Date().toISOString()
}

function withAgentActivity(
  store: TasksStore,
  taskIds: string[],
  text: string,
): TasksStore {
  const at = nowIso()
  const activity = taskIds.map(taskId =>
    createActivity(taskId, 'agent', text, at),
  )
  return { ...store, activity: [...activity, ...store.activity].slice(0, 400) }
}

function requireProject(store: TasksStore, projectId: string): TaskProject {
  const project = store.projects.find(candidate => candidate.id === projectId)
  if (!project) {
    throw new AgentTasksToolError(
      `Unknown project: ${projectId}. Only the open board's project is ` +
        'writable — call getTasksContext for its id, or openTaskProject to ' +
        'switch boards.',
    )
  }
  return project
}

function requireTask(store: TasksStore, taskId: string): SuiteTask {
  const task = store.tasks.find(candidate => candidate.id === taskId)
  if (!task) throw new AgentTasksToolError(`Unknown task: ${taskId}`)
  return task
}

function requireColumn(store: TasksStore, status: TaskStatus): TaskColumn {
  const column = taskColumnsForStore(store).find(
    candidate => candidate.id === status,
  )
  if (!column) throw new AgentTasksToolError(`Unknown column: ${status}`)
  return column
}

function requireChecklist(task: SuiteTask, checklistId: string): TaskChecklist {
  const checklist = task.checklists.find(
    candidate => candidate.id === checklistId,
  )
  if (!checklist) {
    throw new AgentTasksToolError(`Unknown checklist: ${checklistId}`)
  }
  return checklist
}

function requireChecklistItem(
  checklist: TaskChecklist,
  itemId: string,
): TaskChecklistItem {
  const item = checklist.items.find(candidate => candidate.id === itemId)
  if (!item) {
    throw new AgentTasksToolError(`Unknown checklist item: ${itemId}`)
  }
  return item
}

function doneForStatus(store: TasksStore, status: TaskStatus): boolean {
  return Boolean(
    taskColumnsForStore(store).find(column => column.id === status)?.done,
  )
}

export function listTaskColumnsAgentSnapshot(store: TasksStore): TaskColumn[] {
  return taskColumnsForStore(store)
}

export function updateTaskProjectAgentMutation(
  store: TasksStore,
  input: { projectId: string; name?: string; description?: string },
): AgentMutationResult<{ project: TaskProject }> {
  const project = requireProject(store, input.projectId)
  const updated: TaskProject = {
    ...project,
    ...(input.name !== undefined
      ? { name: input.name.trim() || project.name }
      : {}),
    ...(input.description !== undefined
      ? { description: input.description.trim() }
      : {}),
    updatedAt: nowIso(),
  }
  return {
    ok: true,
    result: { project: updated },
    store: {
      ...store,
      projects: store.projects.map(candidate =>
        candidate.id === updated.id ? updated : candidate,
      ),
    },
  }
}

export function restoreTaskAgentMutation(
  store: TasksStore,
  input: DeletedTaskSnapshot,
): AgentMutationResult<{ task: SuiteTask }> {
  if (store.tasks.some(task => task.id === input.task.id)) {
    throw new AgentTasksToolError(`Task already exists: ${input.task.id}`)
  }
  requireProject(store, input.task.projectId)
  requireColumn(store, input.task.status)
  return {
    ok: true,
    result: { task: input.task },
    store: {
      ...store,
      tasks: [input.task, ...store.tasks],
      activity: [...input.activity, ...store.activity],
    },
  }
}

export function restoreTaskColumnAgentMutation(
  store: TasksStore,
  input: DeletedTaskColumnSnapshot,
): AgentMutationResult<{ column: TaskColumn; restoredTaskCount: number }> {
  const columns = taskColumnsForStore(store)
  if (columns.some(column => column.id === input.column.id)) {
    throw new AgentTasksToolError(`Column already exists: ${input.column.id}`)
  }
  const movedByTaskId = new Map(
    input.movedTasks.map(item => [item.taskId, item.previousStatus]),
  )
  return {
    ok: true,
    result: {
      column: input.column,
      restoredTaskCount: movedByTaskId.size,
    },
    store: {
      ...store,
      columns: [...columns, input.column],
      tasks: store.tasks.map(task =>
        movedByTaskId.has(task.id)
          ? moveTaskStatus(
              task,
              movedByTaskId.get(task.id)!,
              nowIso(),
              task.order,
              Boolean(input.column.done),
            )
          : task,
      ),
    },
  }
}

export function createTaskColumnAgentMutation(
  store: TasksStore,
  input: {
    label: string
    beforeStatus?: TaskStatus
    collapsed?: boolean
    hidden?: boolean
    done?: boolean
  },
): AgentMutationResult<{ column: TaskColumn }> {
  const existing = taskColumnsForStore(store)
  const column = createTaskColumn(input.label, existing)
  if (!column) throw new AgentTasksToolError('Column label is required.')
  const fullColumn: TaskColumn = {
    ...column,
    ...(input.collapsed ? { collapsed: true } : {}),
    ...(input.hidden ? { hidden: true } : {}),
    ...(input.done ? { done: true } : {}),
  }
  const columns = [...existing]
  const beforeIndex = input.beforeStatus
    ? columns.findIndex(candidate => candidate.id === input.beforeStatus)
    : -1
  columns.splice(beforeIndex >= 0 ? beforeIndex : columns.length, 0, fullColumn)
  return {
    ok: true,
    result: { column: fullColumn },
    store: { ...store, columns },
  }
}

export function updateTaskColumnAgentMutation(
  store: TasksStore,
  input: {
    status: TaskStatus
    label?: string
    beforeStatus?: TaskStatus | null
    collapsed?: boolean
    hidden?: boolean
    done?: boolean
    wipLimit?: number
  },
): AgentMutationResult<{ column: TaskColumn }> {
  const original = requireColumn(store, input.status)
  if (input.wipLimit !== undefined && (!Number.isInteger(input.wipLimit) || input.wipLimit < 0)) {
    throw new AgentTasksToolError('wipLimit must be a whole number; 0 removes the limit.')
  }
  let columns = taskColumnsForStore(store).map(column =>
    column.id === input.status
      ? {
          ...column,
          ...(input.label !== undefined
            ? { label: input.label.trim() || column.label }
            : {}),
          ...(input.collapsed !== undefined
            ? { collapsed: input.collapsed }
            : {}),
          ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
          ...(input.done !== undefined ? { done: input.done } : {}),
          ...(input.wipLimit !== undefined
            ? input.wipLimit > 0 ? { wipLimit: input.wipLimit } : { wipLimit: undefined }
            : {}),
        }
      : column,
  )
  if (input.beforeStatus !== undefined) {
    const moving = columns.find(column => column.id === input.status)
    if (!moving)
      throw new AgentTasksToolError(`Unknown column: ${input.status}`)
    const rest = columns.filter(column => column.id !== input.status)
    const beforeIndex = input.beforeStatus
      ? rest.findIndex(column => column.id === input.beforeStatus)
      : -1
    columns = [...rest]
    columns.splice(beforeIndex >= 0 ? beforeIndex : columns.length, 0, moving)
  }
  const column = columns.find(candidate => candidate.id === input.status)!
  const completionChanged = Boolean(original.done) !== Boolean(column.done)
  const now = nowIso()
  return {
    ok: true,
    result: { column },
    store: {
      ...store, columns,
      tasks: completionChanged ? store.tasks.map(task => task.status === column.id
        ? moveTaskStatus(task, task.status, now, task.order, Boolean(column.done))
        : task) : store.tasks,
    },
  }
}

export function deleteTaskColumnAgentMutation(
  store: TasksStore,
  input: { status: TaskStatus; targetStatus: TaskStatus },
): AgentMutationResult<{
  deletedStatus: TaskStatus
  targetStatus: TaskStatus
  deletedSnapshot: DeletedTaskColumnSnapshot
}> {
  const column = requireColumn(store, input.status)
  requireColumn(store, input.targetStatus)
  if (input.status === input.targetStatus) {
    throw new AgentTasksToolError('targetStatus must be different from status.')
  }
  // The four default columns are system statuses the board always recreates
  // — deleting one would silently come back. The UI locks them the same way.
  if ((TASK_STATUSES as readonly string[]).includes(input.status)) {
    throw new AgentTasksToolError(
      `${column.label} is a system column and cannot be deleted. Hide it ` +
        `instead: updateTaskColumn({ status: "${input.status}", hidden: true }).`,
    )
  }
  const columns = taskColumnsForStore(store).filter(
    column => column.id !== input.status,
  )
  if (columns.length === 0) {
    throw new AgentTasksToolError('Cannot delete the last column.')
  }
  const targetDone = doneForStatus({ ...store, columns }, input.targetStatus)
  const at = nowIso()
  const movedTasks = store.tasks
    .filter(task => task.status === input.status)
    .map(task => ({
      taskId: task.id,
      previousStatus: input.status,
      targetStatus: input.targetStatus,
    }))
  const deletedSnapshot: DeletedTaskColumnSnapshot = { column, movedTasks }
  return {
    ok: true,
    result: {
      deletedStatus: input.status,
      targetStatus: input.targetStatus,
      deletedSnapshot,
    },
    store: {
      ...store,
      columns,
      tasks: store.tasks.map(task =>
        task.status === input.status
          ? moveTaskStatus(task, input.targetStatus, at, task.order, targetDone)
          : task,
      ),
    },
  }
}

export function createTaskAgentMutation(
  store: TasksStore,
  input: {
    title: string
    projectId?: string
    status?: TaskStatus
    notes?: string
    priority?: TaskPriority
    ownerName?: string
    labels?: string[]
    dueAt?: string
    links?: TaskResourceLinkInput[]
  } & TaskExtraFields,
  activeProjectId: string,
): AgentMutationResult<{ task: SuiteTask }> {
  const projectId = input.projectId ?? activeProjectId
  requireProject(store, projectId)
  const status = input.status ?? 'inbox'
  requireColumn(store, status)
  if (columnAtLimit(store, status)) {
    throw new AgentTasksToolError(`${taskStatusLabel(taskColumnsForStore(store), status)} is at its limit; create the card in another column or raise the limit with updateTaskColumn.`)
  }
  const created = createTask(projectId, input.title, status)
  const task = updateTaskDetails(moveTaskStatus(created, status, created.updatedAt, created.order, doneForStatus(store, status)), {
    notes: input.notes,
    priority: input.priority,
    ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
    labels: input.labels,
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    links: input.links?.map(normalizeResourceLink),
    ...extraPatch(store, null, input),
  })
  const activity = createActivity(task.id, 'create', 'Created task')
  const agentActivity = createActivity(task.id, 'agent', 'Agent created card')
  return {
    ok: true,
    result: { task },
    store: {
      ...store,
      tasks: [task, ...store.tasks],
      activity: [agentActivity, activity, ...store.activity],
    },
  }
}

export function updateTaskAgentMutation(
  store: TasksStore,
  input: {
    taskId: string
    title?: string
    status?: TaskStatus
    beforeTaskId?: string
    notes?: string
    priority?: TaskPriority
    ownerName?: string
    labels?: string[]
    dueAt?: string
    links?: TaskResourceLinkInput[]
    force?: boolean
  } & TaskExtraFields,
): AgentMutationResult<{ task: SuiteTask }> {
  const base = requireTask(store, input.taskId)
  let task = updateTaskDetails(base, {
    title: input.title,
    notes: input.notes,
    priority: input.priority,
    ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
    labels: input.labels,
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    links: input.links?.map(normalizeResourceLink),
    ...extraPatch(store, base.id, input),
  })
  const status = input.status ?? task.status
  requireColumn(store, status)
  if (status !== base.status && !input.force && columnAtLimit(store, status)) {
    throw new AgentTasksToolError(`${taskStatusLabel(taskColumnsForStore(store), status)} is at its WIP limit; finish a card there first, pass force: true, or raise the limit with updateTaskColumn.`)
  }
  if (status !== task.status || input.beforeTaskId !== undefined) {
    const columnTasks = store.tasks
      .filter(
        candidate => candidate.id !== task.id && candidate.status === status,
      )
      .sort((a, b) => a.order - b.order)
    const beforeIndex = input.beforeTaskId
      ? columnTasks.findIndex(candidate => candidate.id === input.beforeTaskId)
      : -1
    const insertIndex = beforeIndex >= 0 ? beforeIndex : columnTasks.length
    const previous = columnTasks[insertIndex - 1]
    const next = columnTasks[insertIndex]
    const order =
      previous && next
        ? (previous.order + next.order) / 2
        : previous
        ? previous.order + 1000
        : next
        ? next.order - 1000
        : task.order
    task = moveTaskStatus(
      task,
      status,
      nowIso(),
      order,
      doneForStatus(store, status),
    )
  }
  return {
    ok: true,
    result: { task },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? task : candidate,
        ),
      },
      [task.id],
      'Agent updated card',
    ),
  }
}

export function deleteTaskAgentMutation(
  store: TasksStore,
  input: { taskId: string },
): AgentMutationResult<{
  deletedTaskId: string
  deletedSnapshot: DeletedTaskSnapshot
}> {
  const task = requireTask(store, input.taskId)
  const activity = store.activity.filter(item => item.taskId === input.taskId)
  const deletedSnapshot: DeletedTaskSnapshot = { task, activity }
  return {
    ok: true,
    result: { deletedTaskId: input.taskId, deletedSnapshot },
    store: {
      ...store,
      tasks: store.tasks.filter(task => task.id !== input.taskId),
      activity: store.activity.filter(item => item.taskId !== input.taskId),
    },
  }
}

export function createTaskCommentAgentMutation(
  store: TasksStore,
  input: { taskId: string; text: string; authorName?: string },
): AgentMutationResult<{ comment: TaskComment }> {
  const task = requireTask(store, input.taskId)
  const text = input.text.trim()
  if (!text) throw new AgentTasksToolError('Comment text is required.')
  const at = nowIso()
  const comment: TaskComment = {
    id: createId('comment'),
    authorName: input.authorName?.trim() || 'Agent',
    text,
    createdAt: at,
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      comments: [...task.comments, comment],
    },
    at,
  )
  return {
    ok: true,
    result: { comment },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent added comment',
    ),
  }
}

export function updateTaskCommentAgentMutation(
  store: TasksStore,
  input: {
    taskId: string
    commentId: string
    text?: string
    authorName?: string
  },
): AgentMutationResult<{ comment: TaskComment }> {
  const task = requireTask(store, input.taskId)
  const existing = task.comments.find(comment => comment.id === input.commentId)
  if (!existing) {
    throw new AgentTasksToolError(`Unknown comment: ${input.commentId}`)
  }
  const at = nowIso()
  const updatedComment: TaskComment = {
    ...existing,
    ...(input.text !== undefined
      ? { text: input.text.trim() || existing.text }
      : {}),
    ...(input.authorName !== undefined
      ? { authorName: input.authorName.trim() || existing.authorName }
      : {}),
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      comments: task.comments.map(comment =>
        comment.id === updatedComment.id ? updatedComment : comment,
      ),
    },
    at,
  )
  return {
    ok: true,
    result: { comment: updatedComment },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent updated comment',
    ),
  }
}

export function deleteTaskCommentAgentMutation(
  store: TasksStore,
  input: { taskId: string; commentId: string },
): AgentMutationResult<{ deletedCommentId: string }> {
  const task = requireTask(store, input.taskId)
  if (!task.comments.some(comment => comment.id === input.commentId)) {
    throw new AgentTasksToolError(`Unknown comment: ${input.commentId}`)
  }
  const updated = updateTaskDetails(task, {
    comments: task.comments.filter(comment => comment.id !== input.commentId),
  })
  return {
    ok: true,
    result: { deletedCommentId: input.commentId },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent deleted comment',
    ),
  }
}

export function createTaskChecklistAgentMutation(
  store: TasksStore,
  input: { taskId: string; title: string; items?: string[] },
): AgentMutationResult<{ checklist: TaskChecklist }> {
  const task = requireTask(store, input.taskId)
  const title = input.title.trim()
  if (!title) throw new AgentTasksToolError('Checklist title is required.')
  const at = nowIso()
  const checklist: TaskChecklist = {
    id: createId('checklist'),
    title,
    items: (input.items ?? [])
      .map(text => text.trim())
      .filter(Boolean)
      .map(text => ({
        id: createId('checkitem'),
        text,
        done: false,
        createdAt: at,
        updatedAt: at,
      })),
    createdAt: at,
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      checklists: [...task.checklists, checklist],
    },
    at,
  )
  return {
    ok: true,
    result: { checklist },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent added checklist',
    ),
  }
}

export function updateTaskChecklistAgentMutation(
  store: TasksStore,
  input: { taskId: string; checklistId: string; title?: string },
): AgentMutationResult<{ checklist: TaskChecklist }> {
  const task = requireTask(store, input.taskId)
  const checklist = requireChecklist(task, input.checklistId)
  const at = nowIso()
  const updatedChecklist: TaskChecklist = {
    ...checklist,
    ...(input.title !== undefined
      ? { title: input.title.trim() || checklist.title }
      : {}),
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      checklists: task.checklists.map(candidate =>
        candidate.id === updatedChecklist.id ? updatedChecklist : candidate,
      ),
    },
    at,
  )
  return {
    ok: true,
    result: { checklist: updatedChecklist },
    store: {
      ...store,
      tasks: store.tasks.map(candidate =>
        candidate.id === task.id ? updated : candidate,
      ),
    },
  }
}

export function deleteTaskChecklistAgentMutation(
  store: TasksStore,
  input: { taskId: string; checklistId: string },
): AgentMutationResult<{ deletedChecklistId: string }> {
  const task = requireTask(store, input.taskId)
  requireChecklist(task, input.checklistId)
  const updated = updateTaskDetails(task, {
    checklists: task.checklists.filter(
      checklist => checklist.id !== input.checklistId,
    ),
  })
  return {
    ok: true,
    result: { deletedChecklistId: input.checklistId },
    store: {
      ...store,
      tasks: store.tasks.map(candidate =>
        candidate.id === task.id ? updated : candidate,
      ),
    },
  }
}

export function createTaskChecklistItemAgentMutation(
  store: TasksStore,
  input: {
    taskId: string
    checklistId: string
    text: string
    done?: boolean
  },
): AgentMutationResult<{ item: TaskChecklistItem }> {
  const task = requireTask(store, input.taskId)
  const checklist = requireChecklist(task, input.checklistId)
  const text = input.text.trim()
  if (!text) throw new AgentTasksToolError('Checklist item text is required.')
  const at = nowIso()
  const item: TaskChecklistItem = {
    id: createId('checkitem'),
    text,
    done: Boolean(input.done),
    createdAt: at,
    updatedAt: at,
  }
  const updatedChecklist: TaskChecklist = {
    ...checklist,
    items: [...checklist.items, item],
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      checklists: task.checklists.map(candidate =>
        candidate.id === checklist.id ? updatedChecklist : candidate,
      ),
    },
    at,
  )
  return {
    ok: true,
    result: { item },
    store: {
      ...store,
      tasks: store.tasks.map(candidate =>
        candidate.id === task.id ? updated : candidate,
      ),
    },
  }
}

export function updateTaskChecklistItemAgentMutation(
  store: TasksStore,
  input: {
    taskId: string
    checklistId: string
    itemId: string
    text?: string
    done?: boolean
  },
): AgentMutationResult<{ item: TaskChecklistItem }> {
  const task = requireTask(store, input.taskId)
  const checklist = requireChecklist(task, input.checklistId)
  const item = requireChecklistItem(checklist, input.itemId)
  const at = nowIso()
  const updatedItem: TaskChecklistItem = {
    ...item,
    ...(input.text !== undefined
      ? { text: input.text.trim() || item.text }
      : {}),
    ...(input.done !== undefined ? { done: input.done } : {}),
    updatedAt: at,
  }
  const updatedChecklist: TaskChecklist = {
    ...checklist,
    items: checklist.items.map(candidate =>
      candidate.id === updatedItem.id ? updatedItem : candidate,
    ),
    updatedAt: at,
  }
  const updated = updateTaskDetails(
    task,
    {
      checklists: task.checklists.map(candidate =>
        candidate.id === checklist.id ? updatedChecklist : candidate,
      ),
    },
    at,
  )
  return {
    ok: true,
    result: { item: updatedItem },
    store: {
      ...store,
      tasks: store.tasks.map(candidate =>
        candidate.id === task.id ? updated : candidate,
      ),
    },
  }
}

export function deleteTaskChecklistItemAgentMutation(
  store: TasksStore,
  input: { taskId: string; checklistId: string; itemId: string },
): AgentMutationResult<{ deletedItemId: string }> {
  const task = requireTask(store, input.taskId)
  const checklist = requireChecklist(task, input.checklistId)
  requireChecklistItem(checklist, input.itemId)
  const updatedChecklist: TaskChecklist = {
    ...checklist,
    items: checklist.items.filter(item => item.id !== input.itemId),
    updatedAt: nowIso(),
  }
  const updated = updateTaskDetails(task, {
    checklists: task.checklists.map(candidate =>
      candidate.id === checklist.id ? updatedChecklist : candidate,
    ),
  })
  return {
    ok: true,
    result: { deletedItemId: input.itemId },
    store: {
      ...store,
      tasks: store.tasks.map(candidate =>
        candidate.id === task.id ? updated : candidate,
      ),
    },
  }
}

export function addTaskResourceLinkAgentMutation(
  store: TasksStore,
  input: {
    taskId: string
    link: TaskResourceLinkInput
  },
): AgentMutationResult<{ link: TaskResourceLink }> {
  const task = requireTask(store, input.taskId)
  const link = normalizeResourceLink(input.link)
  const updated = updateTaskDetails(task, {
    links: [...task.links, link],
  })
  return {
    ok: true,
    result: { link },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent linked resource',
    ),
  }
}

export function removeTaskResourceLinkAgentMutation(
  store: TasksStore,
  input: { taskId: string; linkId: string },
): AgentMutationResult<{ removedLinkId: string }> {
  const task = requireTask(store, input.taskId)
  if (!task.links.some(link => link.id === input.linkId)) {
    throw new AgentTasksToolError(`Unknown resource link: ${input.linkId}`)
  }
  const updated = updateTaskDetails(task, {
    links: task.links.filter(link => link.id !== input.linkId),
  })
  return {
    ok: true,
    result: { removedLinkId: input.linkId },
    store: withAgentActivity(
      {
        ...store,
        tasks: store.tasks.map(candidate =>
          candidate.id === task.id ? updated : candidate,
        ),
      },
      [task.id],
      'Agent removed resource link',
    ),
  }
}

export function applyTaskBoardPatchAgentMutation(
  store: TasksStore,
  input: {
    operations: AgentBoardPatchOperation[]
    activeProjectId: string
    reason?: string
    dryRun?: boolean
  },
): AgentMutationResult<AgentBoardPatchSummary> {
  let next = store
  const applied: AgentBoardPatchSummary['applied'] = []
  for (const operation of input.operations) {
    let mutation: AgentMutationResult
    if (
      (REJECTED_PROJECT_PATCH_OPERATIONS as readonly string[]).includes(
        (operation as { type: string }).type,
      )
    ) {
      throw new AgentTasksToolError(
        `${(operation as { type: string }).type} is not a patch operation: a ` +
          '.tasks board holds exactly one project. Use createTaskProject, ' +
          'updateTaskProject, deleteTaskProject, or openTaskProject instead.',
      )
    }
    switch (operation.type) {
      case 'createColumn':
        mutation = createTaskColumnAgentMutation(next, operation)
        break
      case 'updateColumn':
        mutation = updateTaskColumnAgentMutation(next, operation)
        break
      case 'deleteColumn':
        mutation = deleteTaskColumnAgentMutation(next, operation)
        break
      case 'restoreColumn':
        mutation = restoreTaskColumnAgentMutation(next, operation)
        break
      case 'createTask':
        mutation = createTaskAgentMutation(
          next,
          operation,
          input.activeProjectId,
        )
        break
      case 'updateTask':
        mutation = updateTaskAgentMutation(next, operation)
        break
      case 'deleteTask':
        mutation = deleteTaskAgentMutation(next, operation)
        break
      case 'restoreTask':
        mutation = restoreTaskAgentMutation(next, operation)
        break
      case 'createTaskComment':
        mutation = createTaskCommentAgentMutation(next, operation)
        break
      case 'updateTaskComment':
        mutation = updateTaskCommentAgentMutation(next, operation)
        break
      case 'deleteTaskComment':
        mutation = deleteTaskCommentAgentMutation(next, operation)
        break
      case 'createTaskChecklist':
        mutation = createTaskChecklistAgentMutation(next, operation)
        break
      case 'updateTaskChecklist':
        mutation = updateTaskChecklistAgentMutation(next, operation)
        break
      case 'deleteTaskChecklist':
        mutation = deleteTaskChecklistAgentMutation(next, operation)
        break
      case 'createTaskChecklistItem':
        mutation = createTaskChecklistItemAgentMutation(next, operation)
        break
      case 'updateTaskChecklistItem':
        mutation = updateTaskChecklistItemAgentMutation(next, operation)
        break
      case 'deleteTaskChecklistItem':
        mutation = deleteTaskChecklistItemAgentMutation(next, operation)
        break
      case 'addTaskResourceLink':
        mutation = addTaskResourceLinkAgentMutation(next, operation)
        break
      case 'removeTaskResourceLink':
        mutation = removeTaskResourceLinkAgentMutation(next, operation)
        break
      default:
        throw new AgentTasksToolError(
          `Unknown patch operation: ${(operation as { type?: string }).type}.`,
        )
    }
    next = mutation.store
    applied.push({ type: operation.type, result: mutation.result })
  }
  // Only the cards the patch actually changed carry the reason, never
  // whichever twenty happen to sit first in the store.
  const touchedTaskIds = touchedTasks(store, next)
  if (input.reason && touchedTaskIds.length) {
    next = withAgentActivity(
      next,
      touchedTaskIds,
      `Agent applied board patch: ${input.reason}`,
    )
  }
  return {
    ok: true,
    result: {
      applied,
      ...(input.dryRun ? { dryRun: true as const } : {}),
      preview: boardPatchPreview(next, touchedTaskIds),
    },
    store: input.dryRun ? store : next,
  }
}

/** Ids of tasks created or changed between two store snapshots. */
export function touchedTasks(before: TasksStore, after: TasksStore): string[] {
  const previous = new Map(before.tasks.map(task => [task.id, task]))
  return after.tasks
    .filter(task => previous.get(task.id) !== task)
    .map(task => task.id)
}

export function boardPatchPreview(
  store: TasksStore,
  touchedTaskIds: string[],
): AgentBoardPatchPreview {
  return {
    columns: taskColumnsForStore(store).map(column => ({
      id: column.id,
      label: column.label,
      taskCount: store.tasks.filter(task => task.status === column.id).length,
    })),
    taskCount: store.tasks.length,
    touchedTaskIds,
  }
}
