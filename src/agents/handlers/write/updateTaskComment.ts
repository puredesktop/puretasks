import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { updateTaskCommentAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function updateTaskCommentHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    updateTaskCommentAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      commentId: requiredString(args, 'commentId'),
      text: optionalString(args, 'text'),
      authorName: optionalString(args, 'authorName'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
