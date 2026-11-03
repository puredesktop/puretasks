import { afterEach, describe, expect, it, vi } from 'vitest'

/** What this frame's window sees above it, for one load of the module. */
async function copy(parent: unknown, top: unknown) {
  vi.resetModules()
  vi.stubGlobal('window', Object.assign(Object.create(window), { parent, top, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) }))
  return import('./heldCopy')
}
const shell = { name: 'shell' }
const holder = { name: 'holder' }

afterEach(() => vi.unstubAllGlobals())

describe('a copy of the app', () => {
  it('nested in another app’s frame is held from its first line', async () => {
    const held = await copy(holder, shell)
    expect(held.isHeldCopy()).toBe(true)
  })

  it('hosted by the shell is taken for held until the shell says otherwise: nothing goes on a guess', async () => {
    const held = await copy(shell, shell)
    expect(held.isHeldCopy()).toBe(true)
    await held.findOutIfHeld(async () => null)
    expect(held.isHeldCopy()).toBe(false)
  })

  it('on the Personal agent’s page is told so, and stays held after Full app', async () => {
    const held = await copy(shell, shell)
    await held.findOutIfHeld(async () => ({ heldInRoom: true }))
    expect(held.isHeldCopy()).toBe(true)
    await held.findOutIfHeld(async () => null)
    expect(held.isHeldCopy()).toBe(true)
  })

  it('is a normal tab when the shell refuses or never answers', async () => {
    const refused = await copy(shell, shell)
    await refused.findOutIfHeld(async () => { throw new Error('too old') })
    expect(refused.isHeldCopy()).toBe(false)
    const silent = await copy(shell, shell)
    await silent.findOutIfHeld(() => new Promise(() => undefined), 5)
    expect(silent.isHeldCopy()).toBe(false)
  })

  it('a tab later taken into a page is held from then on', async () => {
    const held = await copy(shell, shell)
    await held.findOutIfHeld(async () => null)
    held.heardHeld()
    expect(held.isHeldCopy()).toBe(true)
  })
})
