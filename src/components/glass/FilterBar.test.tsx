// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { FilterBar } from './FilterBar'
import { starterBoardStore } from '../../lib/taskModel'
import type { TasksSessionState } from '../../hooks/useTasksSession'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let host: HTMLDivElement
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove() })
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  const store = starterBoardStore('Board A')
  const toast = vi.fn()
  const session = {
    store, activeProject: store.projects[0], filters: { query: '', status: 'all', label: '' },
    filterViews: [{ id: 'v', name: 'Review', filters: { owner: '', status: 'review', label: '' } }],
    columns: store.columns, labels: [], viewMode: 'board', saveFilterView: vi.fn(),
    updateFilterView: vi.fn(), deleteFilterView: vi.fn(),
  } as unknown as TasksSessionState
  const render = async () => { await act(async () => root!.render(createElement(FilterBar, {
    session, groupBy: 'none', swimlanes: 'none', onGroupBy: vi.fn(), onSwimlanes: vi.fn(),
    selection: new Set<string>(), onClearSelection: vi.fn(), onToast: toast, summary: 'No tasks',
  }))) }
  await render()
  const click = async (name: string) => { await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.textContent?.trim() === name).at(-1)!.click()) }
  return { session, toast, render, click }
}
it('waits for a view update and reports rejection without a success toast', async () => {
  const { session, toast, click } = await mount()
  let reject!: (error: Error) => void
  vi.mocked(session.updateFilterView).mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
  await click('Views (1)'); await click('Update')
  expect(toast).not.toHaveBeenCalled()
  await act(async () => reject(new Error('Could not update view')))
  expect(toast).toHaveBeenCalledWith('Could not update view')
  expect(host.querySelector('[data-popover]')).not.toBeNull()
})
it('keeps the entered name after failure and clears board-local controls on a switch', async () => {
  const { session, toast, render, click } = await mount()
  vi.mocked(session.saveFilterView).mockRejectedValue(new Error('Could not add view'))
  await click('Save view')
  const input = host.querySelector<HTMLInputElement>('input[aria-label="View name"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My review')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await click('Save view')
  expect(toast).toHaveBeenCalledWith('Could not add view')
  expect(input.value).toBe('My review')
  session.activeProject = { ...session.activeProject, id: 'board-b' }
  await render()
  expect(host.querySelector('[data-popover]')).toBeNull()
})
