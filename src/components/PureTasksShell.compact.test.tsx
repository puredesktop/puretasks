// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { createTask, starterBoardStore } from '../lib/taskModel'
import type { TasksSessionState } from '../hooks/useTasksSession'
import type { TasksBoardApi } from '../App'
import type { TasksAppSettings } from '../types'

vi.mock('../hooks/useAppearance', () => ({ useAppearance: () => 'solid' }))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformDeepLink', () => ({ usePlatformDeepLink: () => undefined }))
const updateTasksSettings = vi.hoisted(() => vi.fn(async (_patch: Record<string, unknown>) => ({})))
vi.mock('../bridge/platformBridge', () => ({ updateTasksSettings, catalogOpen: async () => undefined, suggestPeople: async () => [], missionsAvailable: () => false }))
const { useTasksSession } = await import('../hooks/useTasksSession')
const { PureTasksShell } = await import('./PureTasksShell')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let latest: TasksSessionState
let held = true
const store = starterBoardStore('The launch')
store.tasks = [
  { ...createTask(store.projects[0].id, 'Write the note'), status: 'inbox' },
  { ...createTask(store.projects[0].id, 'Pay the printer'), status: 'inbox', dueAt: '2001-01-01' },
]
const board: TasksBoardApi = { title: 'The launch', description: '', status: 'filed', path: '/launch.tasks', savedLabel: 'Saved', rename: () => {}, setDescription: () => {}, newBoard: () => {}, openSwitcher: () => {} }
const settings: TasksAppSettings = { place: 'upcoming' }

function Probe() {
  latest = useTasksSession({ initialStore: store, initialSettings: {}, boardPath: board.path, onMutated: () => {} })
  return <PureTasksShell session={latest} board={board} boards={[{ path: '/launch.tasks', name: 'The launch', isDraft: false, store: latest.store }]} boardsLoading={false} settings={settings} onOpenBoard={() => {}} onNewBoard={() => {}} compact={held} />
}
async function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<Probe />))
}
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes(text))
const capture = () => document.querySelector<HTMLInputElement>('[aria-label^="Add a card to"]')!

afterEach(async () => {
  held = true
  updateTasksSettings.mockClear()
  if (root) await act(async () => root!.unmount())
  document.body.innerHTML = ''
})

it('held in a page: the board, how it stands, and a line to add a card, with the whole chrome hidden and mounted', async () => {
  await mount()
  expect(document.querySelector('header h1')!.textContent).toBe('The launch')
  expect(document.querySelector('header .stand')!.textContent).toContain('1 overdue')
  expect(capture()).not.toBeNull()
  expect(document.body.textContent).toContain('Write the note')
  // whatever the full app was last on, here it is the board
  expect(document.querySelector('[data-place]')!.getAttribute('data-place')).toBe('board')
  const hidden = document.querySelectorAll('[data-compact="hide"]')
  expect(hidden.length).toBeGreaterThanOrEqual(3)
  expect(hidden[0]!.textContent).toContain('+ Task')
})

it('a card added here is on the board at once, and the line is ready for the next', async () => {
  await mount()
  const input = capture()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Book the room')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(latest.readStore().tasks.map(t => t.title)).toContain('Book the room')
  expect(document.body.textContent).toContain('Book the room')
  expect(capture().value).toBe('')
})

it('Today is one press away, and does not change what the full app comes back to', async () => {
  await mount()
  await act(async () => button('Today')!.click())
  expect(document.querySelector('[data-place]')!.getAttribute('data-place')).toBe('myDay')
  expect(document.body.textContent).toContain('Pay the printer')
  expect(updateTasksSettings).not.toHaveBeenCalled()
})

it('Full app gives the whole app back, in the place it was left, with the cards as they were', async () => {
  await mount()
  held = false
  await act(async () => root!.render(<Probe />))
  expect(document.querySelector('[data-compact]')).toBeNull()
  expect(capture()).toBeNull()
  expect(document.querySelector('[data-place]')!.getAttribute('data-place')).toBe('upcoming')
  expect(document.body.textContent).toContain('Pay the printer')
})
