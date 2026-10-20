/**
 * Tags for the shared agent activity layer: each element that shows a board, column, card, comment, checklist,
 * item or link carries the refs the agent tools use for it, so a tool call marks the thing it touches.
 * Markup only; nothing here changes behaviour.
 */

export interface AgentRefAttributes {
  'data-agent-ref': string
  'data-agent-label': string
}

function attributes(refs: Array<string | null | undefined>, label: string): AgentRefAttributes {
  return { 'data-agent-ref': Array.from(new Set(refs.filter((ref): ref is string => Boolean(ref)))).join(' '), 'data-agent-label': label }
}

/** A card: its id, plus every argument name the tools pass a card id under (taskId, beforeTaskId, parentId, blockedBy). */
export function taskAgentRefs(task: { id: string; title: string }): AgentRefAttributes {
  const id = task.id
  return attributes([id, `taskId:${id}`, `beforeTaskId:${id}`, `parentId:${id}`, `blockedBy:${id}`, `id:${id}`], task.title)
}

/**
 * A column. Column ids are plain words (inbox, doing, done), so only the keyed forms are used: `status`,
 * `beforeStatus`, `targetStatus` as the column tools pass them, and `id` as listTaskColumns answers.
 */
export function columnAgentRefs(column: { id: string; label: string }): AgentRefAttributes {
  const id = column.id
  return attributes([`status:${id}`, `beforeStatus:${id}`, `targetStatus:${id}`, `id:${id}`], column.label)
}

/**
 * A board (a `.tasks` package): its path as openTaskProject / deleteTaskProject take it, and the open board's project id.
 * `open` marks the board surface as the open document (`@open`), where a write that names no element lands.
 */
export function boardAgentRefs(board: { path?: string | null; projectId?: string | null; name: string; open?: boolean }): AgentRefAttributes {
  const clean = board.path ? board.path.replace(/\/+$/, '') : null
  const paths = clean ? [clean, `${clean}/`] : []
  return attributes([
    ...paths.flatMap(path => [path, `path:${path}`, `storePath:${path}`]),
    board.projectId,
    board.projectId ? `projectId:${board.projectId}` : null,
    board.open ? '@open' : null,
  ], board.name)
}

export function commentAgentRefs(comment: { id: string }, label: string): AgentRefAttributes {
  return attributes([comment.id, `commentId:${comment.id}`], label)
}

/** An activity entry, as listTaskActivity answers it (`id`). */
export function activityAgentRefs(entry: { id: string }, label: string): AgentRefAttributes {
  return attributes([entry.id, `id:${entry.id}`], label)
}

export function checklistAgentRefs(checklist: { id: string; title: string }): AgentRefAttributes {
  return attributes([checklist.id, `checklistId:${checklist.id}`], checklist.title)
}

export function checklistItemAgentRefs(item: { id: string; text: string }): AgentRefAttributes {
  return attributes([item.id, `itemId:${item.id}`], item.text)
}

export function linkAgentRefs(link: { id: string; title: string }): AgentRefAttributes {
  return attributes([link.id, `linkId:${link.id}`], link.title)
}
