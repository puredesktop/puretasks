import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import { describe, expect, it } from 'vitest'
import { updateTaskAgentMutation } from '../../lib/agentWriteTools'
import { createTask, starterBoardStore } from '../../lib/taskModel'
import type { SuiteTask, TasksStore } from '../../types'
import type { TasksAgentToolContext } from '../context'
import { createTaskHandler } from './create/createTask'
import { applyTaskBoardPatchHandler } from './write/applyTaskBoardPatch'
import { updateTaskHandler } from './write/updateTask'

const NOW = '2026-10-20T09:00:00.000Z'

/** A card that has been worked on for a while: long notes, many comments, checklists. */
function busyCard(projectId: string): SuiteTask {
  const task = createTask(projectId, 'Prepare the launch review', 'doing', NOW)
  return {
    ...task,
    notes: 'Context for the review. '.repeat(80),
    labels: ['launch', 'review'],
    comments: Array.from({ length: 30 }, (_, index) => ({
      id: `comment-${index}`,
      authorName: 'Ana',
      text: `Progress note ${index}: ${'details of what happened and what is next. '.repeat(4)}`,
      createdAt: NOW,
      updatedAt: NOW,
    })),
    checklists: Array.from({ length: 3 }, (_, list) => ({
      id: `checklist-${list}`,
      title: `Steps ${list}`,
      items: Array.from({ length: 10 }, (_, index) => ({
        id: `item-${list}-${index}`,
        text: `Step ${index} of the checklist`,
        done: index < 4,
        createdAt: NOW,
        updatedAt: NOW,
      })),
      createdAt: NOW,
      updatedAt: NOW,
    })),
  }
}

function setup() {
  let store: TasksStore = starterBoardStore('Fixture', NOW)
  const card = busyCard(store.projects[0]!.id)
  store = { ...store, tasks: [card] }
  const context = {
    storePath: '/fixture.tasks',
    get store() {
      return store
    },
    get activeProject() {
      return store.projects[0]!
    },
    selectedTask: null,
    applyStoreUpdate: async (producer: (current: TasksStore) => TasksStore) => {
      store = producer(store)
      return store
    },
  } as unknown as TasksAgentToolContext
  return { context, card, store: () => store }
}

function parse(result: { content: unknown }) {
  return JSON.parse(result.content as string)
}

describe('change-tool replies stay compact', () => {
  it('updateTask returns a summary of the card, not its comments or checklists', async () => {
    const app = setup()
    const before = formatAgentToolJson(
      updateTaskAgentMutation(app.store(), { taskId: app.card.id, title: 'Run the launch review' }).result,
    ).length
    const result = await updateTaskHandler(app.context, {
      arguments: { taskId: app.card.id, title: 'Run the launch review' },
    } as never)
    const reply = parse(result)
    expect(reply.task).toMatchObject({
      id: app.card.id,
      title: 'Run the launch review',
      status: 'doing',
      commentCount: 30,
      checklistCount: 3,
      checklistItems: '12/30',
      notesChars: app.card.notes.length,
    })
    expect(reply.task.comments).toBeUndefined()
    expect(reply.task.checklists).toBeUndefined()
    expect(reply.task.notes).toBeUndefined()
    // The store still holds the whole card.
    expect(app.store().tasks[0]!.comments).toHaveLength(30)
    const after = (result.content as string).length
    if (process.env.MEASURE) console.log(`updateTask reply: ${before} -> ${after} chars`)
    expect(after).toBeLessThan(1_000)
    expect(after).toBeLessThan(before / 5)
  })

  it('createTask returns the new id and summary', async () => {
    const app = setup()
    const result = await createTaskHandler(app.context, {
      arguments: { title: 'Book the room', notes: 'Second floor. '.repeat(50) },
    } as never)
    const reply = parse(result)
    expect(reply.task.id).toBe(app.store().tasks.find(task => task.title === 'Book the room')!.id)
    expect(reply.task.notes).toBeUndefined()
    expect(reply.task.notesChars).toBeGreaterThan(0)
  })

  it('applyTaskBoardPatch summarises cards per operation and keeps restore snapshots', async () => {
    const app = setup()
    const result = await applyTaskBoardPatchHandler(app.context, {
      arguments: {
        operations: [
          { type: 'updateTask', taskId: app.card.id, status: 'review' },
          { type: 'createTaskComment', taskId: app.card.id, text: 'Ready' },
        ],
      },
    } as never)
    const reply = parse(result)
    expect(reply.applied[0].result.task).toMatchObject({ id: app.card.id, status: 'review', commentCount: 30 })
    expect(reply.applied[0].result.task.comments).toBeUndefined()
    expect(reply.applied[1].result.comment.text).toBe('Ready')
    expect(reply.preview.touchedTaskIds).toEqual([app.card.id])
    expect((result.content as string).length).toBeLessThan(2_000)

    const deleted = parse(
      await applyTaskBoardPatchHandler(app.context, {
        arguments: { operations: [{ type: 'deleteTask', taskId: app.card.id }] },
      } as never),
    )
    // The snapshot is the undo token restoreTask takes back: it stays whole.
    const snapshot = deleted.applied[0].result.deletedSnapshot
    expect(snapshot.task.comments).toHaveLength(31)
    const restored = parse(
      await applyTaskBoardPatchHandler(app.context, {
        arguments: { operations: [{ type: 'restoreTask', ...snapshot }] },
      } as never),
    )
    expect(restored.applied[0].result.task).toMatchObject({ id: app.card.id, commentCount: 31 })
    expect(app.store().tasks[0]!.comments).toHaveLength(31)
  })
})
