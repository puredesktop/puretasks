import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { deleteTaskChecklistItemAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import { persistAgentMutation, requiredString } from '../agentArgs'

export async function deleteTaskChecklistItemHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    deleteTaskChecklistItemAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      checklistId: requiredString(args, 'checklistId'),
      itemId: requiredString(args, 'itemId'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
