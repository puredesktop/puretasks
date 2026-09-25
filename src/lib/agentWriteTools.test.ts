import { describe, expect, it } from 'vitest'
import { TASK_STATUSES, emptyTasksStore } from './taskModel'
import {
  addTaskResourceLinkAgentMutation,
  applyTaskBoardPatchAgentMutation,
  createTaskChecklistAgentMutation,
  createTaskChecklistItemAgentMutation,
  createTaskCommentAgentMutation,
  createTaskAgentMutation,
  createTaskColumnAgentMutation,
  deleteTaskChecklistAgentMutation,
  deleteTaskChecklistItemAgentMutation,
  deleteTaskCommentAgentMutation,
  deleteTaskAgentMutation,
  deleteTaskColumnAgentMutation,
  removeTaskResourceLinkAgentMutation,
  updateTaskChecklistAgentMutation,
  updateTaskChecklistItemAgentMutation,
  updateTaskCommentAgentMutation,
  updateTaskAgentMutation,
  updateTaskColumnAgentMutation,
  updateTaskProjectAgentMutation,
} from './agentWriteTools'

describe('agentWriteTools', () => {
  it('updates the board project and teaches the one-board model on a miss', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const projectId = store.projects[0]!.id
    const updated = updateTaskProjectAgentMutation(store, {
      projectId,
      name: 'Launch plan',
      description: 'Go time',
    })
    expect(updated.result.project).toMatchObject({
      name: 'Launch plan',
      description: 'Go time',
    })
    expect(updated.store.projects).toHaveLength(1)

    expect(() =>
      updateTaskProjectAgentMutation(store, {
        projectId: 'project_elsewhere',
        name: 'Nope',
      }),
    ).toThrow(/openTaskProject/)
  })

  it('refuses to delete a system column and points at hiding it', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    for (const status of TASK_STATUSES) {
      expect(() =>
        deleteTaskColumnAgentMutation(store, {
          status,
          targetStatus: status === 'inbox' ? 'doing' : 'inbox',
        }),
      ).toThrow(/system column.*hidden: true/)
    }
  })

  it('creates, updates, and deletes columns while moving tasks', () => {
    let store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    const columnResult = createTaskColumnAgentMutation(store, {
      label: 'Blocked',
      beforeStatus: 'done',
      collapsed: true,
    })
    store = columnResult.store
    expect(columnResult.result.column).toMatchObject({
      id: 'blocked',
      label: 'Blocked',
      collapsed: true,
    })

    const updatedColumn = updateTaskColumnAgentMutation(store, {
      status: 'blocked',
      label: 'Waiting',
      done: true,
      collapsed: false,
    })
    store = updatedColumn.store
    expect(updatedColumn.result.column).toMatchObject({
      label: 'Waiting',
      done: true,
      collapsed: false,
    })

    const taskResult = createTaskAgentMutation(
      store,
      { title: 'Needs vendor', status: 'blocked' },
      activeProjectId,
    )
    store = taskResult.store
    expect(taskResult.result.task.status).toBe('blocked')

    const deletedColumn = deleteTaskColumnAgentMutation(store, {
      status: 'blocked',
      targetStatus: 'doing',
    })
    expect(deletedColumn.result).toMatchObject({
      deletedStatus: 'blocked',
      targetStatus: 'doing',
      deletedSnapshot: {
        column: { id: 'blocked', label: 'Waiting' },
        movedTasks: [
          {
            taskId: taskResult.result.task.id,
            previousStatus: 'blocked',
            targetStatus: 'doing',
          },
        ],
      },
    })
    expect(deletedColumn.store.tasks[0]!.status).toBe('doing')
  })

  it('creates, edits, moves, and deletes tasks', () => {
    let store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    const created = createTaskAgentMutation(
      store,
      {
        title: 'Draft plan',
        status: 'inbox',
        notes: 'Start here',
        labels: ['planning'],
      },
      activeProjectId,
    )
    store = created.store
    expect(created.result.task).toMatchObject({
      title: 'Draft plan',
      notes: 'Start here',
      labels: ['planning'],
    })
    expect(store.activity[0]?.text).toBe('Agent created card')

    const updated = updateTaskAgentMutation(store, {
      taskId: created.result.task.id,
      title: 'Draft final plan',
      status: 'done',
      priority: 'high',
    })
    store = updated.store
    expect(updated.result.task).toMatchObject({
      title: 'Draft final plan',
      status: 'done',
      priority: 'high',
    })
    expect(updated.result.task.completedAt).toBeDefined()
    expect(store.activity[0]?.text).toBe('Agent updated card')

    const deleted = deleteTaskAgentMutation(store, {
      taskId: created.result.task.id,
    })
    expect(deleted.result.deletedSnapshot.task.title).toBe('Draft final plan')
    expect(deleted.result.deletedSnapshot.activity.length).toBeGreaterThan(0)
    expect(deleted.store.tasks).toHaveLength(0)
  })

  it('applies batch patches with dry-run preview support', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    const dryRun = applyTaskBoardPatchAgentMutation(store, {
      activeProjectId,
      dryRun: true,
      reason: 'preview setup',
      operations: [
        { type: 'createColumn', label: 'Blocked' },
        { type: 'createTask', title: 'Check API', status: 'blocked' },
      ],
    })

    expect(dryRun.store).toBe(store)
    expect(dryRun.result.dryRun).toBe(true)
    // The preview is counts, not the store — the model never gets a board dump.
    expect(dryRun.result.preview).toMatchObject({
      taskCount: 1,
      touchedTaskIds: [expect.stringMatching(/^task_/)],
    })
    expect(
      dryRun.result.preview.columns.find(column => column.id === 'blocked'),
    ).toMatchObject({ label: 'Blocked', taskCount: 1 })
    expect(dryRun.result.applied.map(item => item.type)).toEqual([
      'createColumn',
      'createTask',
    ])

    const applied = applyTaskBoardPatchAgentMutation(store, {
      activeProjectId,
      reason: 'setup board',
      operations: [
        { type: 'createColumn', label: 'Blocked' },
        { type: 'createTask', title: 'Check API', status: 'blocked' },
      ],
    })

    expect(applied.store.tasks).toHaveLength(1)
    expect(applied.result.dryRun).toBeUndefined()
    expect(applied.store.activity[0]?.text).toContain(
      'Agent applied board patch',
    )
  })

  it('tags the patch reason only on the cards the patch touched', () => {
    let store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    store = createTaskAgentMutation(
      store,
      { title: 'Untouched' },
      activeProjectId,
    ).store
    const touched = createTaskAgentMutation(
      store,
      { title: 'Touched' },
      activeProjectId,
    )
    store = touched.store

    const applied = applyTaskBoardPatchAgentMutation(store, {
      activeProjectId,
      reason: 'bump priority',
      operations: [
        {
          type: 'updateTask',
          taskId: touched.result.task.id,
          priority: 'high',
        },
      ],
    })
    const reasonRows = applied.store.activity.filter(item =>
      item.text.includes('bump priority'),
    )
    expect(reasonRows.map(item => item.taskId)).toEqual([
      touched.result.task.id,
    ])
    expect(applied.result.preview.touchedTaskIds).toEqual([
      touched.result.task.id,
    ])
  })

  it('rejects project operations inside a board patch', () => {
    const store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    for (const type of [
      'createProject',
      'updateProject',
      'deleteProject',
      'restoreProject',
    ]) {
      expect(() =>
        applyTaskBoardPatchAgentMutation(store, {
          activeProjectId,
          operations: [{ type, name: 'Other' } as never],
        }),
      ).toThrow(/createTaskProject/)
    }
  })

  it('returns snapshots that batch patches can restore', () => {
    let store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    const created = createTaskAgentMutation(
      store,
      { title: 'Restore me', status: 'inbox' },
      activeProjectId,
    )
    store = created.store
    const deleted = deleteTaskAgentMutation(store, {
      taskId: created.result.task.id,
    })

    const restored = applyTaskBoardPatchAgentMutation(deleted.store, {
      activeProjectId,
      operations: [
        {
          type: 'restoreTask',
          ...deleted.result.deletedSnapshot,
        },
      ],
    })

    expect(restored.store.tasks).toHaveLength(1)
    expect(restored.store.tasks[0]?.title).toBe('Restore me')
  })

  it('manages task comments, checklists, checklist items, and resource links', () => {
    let store = emptyTasksStore('2026-01-01T00:00:00.000Z')
    const activeProjectId = store.projects[0]!.id
    const created = createTaskAgentMutation(
      store,
      { title: 'Nested content' },
      activeProjectId,
    )
    store = created.store
    const taskId = created.result.task.id

    const comment = createTaskCommentAgentMutation(store, {
      taskId,
      text: 'Needs review',
      authorName: 'Reviewer',
    })
    store = comment.store
    expect(comment.result.comment.text).toBe('Needs review')

    const updatedComment = updateTaskCommentAgentMutation(store, {
      taskId,
      commentId: comment.result.comment.id,
      text: 'Reviewed',
    })
    store = updatedComment.store
    expect(updatedComment.result.comment.text).toBe('Reviewed')

    const checklist = createTaskChecklistAgentMutation(store, {
      taskId,
      title: 'Prep',
      items: ['One'],
    })
    store = checklist.store
    expect(checklist.result.checklist.items).toHaveLength(1)

    const renamedChecklist = updateTaskChecklistAgentMutation(store, {
      taskId,
      checklistId: checklist.result.checklist.id,
      title: 'Prep list',
    })
    store = renamedChecklist.store
    expect(renamedChecklist.result.checklist.title).toBe('Prep list')

    const item = createTaskChecklistItemAgentMutation(store, {
      taskId,
      checklistId: checklist.result.checklist.id,
      text: 'Two',
    })
    store = item.store

    const checked = updateTaskChecklistItemAgentMutation(store, {
      taskId,
      checklistId: checklist.result.checklist.id,
      itemId: item.result.item.id,
      done: true,
    })
    store = checked.store
    expect(checked.result.item.done).toBe(true)

    const link = addTaskResourceLinkAgentMutation(store, {
      taskId,
      link: {
        type: 'file',
        title: 'Brief',
        path: '/tmp/brief.md',
      },
    })
    store = link.store
    expect(link.result.link.title).toBe('Brief')

    store = removeTaskResourceLinkAgentMutation(store, {
      taskId,
      linkId: link.result.link.id,
    }).store
    store = deleteTaskChecklistItemAgentMutation(store, {
      taskId,
      checklistId: checklist.result.checklist.id,
      itemId: item.result.item.id,
    }).store
    store = deleteTaskChecklistAgentMutation(store, {
      taskId,
      checklistId: checklist.result.checklist.id,
    }).store
    store = deleteTaskCommentAgentMutation(store, {
      taskId,
      commentId: comment.result.comment.id,
    }).store

    const task = store.tasks.find(candidate => candidate.id === taskId)!
    expect(task.links).toHaveLength(0)
    expect(task.checklists).toHaveLength(0)
    expect(task.comments).toHaveLength(0)
  })
})
