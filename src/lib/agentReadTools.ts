import { visibleTasksForProject } from './taskModel'
import type {
  SuiteTask,
  TaskFilters,
  TaskProject,
  TaskStatus,
  TaskViewMode,
  TasksStore,
} from '../types'

export class AgentTasksToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentTasksToolError'
  }
}

export interface AgentTasksContextSnapshot {
  /** Bound `.tasks` package path; null while the board is unsaved. */
  storePath: string | null
  boardStatus: 'none' | 'draft' | 'filed'
  activeProject: {
    id: string
    name: string
    description: string
  } | null
  selectedTaskId: string | null
  filters: TaskFilters
  viewMode: TaskViewMode
  projectCount: number
  visibleTaskCount: number
  totalTaskCount: number
}

export interface AgentTaskRow {
  id: string
  title: string
  status: TaskStatus
  priority: SuiteTask['priority']
  labels: string[]
  dueAt?: string
  ownerName?: string
  linkCount: number
  updatedAt: string
}

export interface AgentTaskActivityRow {
  id: string
  taskId: string
  at: string
  type: string
  text: string
}

function resolveProject(
  store: TasksStore,
  projectId: string | null | undefined,
): TaskProject | null {
  if (projectId) {
    return store.projects.find(project => project.id === projectId) ?? null
  }
  return store.projects[0] ?? null
}

function resolveFilters(
  base: TaskFilters,
  patch?: Partial<TaskFilters>,
): TaskFilters {
  if (!patch) return base
  return {
    query: patch.query ?? base.query,
    status: patch.status ?? base.status,
    label: patch.label ?? base.label,
  }
}

function toTaskRow(task: SuiteTask): AgentTaskRow {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    labels: task.labels,
    dueAt: task.dueAt,
    ownerName: task.ownerName,
    linkCount: task.links.length,
    updatedAt: task.updatedAt,
  }
}

export function getTasksAgentContext(input: {
  storePath: string | null
  boardStatus: 'none' | 'draft' | 'filed'
  store: TasksStore
  activeProject: TaskProject | null
  selectedTaskId: string | null
  filters: TaskFilters
  viewMode: TaskViewMode
}): AgentTasksContextSnapshot {
  const activeProject = input.activeProject
  const visibleTaskCount = activeProject
    ? visibleTasksForProject(input.store, activeProject.id, input.filters)
        .length
    : 0

  return {
    storePath: input.storePath,
    boardStatus: input.boardStatus,
    activeProject: activeProject
      ? {
          id: activeProject.id,
          name: activeProject.name,
          description: activeProject.description,
        }
      : null,
    selectedTaskId: input.selectedTaskId,
    filters: input.filters,
    viewMode: input.viewMode,
    projectCount: input.store.projects.length,
    visibleTaskCount,
    totalTaskCount: input.store.tasks.length,
  }
}

export function listTasksAgentSnapshot(input: {
  store: TasksStore
  activeProject: TaskProject | null
  filters: TaskFilters
  projectId?: string | null
  status?: TaskStatus | 'all'
  query?: string
  label?: string
}): AgentTaskRow[] {
  const project =
    resolveProject(input.store, input.projectId) ?? input.activeProject
  if (!project) {
    throw new AgentTasksToolError('No task project is available.')
  }

  if (input.projectId && project.id !== input.projectId) {
    throw new AgentTasksToolError(`Unknown project: ${input.projectId}`)
  }
  const filters = resolveFilters(input.filters, {
    status: input.status,
    query: input.query,
    label: input.label,
  })

  return visibleTasksForProject(input.store, project.id, filters).map(toTaskRow)
}

export function getTaskAgentSnapshot(
  store: TasksStore,
  taskId: string,
): SuiteTask {
  const task = store.tasks.find(candidate => candidate.id === taskId)
  if (!task) throw new AgentTasksToolError(`Unknown task: ${taskId}`)
  return task
}

export function listTaskActivityAgentSnapshot(input: {
  store: TasksStore
  taskId?: string | null
  limit?: number
}): AgentTaskActivityRow[] {
  const limit =
    input.limit && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(200, Math.floor(input.limit)))
      : 50
  return input.store.activity
    .filter(item => (input.taskId ? item.taskId === input.taskId : true))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit)
}
