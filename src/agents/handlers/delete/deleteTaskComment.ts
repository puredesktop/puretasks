import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { deleteTaskCommentAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import { persistAgentMutation, requiredString } from '../agentArgs'

export async function deleteTaskCommentHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    deleteTaskCommentAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      commentId: requiredString(args, 'commentId'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
