// @vitest-environment happy-dom
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTask, starterBoardStore } from './lib/taskModel'
import { deferred } from './test/deferred'
import { TASK_PACKAGE_CONTENT_FILE } from './constants'
import type { TasksBoardApi } from './App'
import type { TasksSessionState } from './hooks/useTasksSession'
const readTextFile = vi.fn()
const refresh = vi.fn(async () => undefined)
const flush = vi.fn(async () => undefined)
const boardA = starterBoardStore('A')
boardA.tasks = [{ ...createTask(boardA.projects[0].id, 'A card'), id: 'a-card' }]
let latest: { session: TasksSessionState; board: TasksBoardApi; initialOpenTaskId?: string; onOpenBoard: (path: string, taskId?: string) => void }
let mountedShells = 0
let switcher: { onOpenDocument: (path: string) => Promise<void> }
vi.mock('@purescience/platform-bridge/components/AppFrame', () => ({ AppFrame: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@purescience/platform-ui/components/common/feedback/EmptyState', () => ({ EmptyState: () => null }))
vi.mock('@purescience/platform-ui/components/common/documents', () => ({
  DocumentHeaderActions: () => null,
  DocumentSwitcher: (props: typeof switcher) => { switcher = props; return null },
}))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformBridge', () => ({ usePlatformBridge: () => ({ ready: true, meta: { viewport: { resource: { path: '/a.tasks' } }, methods: [] } }) }))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformViewportResource', () => ({ usePlatformViewportResource: () => ({ resource: null, clearResource: () => undefined }) }))
vi.mock('@purescience/platform-ui/bridge/react/useDocumentHotkeys', () => ({ useDocumentHotkeys: () => undefined }))
vi.mock('@purescience/platform-ui/bridge/react/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => {
    const [path, setPath] = useState<string | null>(null)
    return { doc: { path, status: path ? 'filed' : 'none', dirty: false, savedAt: null }, flush, adopt: setPath,
      markDirty: () => undefined, reset: () => setPath(null), ensureDraft: async () => path, rename: async () => undefined }
  },
}))
vi.mock('./hooks/usePureTasksBoot', () => ({ usePureTasksBoot: () => ({ boot: { appSettings: {} } }) }))
vi.mock('./hooks/usePureTasksAgentTools', () => ({ usePureTasksAgentTools: () => undefined }))
vi.mock('./hooks/useBoardsIndex', () => ({ useBoardsIndex: () => ({ boards: [], loading: false, error: null, refresh }) }))
vi.mock('./components/PureTasksShell', () => ({ PureTasksShell: (props: typeof latest) => { latest = props; useEffect(() => { mountedShells++ }, []); return <div>{props.board.title}:{props.initialOpenTaskId}</div> } }))
vi.mock('./bridge/platformBridge', () => ({
  isStandaloneDevMode: () => false, readTextFile, listTaskBoards: async () => [], deleteTaskBoard: async () => undefined,
  updateTasksSettings: async () => ({}), missionsAvailable: () => false, catalogOpen: async () => undefined,
}))
const { App } = await import('./App')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
beforeEach(async () => {
  readTextFile.mockReset().mockResolvedValue(JSON.stringify(boardA)); refresh.mockClear(); flush.mockClear()
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<App />))
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = '' })
function target(name: string, id: string) {
  const store = starterBoardStore(name)
  store.tasks = [{ ...createTask(store.projects[0].id, `${name} card`), id }]
  return JSON.stringify(store)
}
it('reveals a requested card on the already open board without rereading it', async () => {
  await act(async () => latest.onOpenBoard('/a.tasks/', 'a-card'))
  expect(latest.initialOpenTaskId).toBe('a-card')
  expect(readTextFile).toHaveBeenCalledTimes(1)
})
it('does not lose a newer requested card when an older read fails', async () => {
  const old = deferred<string>(), next = deferred<string>()
  readTextFile.mockImplementation(path => path === `/b.tasks/${TASK_PACKAGE_CONTENT_FILE}` ? old.promise : next.promise)
  await act(async () => latest.onOpenBoard('/b.tasks', 'b-card'))
  await act(async () => latest.onOpenBoard('/c.tasks', 'c-card'))
  expect(readTextFile).toHaveBeenCalledWith(`/b.tasks/${TASK_PACKAGE_CONTENT_FILE}`)
  expect(readTextFile).toHaveBeenCalledWith(`/c.tasks/${TASK_PACKAGE_CONTENT_FILE}`)
  await act(async () => old.reject(new Error('Missing old board')))
  await act(async () => next.resolve(target('C', 'c-card')))
  expect(latest.board.title).toBe('C')
  expect(latest.initialOpenTaskId).toBe('c-card')
})
it('cannot apply the newer card request to an older board that finishes first', async () => {
  const old = deferred<string>(), next = deferred<string>()
  readTextFile.mockImplementation(path => path === `/b.tasks/${TASK_PACKAGE_CONTENT_FILE}` ? old.promise : next.promise)
  await act(async () => latest.onOpenBoard('/b.tasks', 'b-card'))
  await act(async () => latest.onOpenBoard('/c.tasks', 'c-card'))
  expect(readTextFile).toHaveBeenCalledWith(`/b.tasks/${TASK_PACKAGE_CONTENT_FILE}`)
  expect(readTextFile).toHaveBeenCalledWith(`/c.tasks/${TASK_PACKAGE_CONTENT_FILE}`)
  await act(async () => old.resolve(target('B', 'b-card')))
  expect(latest.board.title).toBe('A')
  await act(async () => next.resolve(target('C', 'c-card')))
  expect(latest.board.title).toBe('C')
  expect(latest.initialOpenTaskId).toBe('c-card')
})
it('returning to the open board supersedes a pending foreign-board read', async () => {
  const pending = deferred<string>(); readTextFile.mockReturnValue(pending.promise)
  await act(async () => latest.onOpenBoard('/b.tasks', 'b-card'))
  await act(async () => latest.onOpenBoard('/a.tasks', 'a-card'))
  await act(async () => pending.resolve(target('B', 'b-card')))
  expect(latest.board.title).toBe('A')
  expect(latest.initialOpenTaskId).toBe('a-card')
})
it('does not carry the previous requested card into a normal board open', async () => {
  await act(async () => latest.onOpenBoard('/a.tasks', 'a-card'))
  readTextFile.mockResolvedValue(target('B', 'b-card'))
  await act(async () => { await switcher.onOpenDocument('/b.tasks') })
  expect(latest.board.title).toBe('B')
  expect(latest.initialOpenTaskId).toBeNull()
})
it('does not trigger an extra full index refresh from the app on mount or edits', async () => {
  await act(async () => { await latest.session.createTask('Edit') })
  expect(refresh).not.toHaveBeenCalled()
})

it('resets board-local overlays and selection when a copied board has reused project ids', async () => {
  const before = mountedShells
  const copy = { ...boardA, projects: [{ ...boardA.projects[0], name: 'Copy' }] }
  readTextFile.mockResolvedValue(JSON.stringify(copy))
  await act(async () => { await switcher.onOpenDocument('/copy.tasks') })
  expect(latest.board.title).toBe('Copy')
  expect(mountedShells).toBe(before + 1)
})
