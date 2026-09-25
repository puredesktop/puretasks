import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { createTaskChecklistAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalStringArray,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function createTaskChecklistHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    createTaskChecklistAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      title: requiredString(args, 'title'),
      items: optionalStringArray(args, 'items'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
