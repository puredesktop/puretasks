import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { updateTaskColumnAgentMutation } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  optionalNumber,
  optionalString,
  persistAgentMutation,
  requiredString,
} from '../agentArgs'

export async function updateTaskColumnHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    updateTaskColumnAgentMutation(store, {
      status: requiredString(args, 'status'),
      label: optionalString(args, 'label'),
      beforeStatus:
        args.beforeStatus === null
          ? null
          : optionalString(args, 'beforeStatus'),
      collapsed: optionalBoolean(args, 'collapsed'),
      hidden: optionalBoolean(args, 'hidden'),
      done: optionalBoolean(args, 'done'),
      wipLimit: optionalNumber(args, 'wipLimit'),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
