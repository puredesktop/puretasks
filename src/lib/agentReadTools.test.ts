import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, emptyTasksStore, createTask } from './taskModel'
import {
  getTaskAgentSnapshot,
  getTasksAgentContext,
  listTaskActivityAgentSnapshot,
  listTasksAgentSnapshot,
} from './agentReadTools'
import { createActivity } from './taskModel'

describe('agentReadTools', () => {
  it('builds tasks context snapshot', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const project = store.projects[0]!
    const task = createTask(
      project.id,
      'Draft outline',
      'inbox',
      '2026-01-01T00:00:00.000Z',
    )
    store.tasks.push(task)

    expect(
      getTasksAgentContext({
        storePath: '~/PureScience/tasks.json',
        boardStatus: 'filed',
        store,
        activeProject: project,
        selectedTaskId: task.id,
        filters: DEFAULT_FILTERS,
        viewMode: 'board',
      }),
    ).toEqual({
      storePath: '~/PureScience/tasks.json',
      boardStatus: 'filed',
      activeProject: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      selectedTaskId: task.id,
      filters: DEFAULT_FILTERS,
      viewMode: 'board',
      projectCount: 1,
      visibleTaskCount: 1,
      totalTaskCount: 1,
    })
  })

  it('lists visible tasks with optional status override', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const project = store.projects[0]!
    store.tasks.push(
      createTask(project.id, 'Inbox item', 'inbox', '2026-01-01T00:00:00.000Z'),
      createTask(project.id, 'Doing item', 'doing', '2026-01-01T00:00:00.000Z'),
    )

    const rows = listTasksAgentSnapshot({
      store,
      activeProject: project,
      filters: DEFAULT_FILTERS,
      status: 'doing',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('Doing item')
    expect(rows[0]?.status).toBe('doing')
  })

  it('returns full task snapshots and recent activity', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const project = store.projects[0]!
    const task = createTask(
      project.id,
      'Inspect details',
      'inbox',
      '2026-01-01T00:00:00.000Z',
    )
    store.tasks.push(task)
    store.activity.push(
      createActivity(task.id, 'agent', 'First', '2026-01-01T00:00:00.000Z'),
      createActivity(task.id, 'agent', 'Second', '2026-01-02T00:00:00.000Z'),
    )

    expect(getTaskAgentSnapshot(store, task.id)).toEqual(task)
    expect(
      listTaskActivityAgentSnapshot({
        store,
        taskId: task.id,
        limit: 1,
      }),
    ).toMatchObject([{ text: 'Second' }])
  })
})
