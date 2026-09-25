import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { updateTaskChecklistItemAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function updateTaskChecklistItemHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    updateTaskChecklistItemAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      checklistId: requiredString(args, 'checklistId'),
      itemId: requiredString(args, 'itemId'),
      text: optionalString(args, 'text'),
      done: optionalBoolean(args, 'done'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
