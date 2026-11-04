// @vitest-environment happy-dom
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTask, starterBoardStore } from './lib/taskModel'
import { TASK_PACKAGE_CONTENT_FILE } from './constants'
import type { TasksSessionState } from './hooks/useTasksSession'

const held = vi.hoisted(() => ({
  handler: null as null | ((command: string, text: string) => Promise<{ ok: boolean; say?: string }>),
  resource: '/launch.tasks' as string | null,
  lastBoardPath: undefined as string | undefined,
  readTextFile: undefined as unknown as ReturnType<typeof vi.fn>,
}))
let latest: { session: TasksSessionState }
const board = starterBoardStore('Launch plan')
board.tasks = [{ ...createTask(board.projects[0].id, 'A card'), id: 'a-card' }]
const flush = vi.fn(async () => undefined)
const ensureDraft = vi.fn(async () => null)
vi.mock('@purescience/platform-ui/bridge/react/heldCommand', () => ({
  useHeldCommand: (handler: typeof held.handler) => { held.handler = handler },
}))
vi.mock('@purescience/platform-bridge/components/AppFrame', () => ({ AppFrame: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@purescience/platform-ui/components/common/feedback/EmptyState', () => ({ EmptyState: () => null }))
vi.mock('@purescience/platform-ui/components/common/documents', () => ({ DocumentHeaderActions: () => null, DocumentSwitcher: () => null }))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformBridge', () => ({
  usePlatformBridge: () => ({ ready: true, meta: { viewport: { resource: held.resource ? { path: held.resource } : null }, methods: [] } }),
}))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformViewportResource', () => ({ usePlatformViewportResource: () => ({ resource: null, clearResource: () => undefined }) }))
vi.mock('@purescience/platform-ui/bridge/react/useDocumentHotkeys', () => ({ useDocumentHotkeys: () => undefined }))
vi.mock('@purescience/platform-ui/bridge/react/useDocumentLifecycle', () => ({
  useDocumentLifecycle: () => {
    const [path, setPath] = useState<string | null>(null)
    return { doc: { path, status: path ? 'filed' : 'none', dirty: false, savedAt: null }, flush, adopt: setPath,
      markDirty: () => undefined, reset: () => setPath(null), ensureDraft, rename: async () => undefined }
  },
}))
vi.mock('./hooks/usePureTasksBoot', () => ({ usePureTasksBoot: () => ({ boot: { appSettings: held.lastBoardPath ? { lastBoardPath: held.lastBoardPath } : {} } }) }))
vi.mock('./hooks/usePureTasksAgentTools', () => ({ usePureTasksAgentTools: () => undefined }))
vi.mock('./hooks/useBoardsIndex', () => ({ useBoardsIndex: () => ({ boards: [], loading: false, error: null, refresh: async () => undefined }) }))
vi.mock('./components/PureTasksShell', () => ({ PureTasksShell: (props: typeof latest) => { latest = props; return null } }))
vi.mock('./bridge/platformBridge', () => ({
  isStandaloneDevMode: () => false, askIfHeld: async () => null, onClosingTab: () => () => undefined, readTextFile: (path: string) => held.readTextFile(path),
  listTaskBoards: async () => [], deleteTaskBoard: async () => undefined, updateTasksSettings: async () => ({}), missionsAvailable: () => false, catalogOpen: async () => undefined,
}))
const { App } = await import('./App')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
async function start() {
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<App />))
}
const tell = (command: string, text = '') => act(async () => held.handler!(command, text))
const titles = () => latest.session.readStore().tasks.map(task => task.title)

beforeEach(() => {
  held.handler = null; held.resource = '/launch.tasks'; held.lastBoardPath = undefined
  held.readTextFile = vi.fn(async () => JSON.stringify(board))
  flush.mockClear(); ensureDraft.mockClear()
})
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = '' })

it('adds a task to the open board and says where it went', async () => {
  await start()
  const answer = await tell('add', 'Write the plan by Friday')
  expect(answer.ok).toBe(true)
  expect(answer.say).toMatch(/^Added “Write the plan by Friday” to Launch plan, in .+\.$/)
  expect(titles()).toContain('Write the plan by Friday')
  expect(titles()).toContain('A card')
})

it('adds to the board it comes back to when none was given', async () => {
  held.resource = null; held.lastBoardPath = '/last.tasks'
  await start()
  const answer = await tell('add', 'Call the printer')
  expect(answer.ok).toBe(true)
  expect(held.readTextFile).toHaveBeenCalledWith(`/last.tasks/${TASK_PACKAGE_CONTENT_FILE}`)
  expect(titles()).toContain('Call the printer')
})

it('with no board, says so plainly and makes none', async () => {
  held.resource = null
  await start()
  const answer = await tell('add', 'Write the plan')
  expect(answer).toEqual({ ok: false, say: 'There’s no board open here to add to. Open or make one in Tasks first.' })
  expect(titles()).toEqual([])
  expect(ensureDraft).not.toHaveBeenCalled()
})

it('waits for the board to be read before it answers', async () => {
  let release!: () => void
  held.readTextFile = vi.fn(() => new Promise<string>(resolve => { release = () => resolve(JSON.stringify(board)) }))
  await start()
  let answered: { ok: boolean; say?: string } | null = null
  const pending = held.handler!('add', 'Early bird').then(answer => { answered = answer })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
  expect(answered).toBeNull()
  await act(async () => { release(); await pending })
  expect(answered).toMatchObject({ ok: true })
  expect(titles()).toContain('Early bird')
})

it('asks for words when there are none, and refuses what it does not know', async () => {
  await start()
  expect(await tell('add', '  ')).toEqual({ ok: false, say: 'Say what to add, like: Write the plan by Friday.' })
  expect((await tell('delete', 'everything')).ok).toBe(false)
  expect(titles()).toEqual(['A card'])
})

it('says why when the board will not take it', async () => {
  await start()
  await act(async () => { await latest.session.patchColumn('inbox', { wipLimit: 1 }) })
  const answer = await tell('add', 'One too many')
  expect(answer.ok).toBe(false)
  expect(answer.say).toMatch(/at its limit/)
})

it('takes a meeting’s actions as tasks, and can take them back', async () => {
  await start()
  const answer = await tell('take', JSON.stringify({ kind: 'actions', items: [{ title: 'Call Dana', owner: 'Sam' }, { title: 'Send pack', due: 'Fri' }] })) as unknown as { ok: boolean; say: string; undo: string }
  expect(answer.ok).toBe(true)
  expect(answer.say).toContain('2 tasks')
  expect(titles()).toEqual(expect.arrayContaining(['Call Dana (Sam)', 'Send pack (by Fri)']))
  const back = await tell('undo', answer.undo) as unknown as { ok: boolean; say: string }
  expect(back.ok).toBe(true)
  expect(titles()).not.toContain('Call Dana (Sam)')
  expect((await tell('undo', answer.undo) as unknown as { say: string }).say).toContain('already')
})

it('takes nothing when there is nothing to take', async () => {
  await start()
  expect(await tell('take', JSON.stringify({ kind: 'file', path: '/x' }))).toMatchObject({ ok: false })
  expect(await tell('take', 'junk')).toMatchObject({ ok: false })
})
