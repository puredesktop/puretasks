import { describe, expect, it } from 'vitest'
import { createKeeper, type LeasePort } from './keeperLease'

/** The shell's conditional JSON store, one at a time as it is. */
function store() {
  let value: unknown = null, version: string | null = null, writes = 0
  const port: LeasePort = {
    read: async () => ({ value, version }),
    write: async (next, ifMatch) => {
      if (ifMatch !== version) return { ok: false, version }
      value = next; version = `v${++writes}`
      return { ok: true, version }
    },
  }
  return { port, writes: () => writes }
}
let clock = 1_000_000
const keeper = (port: LeasePort, id: string, held = false) => createKeeper(port, { id, isHeld: () => held, now: () => clock })

describe('who keeps the background work going', () => {
  it('of two copies asking at once, one', async () => {
    const { port } = store()
    const answers = await Promise.all([keeper(port, 'a')(), keeper(port, 'b')()])
    expect(answers.filter(Boolean)).toHaveLength(1)
  })

  it('stays with the copy that has it, which renews it, and a look in between costs nothing', async () => {
    const s = store()
    const a = keeper(s.port, 'a'), b = keeper(s.port, 'b')
    expect(await a()).toBe(true)
    expect(await a()).toBe(true)
    expect(s.writes()).toBe(1)
    expect(await b()).toBe(false)
    clock += 31_000
    expect(await a()).toBe(true)
    expect(s.writes()).toBe(2)
  })

  it('a held copy leaves it to a tab, and a tab takes it from a held copy at once', async () => {
    const { port } = store()
    const held = keeper(port, 'held', true), tab = keeper(port, 'tab')
    expect(await held()).toBe(true)
    expect(await tab()).toBe(true)
    clock += 31_000
    expect(await held()).toBe(false)
  })

  it('passes on when its holder has gone away', async () => {
    const { port } = store()
    const a = keeper(port, 'a'), b = keeper(port, 'b')
    expect(await a()).toBe(true)
    expect(await b()).toBe(false)
    clock += 91_000
    expect(await b()).toBe(true)
  })

  it('when the store cannot be reached, a tab carries on and a held copy does not', async () => {
    const broken: LeasePort = { read: async () => { throw new Error('no') }, write: async () => { throw new Error('no') } }
    expect(await keeper(broken, 'tab')()).toBe(true)
    expect(await keeper(broken, 'held', true)()).toBe(false)
  })
})
