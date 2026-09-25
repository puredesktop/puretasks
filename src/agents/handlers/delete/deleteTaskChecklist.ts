import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { deleteTaskChecklistAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import { persistAgentMutation, requiredString } from '../agentArgs'

export async function deleteTaskChecklistHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    deleteTaskChecklistAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      checklistId: requiredString(args, 'checklistId'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
