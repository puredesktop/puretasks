import type { BoardIndexEntry } from '../hooks/useBoardsIndex'
import type { SuiteTask, TasksStore } from '../types'
import { dueBucket, isBlocked, isReviewStatus, taskColumnsForStore } from './taskModel'

export interface CrossTask { task: SuiteTask; board: BoardIndexEntry; store: TasksStore; done: boolean; foreign: boolean }

/** Every open card across every board, with where it lives. */
export function crossBoardTasks(boards: BoardIndexEntry[], openPath: string | null): CrossTask[] {
  const out: CrossTask[] = []
  for (const board of boards) {
    const store = board.store
    if (!store) continue
    const doneIds = new Set(taskColumnsForStore(store).filter(column => column.done).map(column => column.id))
    for (const task of store.tasks) {
      if (task.archivedAt) continue
      out.push({ task, board, store, done: doneIds.has(task.status), foreign: board.path.replace(/\/+$/, '') !== (openPath?.replace(/\/+$/, '') ?? null) })
    }
  }
  return out
}

export const todayKey = (date = new Date()): string => { const pad = (n: number): string => String(n).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
export const taskRef = (entry: CrossTask): string => `${entry.board.path.replace(/\/+$/, '')}#${entry.task.id}`

/** Choosing work never changes a due date. */
export function workQueue(entries: CrossTask[], chosen: ReadonlySet<string>) {
  const open = entries.filter(entry => !entry.done)
  return {
    chosen: open.filter(entry => chosen.has(taskRef(entry))),
    overdue: open.filter(entry => dueBucket(entry.task) === 'overdue'),
    dueToday: open.filter(entry => dueBucket(entry.task) === 'today'),
    waiting: open.filter(entry => isBlocked(entry.task, entry.store)),
    review: open.filter(entry => isReviewStatus(entry.store, entry.task.status)),
    available: open.filter(entry => !chosen.has(taskRef(entry)) && !isReviewStatus(entry.store, entry.task.status) && !isBlocked(entry.task, entry.store)),
  }
}
