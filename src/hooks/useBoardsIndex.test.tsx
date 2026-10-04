// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { TasksStore } from '../types'
import { starterBoardStore } from '../lib/taskModel'
import { deferred } from '../test/deferred'
const listTaskBoards = vi.fn()
vi.mock('../bridge/platformBridge', () => ({ listTaskBoards }))
const { useBoardsIndex } = await import('./useBoardsIndex')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let latest: ReturnType<typeof useBoardsIndex>
const store = starterBoardStore('Live board')
let readBoard = vi.fn<(path: string) => Promise<TasksStore>>()
function Probe({ path = '/open.tasks', enabled = true, openStore = store }: { path?: string; enabled?: boolean; openStore?: TasksStore }) {
  latest = useBoardsIndex({ readBoard, openPath: path, openStore, enabled })
  return null
}
async function render(props = {}) { await act(async () => root.render(<Probe {...props} />)) }
beforeEach(() => {
  vi.useFakeTimers()
  listTaskBoards.mockReset().mockResolvedValue([{ name: 'Disk', path: '/other.tasks', isDraft: false }])
  readBoard = vi.fn(async () => starterBoardStore('Disk'))
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers() })
it('uses the open session without rereading it from disk or on every edit', async () => {
  listTaskBoards.mockResolvedValue([{ name: 'Stale', path: '/open.tasks/', isDraft: false }])
  await render()
  const edited = { ...store, projects: [{ ...store.projects[0], name: 'Edited' }] }
  await render({ openStore: edited })
  expect(readBoard).not.toHaveBeenCalled()
  expect(listTaskBoards).toHaveBeenCalledTimes(1)
  expect(latest.boards[0]).toMatchObject({ name: 'Edited', store: edited, error: undefined })
})
it('shares simultaneous refreshes and limits native reads to four', async () => {
  listTaskBoards.mockResolvedValue(Array.from({ length: 13 }, (_, n) => ({ name: String(n), path: `/${n}.tasks` })))
  let active = 0, peak = 0
  const gate = deferred<void>()
  readBoard.mockImplementation(async () => { peak = Math.max(peak, ++active); await gate.promise; active--; return store })
  await render()
  let first!: Promise<void>, second!: Promise<void>
  await act(async () => { first = latest.refresh(); second = latest.refresh() })
  expect(first).toBe(second)
  expect(listTaskBoards).toHaveBeenCalledTimes(1)
  expect(readBoard).toHaveBeenCalledTimes(4)
  await act(async () => { gate.resolve(); await first })
  expect(peak).toBe(4)
  expect(latest.boards).toHaveLength(14)
  expect(latest.loading).toBe(false)
})
it('retains last results after list failure and clears the visible error on retry', async () => {
  await render()
  const previous = latest.boards.find(board => board.path === '/other.tasks')
  listTaskBoards.mockRejectedValueOnce(new Error('Connection unavailable'))
  await act(async () => { await latest.refresh() })
  expect(latest.error).toBe('Connection unavailable')
  expect(latest.loading).toBe(false)
  expect(latest.boards.find(board => board.path === '/other.tasks')).toBe(previous)
  await act(async () => { await latest.refresh() })
  expect(latest.error).toBe(null)
})
it('keeps an unreadable board discoverable without losing readable boards', async () => {
  listTaskBoards.mockResolvedValue([{ name: 'Bad', path: '/bad.tasks/' }, { name: 'Good', path: '/good.tasks' }])
  readBoard.mockImplementation(async path => { if (path === '/bad.tasks') throw new Error('Invalid content'); return store })
  await render()
  expect(latest.boards.find(board => board.path === '/bad.tasks')).toMatchObject({ store: null, error: 'Invalid content' })
  expect(latest.boards.find(board => board.path === '/good.tasks')?.store).toBe(store)
})
it('does not continue a stale scan or republish results after disabling', async () => {
  const gate = deferred<TasksStore>()
  listTaskBoards.mockResolvedValue(Array.from({ length: 12 }, (_, n) => ({ name: String(n), path: `/${n}.tasks` })))
  readBoard.mockReturnValue(gate.promise)
  await render()
  const pending = latest.refresh()
  await render({ enabled: false })
  await act(async () => { gate.resolve(store); await pending })
  expect(readBoard).toHaveBeenCalledTimes(4)
  expect(latest.boards).toHaveLength(1)
  expect(latest.loading).toBe(false)
})
it('polls other boards periodically rather than when the live store changes', async () => {
  await render()
  await render({ openStore: { ...store } })
  expect(listTaskBoards).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(listTaskBoards).toHaveBeenCalledTimes(2)
})
