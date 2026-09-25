import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { createTaskCommentAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function createTaskCommentHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    createTaskCommentAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      text: requiredString(args, 'text'),
      authorName: optionalString(args, 'authorName'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
