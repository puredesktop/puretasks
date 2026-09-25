import { describe, expect, it } from 'vitest'
import {
  archiveDoneTasks,
  blocks,
  columnAtLimit,
  createTask,
  dueBucket,
  isBlocked,
  nextRepeatDue,
  normalizeTasksStore,
  openBlockers,
  starterBoardStore,
  subtasksOf,
  updateTaskDetails,
} from './taskModel'
import { createTaskAgentMutation, updateTaskAgentMutation, updateTaskColumnAgentMutation } from './agentWriteTools'
import { missionBrief } from './missions'
import type { TasksStore } from '../types'

function board(): TasksStore {
  const store = starterBoardStore('Launch', '2026-09-19T08:00:00Z')
  const project = store.projects[0].id
  const a = { ...createTask(project, 'Draft the one-pager', 'review', '2026-09-19T08:00:00Z'), id: 'task_a' }
  const b = { ...createTask(project, 'Ship companion mode', 'doing', '2026-09-19T08:00:00Z'), id: 'task_b', blockedBy: ['task_a'] }
  const c = { ...createTask(project, 'Field table', 'doing', '2026-09-19T08:00:00Z'), id: 'task_c', parentId: 'task_b' }
  const d = { ...createTask(project, 'Old done thing', 'done', '2026-08-01T08:00:00Z'), id: 'task_d', completedAt: '2026-08-01T09:00:00Z' }
  return { ...store, tasks: [a, b, c, d] }
}

describe('the new card fields', () => {
  it('normalises files written before they existed', () => {
    const raw = JSON.parse(JSON.stringify(board()))
    for (const task of raw.tasks) { delete task.blockedBy; delete task.missions }
    const store = normalizeTasksStore(raw)
    expect(store.tasks.every(task => Array.isArray(task.blockedBy) && Array.isArray(task.missions))).toBe(true)
  })
  it('knows what blocks what, and a done blocker no longer blocks', () => {
    const store = board()
    const b = store.tasks.find(task => task.id === 'task_b')!
    expect(openBlockers(b, store).map(task => task.id)).toEqual(['task_a'])
    expect(isBlocked(b, store)).toBe(true)
    expect(blocks(store.tasks[0], store).map(task => task.id)).toEqual(['task_b'])
    const cleared = { ...store, tasks: store.tasks.map(task => (task.id === 'task_a' ? { ...task, status: 'done' } : task)) }
    expect(isBlocked(cleared.tasks[1], cleared)).toBe(false)
  })
  it('lists subtasks and refuses a card as its own parent or blocker', () => {
    const store = board()
    expect(subtasksOf(store.tasks[1], store).map(task => task.id)).toEqual(['task_c'])
    const self = updateTaskDetails(store.tasks[1], { parentId: 'task_b', blockedBy: ['task_b', 'task_a'] })
    expect(self.parentId).toBeUndefined()
    expect(self.blockedBy).toEqual(['task_a'])
  })
  it('enforces a WIP limit on moves and creates unless forced', () => {
    const store = { ...board(), columns: board().columns?.map(column => (column.id === 'doing' ? { ...column, wipLimit: 2 } : column)) }
    expect(columnAtLimit(store, 'doing')).toBe(true)
    expect(() => updateTaskAgentMutation(store, { taskId: 'task_a', status: 'doing' })).toThrow(/WIP limit/)
    expect(updateTaskAgentMutation(store, { taskId: 'task_a', status: 'doing', force: true }).result.task.status).toBe('doing')
    expect(() => createTaskAgentMutation(store, { title: 'One more', status: 'doing' }, store.projects[0].id)).toThrow(/at its limit/)
    const lifted = updateTaskColumnAgentMutation(store, { status: 'doing', wipLimit: 0 }).store
    expect(columnAtLimit(lifted, 'doing')).toBe(false)
  })
  it('archives done cards past the window and keeps them in the file', () => {
    const store = archiveDoneTasks(board(), '2026-09-19T08:00:00Z')
    const old = store.tasks.find(task => task.id === 'task_d')!
    expect(old.archivedAt).toBe('2026-09-19T08:00:00Z')
    expect(store.tasks).toHaveLength(4)
    const never = archiveDoneTasks({ ...board(), projects: [{ ...board().projects[0], archiveDoneAfterDays: 0 }] }, '2026-09-19T08:00:00Z')
    expect(never.tasks.every(task => !task.archivedAt)).toBe(true)
  })
  it('schedules the next repeat ahead of today', () => {
    const from = new Date('2026-09-19T10:00:00')
    expect(nextRepeatDue('2026-09-18', 'daily', from)).toBe('2026-09-19')
    expect(nextRepeatDue('2026-09-01', 'weekly', from)).toBe('2026-09-22')
    expect(nextRepeatDue('2026-08-19', 'monthly', from)).toBe('2026-09-19')
    expect(nextRepeatDue('2026-09-18', 'none', from)).toBeUndefined()
  })
  it('buckets due dates', () => {
    const from = new Date('2026-09-19T10:00:00')
    expect(dueBucket({ dueAt: '2026-09-18' }, from)).toBe('overdue')
    expect(dueBucket({ dueAt: '2026-09-19' }, from)).toBe('today')
    expect(dueBucket({ dueAt: '2026-09-20' }, from)).toBe('tomorrow')
    expect(dueBucket({ dueAt: '2026-09-25' }, from)).toBe('week')
    expect(dueBucket({ dueAt: '2026-10-25' }, from)).toBe('later')
    expect(dueBucket({}, from)).toBe('none')
  })
  it('writes a mission brief that names the board, the card and the allowed tools', () => {
    const store = board()
    const brief = missionBrief('steps', store.tasks[1], '/Users/developer/Pure/Launch.tasks', store.columns ?? [])
    expect(brief.title).toBe('Ship companion mode')
    expect(brief.instructions).toContain('card task_b on board /Users/developer/Pure/Launch.tasks')
    expect(brief.instructions).toContain('createTaskChecklistItem')
    expect(brief.instructions).not.toContain('move the card to the Review')
    expect(missionBrief('do', store.tasks[1], null, store.columns ?? []).instructions).toContain('Review column')
  })
})
