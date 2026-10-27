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
    return <PureTasksShell session={{ ...latest, ...override }} board={board} boards={[{ path: '/fixture.tasks', name: 'Fixture', isDraft: false, store: latest.store }]} boardsLoading={false} boardsError={boardsError} onRetryBoards={retry} settings={settings} onOpenBoard={() => {}} onNewBoard={() => {}} />
  }
  const container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root!.render(<Probe />))
}
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(text))! }
function inputValue(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector)!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
async function capture(title: string) {
  await act(async () => button('+ Task').click())
  await act(async () => inputValue('#quick-task-title', title))
  await act(async () => button('Add task').click())
}
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = null; document.body.innerHTML = '' })
it('opens the newly created card rather than an older card with the same title', async () => {
  await mount()
  const oldId = latest.store.tasks[0].id
  await capture('New task')
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog).not.toBeNull()
  expect(dialog.textContent).not.toContain('The older card')
  expect(latest.selectedTask?.id).not.toBe(oldId)
  expect(latest.store.tasks).toHaveLength(2)
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
it('keeps the draft and reports failed creation in the capture form', async () => {
  await mount({ createTask: async () => { throw new Error('Could not create the card') } })
  await capture('New task')
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Could not create the card')
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
  await capture('New task')
  await act(async () => { latest.replaceStore(starterBoardStore('Next')) })
  await act(async () => { gate.resolve('old-card'); await gate.promise })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
it('uses one link form and saves a resource link once', async () => {
  await mount()
  await capture('New task')
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

  await capture('New task')
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

it('cancels capture without creating a placeholder and does not require owner or dates', async () => {
  await mount()
  await act(async () => button('+ Task').click())
  expect(latest.store.tasks).toHaveLength(1)
  expect(button('Add task').disabled).toBe(true)
  await act(async () => inputValue('#quick-task-title', 'Buy paint'))
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Cancel capture"]')!.click())
  expect(latest.store.tasks).toHaveLength(1)
  await capture('Buy paint')
  expect(latest.store.tasks[0]).toMatchObject({ title: 'Buy paint', status: 'inbox' })
  expect(latest.store.tasks[0].dueAt).toBeUndefined()
  expect(latest.store.tasks[0].ownerName).toBeUndefined()
})
it('chooses undated general work for Today without editing its deadline or leaving the board as default', async () => {
  await mount()
  expect(document.querySelector('[data-place="board"]')).not.toBeNull()
  const before = latest.store
  await act(async () => button('Today').click())
  await act(async () => button('Choose work').click())
  await act(async () => button('Choose for today').click())
  expect(document.body.textContent).toContain('Chosen for today')
  expect(button('Remove from today')).toBeTruthy()
  expect(latest.store).toBe(before)
  expect(updateTasksSettings).toHaveBeenLastCalledWith({ myDay: expect.any(Object) })
})
it('reviews a manual card with feedback and can then accept it', async () => {
  await mount()
  const id = latest.store.tasks[0].id
  await act(async () => { await latest.moveTask(id, 'review') })
  await act(async () => button('Review').click())
  await act(async () => button('Review card').click())
  expect(document.querySelector('[aria-label="Review decision"]')).not.toBeNull()
  await act(async () => button('Request changes').click())
  expect(button('Send back with feedback').disabled).toBe(true)
  await act(async () => {
    const input = document.querySelector<HTMLTextAreaElement>('[aria-label="Requested changes"]')!
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Check the measurements')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => button('Send back with feedback').click())
  expect(latest.store.tasks[0].status).toBe('doing')
  expect(latest.store.tasks[0].comments[0].text).toBe('Changes requested: Check the measurements')
  await act(async () => { await latest.moveTask(id, 'review') })
  await act(async () => button('Accept as done').click())
  expect(latest.store.tasks[0].status).toBe('done')
  expect(latest.store.tasks[0].comments[0].text).toBe('Review accepted.')
})
it('reports a failed Today settings write without pretending the choice was saved', async () => {
  await mount()
  await act(async () => button('Today').click())
  await act(async () => button('Choose work').click())
  updateTasksSettings.mockRejectedValueOnce(new Error('Settings unavailable'))
  await act(async () => button('Choose for today').click())
  expect(document.querySelector('[role="status"]')?.textContent).toContain('Could not save Today: Settings unavailable')
  expect(button('Remove from today')).toBeUndefined()
})
