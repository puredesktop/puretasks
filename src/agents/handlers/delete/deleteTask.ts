import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { deleteTaskAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import { persistAgentMutation, requiredString } from '../agentArgs'

export async function deleteTaskHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    deleteTaskAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
