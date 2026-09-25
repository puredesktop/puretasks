export type TaskStatus = string

export type TaskPriority = 'low' | 'normal' | 'high'

export type TaskViewMode =
  | 'board'
  | 'list'
  | 'calendar'
  | 'timeline'
  | 'files'
  | 'activity'

export type TaskLinkType =
  | 'file'
  | 'writer'
  | 'book'
  | 'chapter'
  | 'chat-message'
  | 'agent-run'
  | 'mail'
  | 'video'
  | 'calendar'
  | 'issue'
  | 'canvas'
  | 'sheets'
  | 'mission'

/** How often a done task comes back. */
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

/** A mission created from a card: the card is its brief, the mission runs in the shell. */
export interface TaskMission {
  id: string
  title: string
  createdAt: string
  /** The shell's last reported phase, refreshed while the board is open. */
  phase?: 'planning' | 'planned' | 'running' | 'needsYou' | 'done' | 'failed' | 'stopped' | 'missing'
  checkedAt?: string
}

export interface TaskProject {
  id: string
  name: string
  description: string
  /** Done cards are archived (hidden from the board, kept in the file) after this many days; 0 = never. */
  archiveDoneAfterDays?: number
  createdAt: string
  updatedAt: string
}

export interface TaskColumn {
  id: TaskStatus
  label: string
  collapsed?: boolean
  hidden?: boolean
  done?: boolean
  /** Work-in-progress limit: a drop into a full column is refused (0 or absent = no limit). */
  wipLimit?: number
}

export interface TaskResourceLink {
  id: string
  type: TaskLinkType
  title: string
  path?: string
  appSlug?: string
  resourceId?: string
}

export interface TaskChecklistItem {
  id: string
  text: string
  done: boolean
  createdAt: string
  updatedAt: string
}

export interface TaskChecklist {
  id: string
  title: string
  items: TaskChecklistItem[]
  createdAt: string
  updatedAt: string
}

export interface TaskComment {
  id: string
  authorName: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface SuiteTask {
  id: string
  projectId: string
  title: string
  notes: string
  status: TaskStatus
  order: number
  priority: TaskPriority
  ownerName?: string
  labels: string[]
  dueAt?: string
  links: TaskResourceLink[]
  checklists: TaskChecklist[]
  comments: TaskComment[]
  /** Cards this one waits on; it clears itself when they are all done. */
  blockedBy: string[]
  /** The card this one is a subtask of. */
  parentId?: string
  estimateHours?: number
  loggedHours?: number
  repeat?: TaskRepeat
  /** ISO time to be reminded; the shell's notification fires it. */
  remindAt?: string
  missions: TaskMission[]
  /** Set when a done card leaves the board (kept in the file, restorable). */
  archivedAt?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface TaskActivity {
  id: string
  taskId: string
  at: string
  type: string
  text: string
}

/**
 * One `.tasks` package holds exactly one board: `projects` always carries a
 * single project (the board), and every task belongs to it.
 */
export interface TasksStore {
  schemaVersion: 1
  projects: TaskProject[]
  columns?: TaskColumn[]
  tasks: SuiteTask[]
  activity: TaskActivity[]
}

export interface TaskFilters {
  query: string
  status: TaskStatus | 'all'
  label: string
  /** '' | 'overdue' | 'today' | 'week' | 'none' */
  due?: string
  /** '' | TaskPriority */
  priority?: string
}

/** Where the app is: one board, or a cross-board place. */
export type TasksPlace = 'board' | 'myDay' | 'upcoming' | 'boards'
/** The look: frosted over the desk, or flat paper on a plain ground. Unset follows the system. */
export type TasksAppearance = 'glass' | 'solid'

export interface TasksAppSettings {
  selectedTaskId?: string
  viewMode?: TaskViewMode
  filters?: Partial<TaskFilters>
  /** Last opened `.tasks` board package, reopened on boot. */
  lastBoardPath?: string
  place?: TasksPlace
  /** My day: task refs (`<boardPath>#<taskId>`) chosen per ISO date. */
  myDay?: Record<string, string[]>
  groupBy?: 'none' | 'owner' | 'label' | 'priority' | 'due'
  swimlanes?: 'none' | 'owner' | 'label' | 'priority'
}

export interface PlatformAppSettingsUpdateRequest {
  appSlug: string
  patch: Record<string, unknown>
}

export interface PureTasksBootState {
  appSettings: TasksAppSettings
}

export interface CatalogOpenRequest {
  path: string
  name?: string
  appSlug?: string
}

/** A `.tasks` board package known to the shell (the document switcher's list). */
export interface TaskBoardListEntry {
  path: string
  name: string
  isDraft: boolean
}
