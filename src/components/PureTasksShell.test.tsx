// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { starterBoardStore, createTask } from '../lib/taskModel'
import { deferred } from '../test/deferred'
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
async function mount(override: Partial<TasksSessionState> = {}, boardsError?: string, retry?: () => Promise<void>, settings: TasksAppSettings = {}) {
  const store = starterBoardStore('Fixture')
  store.tasks = [{ ...createTask(store.projects[0].id, 'New task'), notes: 'The older card' }]
  const board: TasksBoardApi = { title: 'Fixture', description: '', status: 'filed', path: '/fixture.tasks', savedLabel: 'Saved', rename: () => {}, setDescription: () => {}, newBoard: () => {}, openSwitcher: () => {} }
  function Probe() {
    latest = useTasksSession({ initialStore: store, initialSettings: {}, boardPath: board.path, onMutated: () => {} })
    return <PureTasksShell session={{ ...latest, ...override }} board={board} boards={[]} boardsLoading={false} boardsError={boardsError} onRetryBoards={retry} settings={settings} onOpenBoard={() => {}} onNewBoard={() => {}} />
  }
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root!.render(<Probe />))
}
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(text))! }
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = '' })
it('opens the newly created card rather than an older card with the same title', async () => {
  await mount()
  const oldId = latest.store.tasks[0].id
  await act(async () => button('+ Task').click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog).not.toBeNull()
  expect(dialog.textContent).not.toContain('The older card')
  expect(latest.selectedTask?.id).not.toBe(oldId)
  expect(latest.store.tasks).toHaveLength(2)
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
it('reports failed task creation through the existing toast', async () => {
  await mount({ createTask: async () => { throw new Error('Could not create the card') } })
  await act(async () => button('+ Task').click())
  expect(document.querySelector('[role="status"]')?.textContent).toBe('Could not create the card')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
it('offers Retry on the boards view without losing usable board controls', async () => {
  const retry = vi.fn(async () => undefined)
  await mount({}, 'Storage unavailable', retry)
  await act(async () => button('All boards').click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Storage unavailable')
  await act(async () => button('Retry').click())
  expect(retry).toHaveBeenCalledTimes(1)
  expect(button('Kanban')).toBeTruthy()
})
it('does not open a card from an old board after an asynchronous create returns', async () => {
  const gate = deferred<string | null>()
  await mount({ createTask: () => gate.promise })
  await act(async () => button('+ Task').click())
  await act(async () => { latest.replaceStore(starterBoardStore('Next')) })
  await act(async () => { gate.resolve('old-card'); await gate.promise })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
it('uses one link form and saves a resource link once', async () => {
  await mount()
  await act(async () => button('+ Task').click())
  expect(document.querySelector('form form')).toBeNull()
  const setInput = (placeholder: string, value: string) => {
    const input = document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await act(async () => { setInput('Link title', 'Workshop brief'); setInput('Path', '/fixture/brief.writer') })
  await act(async () => button('Add link').click())
  expect(latest.store.tasks[0].links).toHaveLength(1)
  expect(latest.store.tasks[0].links[0]).toMatchObject({ title: 'Workshop brief', path: '/fixture/brief.writer' })
})
it('hides and shows the sidebar and the card details, remembering each', async () => {
  updateTasksSettings.mockClear()
  await mount()
  const toggle = (label: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(document.querySelector('nav#tasks-rail')).not.toBeNull()
  expect(toggle('Hide sidebar')?.getAttribute('aria-expanded')).toBe('true')
  await act(async () => toggle('Hide sidebar')!.click())
  expect(document.querySelector('nav#tasks-rail')).toBeNull()
  expect(toggle('Show sidebar')?.getAttribute('aria-expanded')).toBe('false')
  expect(updateTasksSettings).toHaveBeenLastCalledWith({ railOpen: false })
  await act(async () => toggle('Show sidebar')!.click())
  expect(document.querySelector('nav#tasks-rail')).not.toBeNull()
  expect(updateTasksSettings).toHaveBeenLastCalledWith({ railOpen: true })

  await act(async () => button('+ Task').click())
  expect(document.querySelector('#card-details')).not.toBeNull()
  await act(async () => toggle('Hide card details')!.click())
  expect(document.querySelector('#card-details')).toBeNull()
  expect(toggle('Show card details')?.getAttribute('aria-expanded')).toBe('false')
  expect(updateTasksSettings).toHaveBeenLastCalledWith({ cardDetailsOpen: false })
})
it('starts with the panels the person left closed', async () => {
  await mount({}, undefined, undefined, { railOpen: false, cardDetailsOpen: false })
  expect(document.querySelector('nav#tasks-rail')).toBeNull()
  expect(document.querySelector('button[aria-label="Show sidebar"]')).not.toBeNull()
})
