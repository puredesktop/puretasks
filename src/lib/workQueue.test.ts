import { expect, it } from 'vitest'
import { createTask, starterBoardStore } from './taskModel'
import { crossBoardTasks, taskRef, todayKey, workQueue } from './workQueue'

it('keeps undated general work, deadlines, review and blockers independent across boards', () => {
  const store = starterBoardStore('Garden')
  const task = (title: string, status = 'inbox') => createTask(store.projects[0].id, title, status)
  const chosen = task('Choose plants')
  const due = { ...task('Book delivery'), dueAt: todayKey() }
  const review = task('Check garden plan', 'review')
  const waiting = { ...task('Plant beds'), blockedBy: [chosen.id] }
  store.tasks = [chosen, due, review, waiting, task('Finished', 'done'), { ...task('Archived'), archivedAt: new Date().toISOString() }]
  store.columns = store.columns!.map(column => column.id === 'review' ? { ...column, label: 'Second look' } : column)
  const entries = crossBoardTasks([{ path: '/garden.tasks', name: 'Garden', isDraft: false, store }], '/another.tasks')
  const before = JSON.stringify(store)
  const queues = workQueue(entries, new Set([taskRef(entries[0])]))
  expect(queues.chosen.map(entry => entry.task.id)).toEqual([chosen.id])
  expect(queues.dueToday.map(entry => entry.task.id)).toEqual([due.id])
  expect(queues.review.map(entry => entry.task.id)).toEqual([review.id])
  expect(queues.waiting.map(entry => entry.task.id)).toEqual([waiting.id])
  expect(queues.available.map(entry => entry.task.id)).toEqual([due.id])
  expect(entries.every(entry => entry.foreign)).toBe(true)
  expect(JSON.stringify(store)).toBe(before)
})

it('supports custom review columns and keeps the legacy Personal backlog out of review', () => {
  const store = starterBoardStore('Personal')
  store.columns = [{ id: 'doing', label: 'Today' }, { id: 'inbox', label: 'This week' }, { id: 'review', label: 'Someday' }, { id: 'done', label: 'Done', done: true }]
  store.tasks = [createTask(store.projects[0].id, 'Learn pottery', 'review')]
  const entries = () => crossBoardTasks([{ path: '/personal.tasks', name: 'Personal', isDraft: false, store }], '/personal.tasks')
  expect(workQueue(entries(), new Set()).review).toEqual([])
  store.columns.push({ id: 'approval', label: 'Approval', review: true })
  store.columns.find(column => column.id === 'review')!.review = false
  store.tasks.push(createTask(store.projects[0].id, 'Check the plan', 'approval'))
  expect(workQueue(entries(), new Set()).review.map(entry => entry.task.title)).toEqual(['Check the plan'])
})

it('round-trips custom review participation in board packages and respects custom done flags', async () => {
  const { taskPackageContent, parseTaskPackageStore } = await import('./taskPackage')
  const { updateTaskColumnAgentMutation } = await import('./agentWriteTools')
  let store = starterBoardStore('Board')
  store = updateTaskColumnAgentMutation(store, { status: 'review', review: false }).store
  store = updateTaskColumnAgentMutation(store, { status: 'inbox', review: true }).store
  store.tasks = [createTask(store.projects[0].id, 'Review this', 'inbox'), createTask(store.projects[0].id, 'Work on this', 'review')]
  const reopened = parseTaskPackageStore(taskPackageContent(store, store.projects[0]))
  const entries = crossBoardTasks([{ path: '/board.tasks', name: 'Board', isDraft: false, store: reopened }], '/board.tasks/')
  expect(workQueue(entries, new Set()).review.map(entry => entry.task.title)).toEqual(['Review this'])
  expect(entries.some(entry => entry.foreign)).toBe(false)
})
