import { toTaskRow, type AgentTaskRow } from '../../lib/agentReadTools'
import type { SuiteTask } from '../../types'

/**
 * What a change tool says about a card it created, edited or restored: the
 * row listTasks shows plus the scalar fields a write can set and counts of
 * the nested parts. Never the notes text, the comments, the checklist items
 * or the links themselves: those grow with the card and getTask returns them.
 */
export interface AgentTaskChangeSummary extends AgentTaskRow {
  order: number
  parentId?: string
  blockedBy: string[]
  estimateHours?: number
  loggedHours?: number
  repeat?: SuiteTask['repeat']
  remindAt?: string
  completedAt?: string
  archivedAt?: string
  notesChars: number
  commentCount: number
  checklistCount: number
  checklistItems: string
  missionCount: number
  more: string
}

export function taskChangeSummary(task: SuiteTask): AgentTaskChangeSummary {
  const items = task.checklists.flatMap(checklist => checklist.items)
  return {
    ...toTaskRow(task),
    order: task.order,
    parentId: task.parentId,
    blockedBy: task.blockedBy,
    estimateHours: task.estimateHours,
    loggedHours: task.loggedHours,
    repeat: task.repeat,
    remindAt: task.remindAt,
    completedAt: task.completedAt,
    archivedAt: task.archivedAt,
    notesChars: task.notes.length,
    commentCount: task.comments.length,
    checklistCount: task.checklists.length,
    checklistItems: `${items.filter(item => item.done).length}/${items.length}`,
    missionCount: task.missions.length,
    more: 'Call getTask for the notes, comments, checklists and links.',
  }
}

/**
 * A mutation result as the model reads it: a `task` is replaced by its
 * change summary. Everything else (ids, a column, a comment, a checklist,
 * a deletedSnapshot the restore operations take back) is kept as it is.
 */
export function compactMutationReply<T>(result: T): T {
  if (!result || typeof result !== 'object') return result
  const task = (result as { task?: SuiteTask }).task
  if (!task || typeof task !== 'object' || !Array.isArray(task.comments)) {
    return result
  }
  return { ...result, task: taskChangeSummary(task) } as T
}
