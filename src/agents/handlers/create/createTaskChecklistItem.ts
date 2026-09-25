import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { createTaskChecklistItemAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function createTaskChecklistItemHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    createTaskChecklistItemAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      checklistId: requiredString(args, 'checklistId'),
      text: requiredString(args, 'text'),
      done: optionalBoolean(args, 'done'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
