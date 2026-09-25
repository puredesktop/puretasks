import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { removeTaskResourceLinkAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import { persistAgentMutation, requiredString } from '../agentArgs'

export async function removeTaskResourceLinkHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    removeTaskResourceLinkAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      linkId: requiredString(args, 'linkId'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
