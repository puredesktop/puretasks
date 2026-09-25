import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { createTaskColumnAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function createTaskColumnHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    createTaskColumnAgentMutation(store, {
      label: requiredString(args, 'label'),
      beforeStatus: optionalString(args, 'beforeStatus'),
      collapsed: optionalBoolean(args, 'collapsed'),
      hidden: optionalBoolean(args, 'hidden'),
      done: optionalBoolean(args, 'done'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
