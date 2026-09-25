import type {
  SuiteTask,
  TaskBoardListEntry,
  TaskFilters,
  TaskProject,
  TaskViewMode,
  TasksStore,
} from '../types'

/**
 * Board (package) operations the tools share with the UI. Each one is the
 * same code path the header controls and the document switcher call — the
 * tools never reach the store or the filesystem another way.
 */
export interface TasksAgentBoardApi {
  /** Bound `.tasks` package path, or null while the board is unsaved. */
  path: string | null
  status: 'none' | 'draft' | 'filed'
  /** Every `.tasks` package the shell knows about (drafts included). */
  list: () => Promise<TaskBoardListEntry[]>
  /** Start a new board, file its draft, and make it the open board. */
  create: (
    name: string,
    description?: string,
  ) => Promise<{ path: string | null; project: TaskProject }>
  /** Open another `.tasks` package (flushes the current board first). */
  open: (path: string) => Promise<void>
  /** Rename the open board — project name and package folder together. */
  rename: (name: string) => void
  setDescription: (description: string) => void
  /** Delete a board package that is not the open one. */
  delete: (path: string) => Promise<void>
  /** Done cards leave the board after this many days (0 = never). */
  setArchiveDoneAfterDays: (days: number) => void
  /** The card becomes a mission the shell runs; recorded on the card. */
  createMission: (taskId: string, kind: 'do' | 'steps' | 'draft' | 'dependencies') => Promise<{ id: string; title: string }>
}

/** Tab-scoped values agent handlers read and the one write path they use. */
export interface TasksAgentToolContext {
  storePath: string | null
  /** Live store — read through a ref, never a render-time snapshot. */
  readonly store: TasksStore
  activeProject: TaskProject
  selectedTask: SuiteTask | null
  filters: TaskFilters
  viewMode: TaskViewMode
  board: TasksAgentBoardApi
  /**
   * Apply a mutation atomically against the live store. The producer runs
   * synchronously over the current store, so two tool calls arriving in the
   * same tick compose instead of the second overwriting the first.
   */
  applyStoreUpdate: (
    producer: (current: TasksStore) => TasksStore,
  ) => Promise<TasksStore>
}
