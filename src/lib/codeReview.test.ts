import { expect, it } from 'vitest'
import { DEFAULT_FILTERS, createTask, starterBoardStore, updateTaskDetails } from './taskModel'
import { createTaskAgentMutation, updateTaskAgentMutation, updateTaskColumnAgentMutation } from './agentWriteTools'
import { listTasksAgentSnapshot } from './agentReadTools'
import { parseTaskPackageStore, taskPackageContent } from './taskPackage'
function board() {
  const store = starterBoardStore('Review')
  store.tasks = [updateTaskDetails(createTask(store.projects[0].id, 'Work'), { ownerName: 'Maya', dueAt: '2026-09-20' })]
  return store
}
it('preserves owner and due date when an agent changes only title', () => {
  const store = board()
  const result = updateTaskAgentMutation(store, { taskId: store.tasks[0].id, title: 'Renamed', ownerName: undefined, dueAt: undefined })
  expect(result.result.task).toMatchObject({ title: 'Renamed', ownerName: 'Maya', dueAt: '2026-09-20' })
})
it('still supports explicitly clearing owner and due date', () => {
  const store = board()
  const result = updateTaskAgentMutation(store, { taskId: store.tasks[0].id, ownerName: '', dueAt: '' })
  expect(result.result.task.ownerName).toBeUndefined()
  expect(result.result.task.dueAt).toBeUndefined()
})
it('records completion when created in a completed column', () => {
  const store = board()
  const result = createTaskAgentMutation(store, { title: 'Finished', status: 'done' }, store.projects[0].id)
  expect(result.result.task.completedAt).toBeTruthy()
})
it('updates task completion when an agent changes column semantics', () => {
  const store = board()
  const completed = updateTaskColumnAgentMutation(store, { status: 'inbox', done: true }).store
  expect(completed.tasks[0].completedAt).toBeTruthy()
  expect(updateTaskColumnAgentMutation(completed, { status: 'inbox', done: false }).store.tasks[0].completedAt).toBeUndefined()
})
it('does not substitute the active board for an unknown explicit project', () => {
  const store = board()
  expect(() => listTasksAgentSnapshot({ store, activeProject: store.projects[0], filters: DEFAULT_FILTERS, projectId: 'missing' })).toThrow()
})
it.each([null, {}, { schemaVersion: 2, projects: [], tasks: [] }])('rejects invalid board packages: %j', raw => {
  expect(() => parseTaskPackageStore(JSON.stringify(raw))).toThrow()
})
it('rejects multiple projects instead of losing boards on next save', () => {
  const store = board()
  store.projects.push({ ...store.projects[0], id: 'second' })
  expect(() => parseTaskPackageStore(JSON.stringify(store))).toThrow()
})
it('round trips a valid single-board package', () => {
  const store = board()
  expect(parseTaskPackageStore(taskPackageContent(store, store.projects[0])).tasks).toEqual(store.tasks)
})
