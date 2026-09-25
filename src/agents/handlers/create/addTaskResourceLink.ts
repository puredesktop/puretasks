import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { addTaskResourceLinkAgentMutation } from '../../../lib/agentWriteTools'
import type { TaskResourceLink } from '../../../types'
import type { TasksAgentToolContext } from '../../context'
import {
  persistAgentMutation,
  requiredObject,
  requiredString,
} from '../agentArgs'

export async function addTaskResourceLinkHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const result = await persistAgentMutation(context, store =>
    addTaskResourceLinkAgentMutation(store, {
      taskId: requiredString(args, 'taskId'),
      link: requiredObject<Omit<TaskResourceLink, 'id'> & { id?: string }>(
        args,
        'link',
      ),
    }),
  )
  return { content: formatAgentToolJson(result) }
}
