import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { updateTaskAgentMutation } from '../../../lib/agentWriteTools'
import type { TaskPriority, TaskRepeat } from '../../../types'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  optionalNumberOrNull,
  optionalObjectArray,
  optionalString,
  optionalStringArray,
  optionalStringOrNull,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function updateTaskHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    updateTaskAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      title: optionalString(args, 'title'),
      status: optionalString(args, 'status'),
      beforeTaskId: optionalString(args, 'beforeTaskId'),
      notes: optionalString(args, 'notes'),
      priority: optionalString(args, 'priority') as TaskPriority | undefined,
      ownerName: optionalString(args, 'ownerName'),
      labels: optionalStringArray(args, 'labels'),
      dueAt: optionalString(args, 'dueAt'),
      links: optionalObjectArray(args, 'links'),
      blockedBy: optionalStringArray(args, 'blockedBy'),
      parentId: optionalStringOrNull(args, 'parentId'),
      estimateHours: optionalNumberOrNull(args, 'estimateHours'),
      loggedHours: optionalNumberOrNull(args, 'loggedHours'),
      repeat: optionalStringOrNull(args, 'repeat') as TaskRepeat | null | undefined,
      remindAt: optionalStringOrNull(args, 'remindAt'),
      force: optionalBoolean(args, 'force'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
