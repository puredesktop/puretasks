// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { TasksSessionState } from './useTasksSession'
import type { TasksAgentBoardApi } from '../agents/context'
import { createTask, starterBoardStore, DEFAULT_FILTERS } from '../lib/taskModel'
import { PURETASKS_AGENT_TOOL_NAMES } from '../agents/catalog'
const register = vi.fn()
vi.mock('@purescience/platform-ui/bridge/react/usePlatformAgentTools', () => ({ usePlatformAgentTools: register }))
const { usePureTasksAgentTools } = await import('./usePureTasksAgentTools')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('registers every advertised handler and routes the mission tool through the board API', async () => {
  const store = starterBoardStore('Fixture')
  store.tasks = [createTask(store.projects[0].id, 'Work')]
  const session = { storePath: '/fixture.tasks', readStore: () => store, selectedTask: null, filters: DEFAULT_FILTERS, viewMode: 'board', applyStoreUpdate: vi.fn() } as unknown as TasksSessionState
  const createMission = vi.fn(async () => ({ id: 'fixture-mission', title: 'Work' }))
  const board = { createMission } as unknown as TasksAgentBoardApi
  function Probe() { usePureTasksAgentTools(true, session, board); return null }
  const node = document.createElement('div'); const root = createRoot(node)
  try {
    await act(async () => root.render(<Probe />))
    const options = register.mock.calls.at(-1)![0]
    expect(Object.keys(options.handlers).sort()).toEqual([...PURETASKS_AGENT_TOOL_NAMES].sort())
    await options.handlers.createMissionFromTask({ arguments: { taskId: store.tasks[0].id, kind: 'steps' } })
    expect(createMission).toHaveBeenCalledWith(store.tasks[0].id, 'steps')
  } finally { await act(async () => root.unmount()) }
})
