import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { updateTaskChecklistAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function updateTaskChecklistHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    updateTaskChecklistAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      checklistId: requiredString(args, 'checklistId'),
      title: optionalString(args, 'title'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
