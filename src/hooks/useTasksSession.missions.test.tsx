// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTask, starterBoardStore } from '../lib/taskModel'
import { deferred } from '../test/deferred'
import type { TasksStore } from '../types'
const createMission = vi.fn()
const readMissionStatus = vi.fn()
vi.mock('../bridge/platformBridge', () => ({
  updateTasksSettings: async () => ({}), catalogOpen: async () => undefined,
  missionsAvailable: () => true, createMission, readMissionStatus, openMission: async () => undefined,
}))
const { useTasksSession } = await import('./useTasksSession')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let latest: ReturnType<typeof useTasksSession>
let mutations: TasksStore[]
function board(live = false) {
  const store = starterBoardStore('Board')
  const task = { ...createTask(store.projects[0].id, 'Card'), id: 'shared-card' }
  if (live) task.missions = [{ id: 'm1', title: 'Mission', phase: 'running', createdAt: task.createdAt }]
  return { ...store, tasks: [task] }
}
async function mount(store = board()) {
  function Probe() {
    latest = useTasksSession({ initialStore: store, initialSettings: {}, boardPath: '/fixture.tasks', onMutated: next => mutations.push(next) })
    return null
  }
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<Probe />))
}
beforeEach(() => { vi.useFakeTimers(); mutations = []; createMission.mockReset(); readMissionStatus.mockReset().mockResolvedValue({ phase: 'running' }) })
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers() })
it('does not attach a late mission to a different board with a reused card id', async () => {
  await mount()
  const gate = deferred<{ id: string }>(); createMission.mockReturnValue(gate.promise)
  let outcome!: Promise<unknown>
  await act(async () => { outcome = latest.createMissionForTask('shared-card', 'do').catch(error => error) })
  const next = board()
  await act(async () => { latest.replaceStore(next) })
  let result: unknown
  await act(async () => { gate.resolve({ id: 'm1' }); result = await outcome })
  expect(result).toBeInstanceOf(Error)
  expect((result as Error).message).toContain('Find the mission in Missions')
  expect(latest.readStore()).toBe(next)
  expect(mutations).toHaveLength(0)
})
it('does not create orphan activity if the original card was deleted', async () => {
  await mount()
  const gate = deferred<{ id: string }>(); createMission.mockReturnValue(gate.promise)
  const outcome = latest.createMissionForTask('shared-card', 'steps').catch(error => error)
  await act(async () => { await latest.deleteTask('shared-card') })
  await act(async () => { gate.resolve({ id: 'm1' }); await outcome })
  expect(latest.store.activity).toHaveLength(0)
  expect(mutations).toHaveLength(1)
})
it('records a mission on its original card while preserving concurrent edits', async () => {
  await mount()
  const gate = deferred<{ id: string }>(); createMission.mockReturnValue(gate.promise)
  const outcome = latest.createMissionForTask('shared-card', 'do')
  await act(async () => { await latest.updateTask('shared-card', { notes: 'Edited during creation' }) })
  await act(async () => { gate.resolve({ id: 'm1' }); await outcome })
  expect(latest.store.tasks[0]).toMatchObject({ notes: 'Edited during creation', missions: [{ id: 'm1', phase: 'running' }] })
  expect(latest.store.tasks[0].links[0].resourceId).toBe('m1')
})
it('ignores stale mission status after replacing the board, even with reused ids', async () => {
  const gate = deferred<{ phase: 'done' }>(); readMissionStatus.mockReturnValueOnce(gate.promise)
  await mount(board(true))
  const pending = latest.refreshMissions()
  const next = board(true)
  await act(async () => { latest.replaceStore(next) })
  await act(async () => { gate.resolve({ phase: 'done' }); await pending })
  expect(latest.readStore()).toBe(next)
  expect(mutations).toHaveLength(0)
})
it('coalesces polling and does not refetch status on task edits', async () => {
  const gate = deferred<{ phase: 'done' }>(); readMissionStatus.mockReturnValue(gate.promise)
  await mount(board(true))
  const a = latest.refreshMissions(), b = latest.refreshMissions()
  expect(a).toBe(b)
  await act(async () => { await latest.updateTask('shared-card', { notes: 'Draft' }); await latest.updateTask('shared-card', { title: 'Edited' }) })
  expect(readMissionStatus).toHaveBeenCalledTimes(1)
  await act(async () => { gate.resolve({ phase: 'done' }); await a; await b })
  expect(latest.store.tasks[0].missions[0].phase).toBe('done')
  expect(latest.store.activity.filter(entry => entry.type === 'mission')).toHaveLength(1)
})
it('does not undo a terminal update or record duplicate activity from an older read', async () => {
  const gate = deferred<{ phase: 'done' }>(); readMissionStatus.mockReturnValueOnce(gate.promise)
  await mount(board(true))
  const pending = latest.refreshMissions()
  await act(async () => { await latest.applyStoreUpdate(current => ({ ...current, tasks: current.tasks.map(task => ({ ...task, missions: task.missions.map(mission => ({ ...mission, phase: 'stopped' as const })) })) })) })
  const before = latest.readStore()
  await act(async () => { gate.resolve({ phase: 'done' }); await pending })
  expect(latest.readStore()).toBe(before)
})
it('reads a shared mission once and limits a large board to four reads', async () => {
  const store = board(true)
  store.tasks[0].missions = Array.from({ length: 11 }, (_, n) => ({ id: `m${n}`, title: String(n), phase: 'running', createdAt: store.tasks[0].createdAt }))
  store.tasks.push({ ...store.tasks[0], id: 'other-card' })
  let active = 0, peak = 0
  const gate = deferred<void>()
  readMissionStatus.mockImplementation(async () => { peak = Math.max(peak, ++active); await gate.promise; active--; return { phase: 'running' } })
  await mount(store)
  const pending = latest.refreshMissions()
  expect(readMissionStatus).toHaveBeenCalledTimes(4)
  await act(async () => { gate.resolve(); await pending })
  expect(peak).toBe(4)
  expect(readMissionStatus).toHaveBeenCalledTimes(11)
  expect(mutations).toHaveLength(0)
})
it('drops pending status work when the app unmounts', async () => {
  const gate = deferred<{ phase: 'done' }>(); readMissionStatus.mockReturnValueOnce(gate.promise)
  await mount(board(true))
  const pending = latest.refreshMissions()
  await act(async () => root.unmount())
  await act(async () => { gate.resolve({ phase: 'done' }); await pending })
  expect(mutations).toHaveLength(0)
})
