import { beforeEach, describe, expect, it } from 'vitest'
import type { SuiteTask, TasksStore } from '../types'
import { BoardFile } from './boardFile'
import { createTask, starterBoardStore } from './taskModel'
import { parseTaskPackageStore, taskPackageContent } from './taskPackage'

/**
 * Two live copies of PureTasks over one board: a normal tab and a copy held inside a page. Each test runs two real
 * BoardFiles over one fake package, with its revision checked at the write as the document service does. Every read and
 * write takes a turn of the event loop, as the shell's do, so two copies' saves really can interleave.
 */
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const at = (seconds: number) => new Date(Date.UTC(2026, 10, 1, 10, 0, seconds)).toISOString()

let disk: { text: string; writes: number }

function copy() {
  let store = parseTaskPackageStore(disk.text)
  const file = new BoardFile({ readStore: () => store, takeIn: next => { store = next } }, {
    read: async () => { const text = disk.text; await tick(); return text },
    write: async (next, revision, expected) => {
      await tick()
      const now = (JSON.parse(disk.text) as { revision?: string }).revision ?? null
      if (now !== expected) throw new Error('Save conflict: this document changed in another window.')
      disk.text = taskPackageContent(next, next.projects[0]!, revision)
      disk.writes++
    },
  })
  file.opened(disk.text)
  return {
    file,
    get store() { return store },
    change(f: (s: TasksStore) => TasksStore) { store = f(store) },
    add(title: string, seconds = 1) { store = { ...store, tasks: [...store.tasks, { ...createTask(store.projects[0]!.id, title), id: `card-${title}`, updatedAt: at(seconds) }] } },
    edit(id: string, patch: Partial<SuiteTask>, seconds = 1) { store = { ...store, tasks: store.tasks.map(t => (t.id === id ? { ...t, ...patch, updatedAt: at(seconds) } : t)) } },
    remove(id: string) { store = { ...store, tasks: store.tasks.filter(t => t.id !== id) } },
  }
}
const onDisk = () => parseTaskPackageStore(disk.text)
const card = (s: TasksStore, id: string) => s.tasks.find(t => t.id === id)

beforeEach(() => {
  const start = starterBoardStore('Fixture')
  start.tasks = ['one', 'two'].map(name => ({ ...createTask(start.projects[0]!.id, name), id: name, updatedAt: at(0) }))
  disk = { text: taskPackageContent(start, start.projects[0]!), writes: 0 }
})

describe('two copies, one after the other, neither having looked', () => {
  it('both add a card: both survive', async () => {
    const a = copy(), b = copy()
    a.add('from-a'); await a.file.save()
    b.add('from-b'); await b.file.save()
    expect(onDisk().tasks.map(t => t.id)).toEqual(expect.arrayContaining(['one', 'two', 'card-from-a', 'card-from-b']))
  })

  it('both edit different cards: both survive', async () => {
    const a = copy(), b = copy()
    a.edit('one', { notes: 'from a' }); await a.file.save()
    b.edit('two', { notes: 'from b' }, 2); await b.file.save()
    expect(card(onDisk(), 'one')!.notes).toBe('from a')
    expect(card(onDisk(), 'two')!.notes).toBe('from b')
  })

  it('different fields of one card: both stay', async () => {
    const a = copy(), b = copy()
    a.edit('one', { notes: 'from a' }, 1); await a.file.save()
    b.edit('one', { priority: 'high' }, 2); await b.file.save()
    expect(card(onDisk(), 'one')).toMatchObject({ notes: 'from a', priority: 'high' })
  })

  it('both change the same field: the newer stays, whichever saved last', async () => {
    const a = copy(), b = copy()
    a.edit('one', { notes: 'newer' }, 5); await a.file.save()
    b.edit('one', { notes: 'older' }, 2); await b.file.save()
    expect(card(onDisk(), 'one')!.notes).toBe('newer')
  })

  it('a card one copy deleted stays deleted, and what the other changed elsewhere stays', async () => {
    const a = copy(), b = copy()
    a.remove('one'); await a.file.save()
    b.edit('two', { notes: 'from b' }); await b.file.save()
    expect(card(onDisk(), 'one')).toBeUndefined()
    expect(card(onDisk(), 'two')!.notes).toBe('from b')
    expect(card(b.store, 'one')).toBeUndefined()
  })

  it('both comment on one card: both comments stay', async () => {
    const a = copy(), b = copy()
    const comment = (id: string) => ({ id, authorName: 'x', text: id, createdAt: at(1), updatedAt: at(1) })
    a.edit('one', { comments: [comment('ca')] }); await a.file.save()
    b.edit('one', { comments: [comment('cb')] }, 2); await b.file.save()
    expect(card(onDisk(), 'one')!.comments.map(c => c.id).sort()).toEqual(['ca', 'cb'])
  })

  it('one ticks a step and the other adds one to the same checklist: both stay', async () => {
    const start = onDisk()
    const item = (id: string, done = false) => ({ id, text: id, done, createdAt: at(0), updatedAt: at(0) })
    const list = { id: 'l', title: 'Steps', items: [item('s1')], createdAt: at(0), updatedAt: at(0) }
    disk.text = taskPackageContent({ ...start, tasks: start.tasks.map(t => (t.id === 'one' ? { ...t, checklists: [list] } : t)) }, start.projects[0]!)
    const a = copy(), b = copy()
    a.edit('one', { checklists: [{ ...list, items: [{ ...item('s1'), done: true, updatedAt: at(1) }] }] }); await a.file.save()
    b.edit('one', { checklists: [{ ...list, items: [item('s1'), item('s2')] }] }, 2); await b.file.save()
    const items = card(onDisk(), 'one')!.checklists[0]!.items
    expect(items.find(x => x.id === 's1')!.done).toBe(true)
    expect(items.map(x => x.id)).toContain('s2')
  })

  it('a column one copy added and a rename the other made both stay', async () => {
    const a = copy(), b = copy()
    a.change(s => ({ ...s, columns: [...(s.columns ?? []), { id: 'new', label: 'New' }] })); await a.file.save()
    b.change(s => ({ ...s, projects: [{ ...s.projects[0]!, name: 'Renamed' }] })); await b.file.save()
    expect(onDisk().columns!.map(c => c.id)).toContain('new')
    expect(onDisk().projects[0]!.name).toBe('Renamed')
  })
})

describe('two copies at the same moment', () => {
  it('both add a card: both survive, and each sees both on its next look', async () => {
    const a = copy(), b = copy()
    a.add('from-a'); b.add('from-b')
    await Promise.all([a.file.save(), b.file.save()])
    expect(onDisk().tasks.map(t => t.id)).toEqual(expect.arrayContaining(['card-from-a', 'card-from-b']))
    await Promise.all([a.file.pickUp(), b.file.pickUp()])
    expect(a.store.tasks).toHaveLength(4)
    expect(b.store.tasks).toHaveLength(4)
  })

  it('a run of changes from both, shuffled together: every one is there', async () => {
    const a = copy(), b = copy()
    await Promise.all(Array.from({ length: 12 }, async (_, i) => {
      const c = i % 2 ? a : b
      c.add(`n${i}`)
      await c.file.save()
    }))
    for (let i = 0; i < 12; i++) expect(card(onDisk(), `card-n${i}`)).toBeDefined()
  })
})

describe('a save with nothing to say', () => {
  it('writes nothing: a copy that changed nothing never rewrites the file', async () => {
    const a = copy(), b = copy()
    a.add('from-a'); await a.file.save()
    const writes = disk.writes
    await b.file.save()
    expect(disk.writes).toBe(writes)
    expect(card(onDisk(), 'card-from-a')).toBeDefined()
  })
})

describe('a copy picks up what the other did', () => {
  it('takes it on its next look, and keeps what it has not saved yet', async () => {
    const a = copy(), b = copy()
    b.add('unsaved')
    a.add('from-a'); await a.file.save()
    await b.file.pickUp()
    expect(card(b.store, 'card-from-a')).toBeDefined()
    expect(card(b.store, 'card-unsaved')).toBeDefined()
    await b.file.save()
    expect(card(onDisk(), 'card-unsaved')).toBeDefined()
    expect(card(onDisk(), 'card-from-a')).toBeDefined()
  })

  it('leaves alone a file it cannot read: nothing is written over it', async () => {
    const a = copy()
    a.add('from-a')
    disk.text = '{ half a file'
    await a.file.save().catch(() => undefined)
    expect(disk.text).toBe('{ half a file')
  })
})
