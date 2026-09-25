import { describe, expect, it } from 'vitest'
import {
  createActivity,
  createTaskColumn,
  createProject,
  createTask,
  DEFAULT_TASK_COLUMNS,
  emptyTasksStore,
  moveTaskStatus,
  normalizeResourceLink,
  normalizeTasksStore,
  taskColumnsForStore,
  updateTaskDetails,
  visibleTasksForProject,
} from './taskModel'

describe('taskModel', () => {
  it('creates task defaults', () => {
    const task = createTask('project-1', '  Draft intro  ', '2026-01-01')
    expect(task).toMatchObject({
      projectId: 'project-1',
      title: 'Draft intro',
      status: 'inbox',
      order: Date.parse('2026-01-01'),
      priority: 'normal',
      labels: [],
      links: [],
      checklists: [],
      comments: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    })
  })

  it('moves task status and marks completion', () => {
    const task = createTask('project-1', 'Ship', '2026-01-01')
    expect(moveTaskStatus(task, 'done', '2026-01-02')).toMatchObject({
      status: 'done',
      completedAt: '2026-01-02',
    })
  })

  it('normalizes an empty store with a default project', () => {
    const store = normalizeTasksStore(null, '2026-01-01')
    expect(store.schemaVersion).toBe(1)
    expect(store.projects).toHaveLength(1)
    expect(store.projects[0].name).toBe('Suite Work')
    expect(store.columns).toEqual(DEFAULT_TASK_COLUMNS)
  })

  it('normalizes missing columns to the default board', () => {
    const project = createProject('Project', '', '2026-01-01')
    const store = normalizeTasksStore({
      schemaVersion: 1,
      projects: [project],
      tasks: [],
      activity: [],
    })

    expect(taskColumnsForStore(store).map(column => column.label)).toEqual([
      'Inbox',
      'Doing',
      'Review',
      'Done',
    ])
  })

  it('creates custom columns and custom-status tasks', () => {
    const store = emptyTasksStore('2026-01-01')
    const column = createTaskColumn('Blocked', taskColumnsForStore(store))
    expect(column).toMatchObject({ id: 'blocked', label: 'Blocked' })
    const task = createTask(store.projects[0].id, 'Wait', column!.id)
    expect(task.status).toBe('blocked')
  })

  it('normalizes persisted board column settings', () => {
    const store = normalizeTasksStore({
      schemaVersion: 1,
      projects: [createProject('Project', '', '2026-01-01')],
      columns: [
        {
          id: 'blocked',
          label: 'Blocked',
          collapsed: true,
          hidden: true,
          done: true,
        },
      ],
      tasks: [],
      activity: [],
    })

    expect(taskColumnsForStore(store)[0]).toMatchObject({
      id: 'blocked',
      label: 'Blocked',
      collapsed: true,
      hidden: true,
      done: true,
    })
  })

  it('uses done-column settings when moving tasks', () => {
    const task = createTask('project-1', 'Ship', '2026-01-01')
    const done = moveTaskStatus(task, 'released', '2026-01-02', undefined, true)
    expect(done).toMatchObject({
      status: 'released',
      completedAt: '2026-01-02',
    })
    expect(
      moveTaskStatus(done, 'doing', '2026-01-03', undefined, false).completedAt,
    ).toBeUndefined()
  })

  it('supports project creation', () => {
    expect(createProject(' Launch ', ' Notes ', '2026-01-01')).toMatchObject({
      name: 'Launch',
      description: 'Notes',
      createdAt: '2026-01-01',
    })
  })

  it('filters tasks by text, status, label, and links', () => {
    const store = emptyTasksStore('2026-01-01')
    const projectId = store.projects[0].id
    const task = updateTaskDetails(createTask(projectId, 'Review chapter'), {
      notes: 'Needs source check',
      labels: ['book'],
      links: [
        normalizeResourceLink({
          type: 'chapter',
          title: 'Chapter 2',
          path: '/tmp/book/chapter-2.md',
        }),
      ],
    })
    const next = { ...store, tasks: [moveTaskStatus(task, 'review')] }
    expect(
      visibleTasksForProject(next, projectId, {
        query: 'chapter-2',
        status: 'review',
        label: 'book',
      }).map(item => item.id),
    ).toEqual([task.id])
  })

  it('normalizes older tasks with card detail defaults', () => {
    const project = createProject('Project', '', '2026-01-01')
    const store = normalizeTasksStore({
      schemaVersion: 1,
      projects: [project],
      tasks: [
        {
          id: 'task-1',
          projectId: project.id,
          title: 'Old task',
          status: 'inbox',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      activity: [],
    })

    expect(store.tasks[0]).toMatchObject({
      notes: '',
      order: Date.parse('2026-01-01'),
      priority: 'normal',
      labels: [],
      links: [],
      checklists: [],
      comments: [],
    })
  })

  it('sorts tasks by manual order within a status', () => {
    const store = emptyTasksStore('2026-01-01')
    const projectId = store.projects[0].id
    const first = updateTaskDetails(createTask(projectId, 'First'), {})
    const second = updateTaskDetails(createTask(projectId, 'Second'), {})
    const next = {
      ...store,
      tasks: [
        { ...first, order: 2000 },
        { ...second, order: 1000 },
      ],
    }

    expect(
      visibleTasksForProject(next, projectId, {
        query: '',
        status: 'all',
        label: '',
      }).map(task => task.title),
    ).toEqual(['Second', 'First'])
  })

  it('preserves optional fields that are omitted from detail patches', () => {
    const task = updateTaskDetails(createTask('project-1', 'Card'), {
      ownerName: 'Adam',
      dueAt: '2026-06-10',
    })

    expect(
      updateTaskDetails(task, {
        comments: [
          {
            id: 'comment-1',
            authorName: 'PureScience User',
            text: 'Keep metadata',
            createdAt: '2026-06-06',
            updatedAt: '2026-06-06',
          },
        ],
      }),
    ).toMatchObject({
      ownerName: 'Adam',
      dueAt: '2026-06-10',
      comments: [{ text: 'Keep metadata' }],
    })
  })

  it('normalizes resource links', () => {
    expect(
      normalizeResourceLink({
        type: 'file',
        title: '',
        path: ' /tmp/demo.md ',
        appSlug: ' writer ',
      }),
    ).toMatchObject({
      title: '/tmp/demo.md',
      path: '/tmp/demo.md',
      appSlug: 'writer',
    })
  })

  it('tolerates agent link payloads that omit title or carry an unknown type', () => {
    expect(
      normalizeResourceLink({
        type: 'spreadsheet' as never,
        path: '/tmp/budget.xlsx',
      }),
    ).toMatchObject({ type: 'file', title: '/tmp/budget.xlsx' })
    expect(normalizeResourceLink({})).toMatchObject({
      type: 'file',
      title: 'Resource',
    })
  })

  it('creates activity entries', () => {
    expect(createActivity('task-1', 'move', 'Moved to Doing')).toMatchObject({
      taskId: 'task-1',
      type: 'move',
      text: 'Moved to Doing',
    })
  })
})
