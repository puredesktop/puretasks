// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

const suggestPeople = vi.fn(async () => [{
  name: 'Maya Chen',
  email: 'maya@example.test',
  sourceAppSlug: 'people',
  sourceLabel: 'People',
  providerId: 'people',
}])

vi.mock('../../bridge/platformBridge', () => ({ suggestPeople }))

const { OwnerPicker } = await import('./OwnerPicker')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null

afterEach(async () => {
  vi.useRealTimers()
  if (root) await act(async () => root!.unmount())
  root = null
  document.body.innerHTML = ''
  suggestPeople.mockClear()
})

it('searches PurePeople and assigns the chosen contact', async () => {
  vi.useFakeTimers()
  const onCommit = vi.fn()
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  function Harness(): React.ReactElement {
    const [value, setValue] = useState('')
    return <OwnerPicker value={value} onChange={setValue} onCommit={onCommit} />
  }

  await act(async () => root!.render(<Harness />))
  const input = container.querySelector('input')!
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'maya')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(160)
  })

  expect(suggestPeople).toHaveBeenCalledWith('maya')
  expect(container.textContent).toContain('maya@example.test')

  const option = container.querySelector('[role="option"]')!
  await act(async () => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))

  expect(onCommit).toHaveBeenCalledWith('Maya Chen')
  expect(input.value).toBe('Maya Chen')
})
