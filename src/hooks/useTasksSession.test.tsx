// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TasksStore } from '../types'

/**
 * The session never talks to the shell except to persist UI settings and
 * open links; both are stubbed so the test exercises the store rules only.
 */
vi.mock('../bridge/platformBridge', () => ({
  updateTasksSettings: async () => ({}),
  catalogOpen: async () => undefined,
  missionsAvailable: () => false,
  createMission: async () => { throw new Error('no shell') },
  readMissionStatus: async () => { throw new Error('no shell') },
  openMission: async () => undefined,
}))
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const { useTasksSession } = await import('./useTasksSession')
const { starterBoardStore } = await import('../lib/taskModel')

type Session = ReturnType<typeof useTasksSession>

let root: Root | null = null
let latest: Session | null = null
let mutated: TasksStore[] = []

function Probe({ initialStore }: { initialStore: TasksStore }): null {
  latest = useTasksSession({
    initialStore,
    initialSettings: {},
    boardPath: null,
    onMutated: store => {
      mutated.push(store)
    },
  })
  return null
}

async function mount(
  initialStore = starterBoardStore('Board'),
): Promise<Session> {
  mutated = []
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(<Probe initialStore={initialStore} />)
  })
  return latest!
}

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount())
    root = null
  }
  latest = null
})

describe('useTasksSession', () => {
  it('reports every mutation in a burst to onMutated, each on top of the last', async () => {
    const session = await mount()
    // Two edits in the same tick — the way a blur + click, or two agent
    // tool calls, land. Neither may be dropped or overwrite the other.
    await act(async () => {
      void session.createTask('First')
      void session.createTask('Second')
      void session.createColumn('Blocked')
    })
    expect(mutated).toHaveLength(3)
    const last = mutated[mutated.length - 1]!
    expect(last.tasks.map(task => task.title).sort()).toEqual([
      'First',
      'Second',
    ])
    expect(last.columns?.some(column => column.id === 'blocked')).toBe(true)
    expect(latest!.store).toBe(last)
    expect(latest!.readStore()).toBe(last)
  })

  it('composes agent producers against the live store, not a render snapshot', async () => {
    const session = await mount()
    const stale = session.readStore()
    await act(async () => {
      await session.createTask('From the UI')
    })
    // A producer handed to applyStoreUpdate sees the task created above even
    // though `session` here is the object captured before that render.
    let seen: TasksStore | null = null
    await act(async () => {
      await session.applyStoreUpdate(current => {
        seen = current
        return current
      })
    })
    expect(seen).not.toBe(stale)
    expect(seen!.tasks.map(task => task.title)).toEqual(['From the UI'])
    // Returning the same store is a no-op: nothing to autosave.
    expect(mutated).toHaveLength(1)
  })

  it('replaceStore loads a board without marking it dirty', async () => {
    const session = await mount()
    const opened = starterBoardStore('Opened')
    await act(async () => {
      session.replaceStore(opened)
    })
    expect(latest!.store).toBe(opened)
    expect(latest!.activeProject.name).toBe('Opened')
    expect(mutated).toHaveLength(0)
  })

  it('renames and describes the single board project through one path', async () => {
    const session = await mount()
    await act(async () => {
      session.renameActiveProject('  Launch  ')
      session.setActiveProjectDescription('Ship it')
      // Unchanged values are ignored — no spurious autosave.
      session.renameActiveProject('Launch')
    })
    expect(mutated).toHaveLength(2)
    expect(latest!.activeProject).toMatchObject({
      name: 'Launch',
      description: 'Ship it',
    })
  })
})

it('reconciles completion timestamps when a column changes its done meaning', async () => {
  const session = await mount()
  await act(async () => {
    await session.createTask('Review', 'inbox')
  })
  await act(async () => {
    await session.patchColumn('inbox', { done: true })
  })
  expect(latest!.store.tasks[0].completedAt).toBeTruthy()
  const completedAt = latest!.store.tasks[0].completedAt
  await act(async () => {
    await session.patchColumn('inbox', { collapsed: true })
  })
  expect(latest!.store.tasks[0].completedAt).toBe(completedAt)
  await act(async () => {
    await session.patchColumn('inbox', { done: false })
  })
  expect(latest!.store.tasks[0].completedAt).toBeUndefined()
})

it('sets completion when creating directly in a custom done column', async () => {
  const session = await mount()
  await act(async () => {
    await session.createColumn('Shipped')
  })
  await act(async () => {
    await session.patchColumn('shipped', { done: true })
  })
  await act(async () => {
    await session.createTask('Published', 'shipped')
  })
  expect(latest!.store.tasks[0].completedAt).toBeTruthy()
})
