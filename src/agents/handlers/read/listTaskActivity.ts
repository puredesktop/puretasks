import {
  formatAgentToolJson,
  readAgentToolStringArg,
} from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { listTaskActivityAgentSnapshot } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'
import { optionalNumber } from '../agentArgs'

export async function listTaskActivityHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson(
      listTaskActivityAgentSnapshot({
        store: context.store,
        taskId: readAgentToolStringArg(args, 'taskId'),
        limit: optionalNumber(args, 'limit'),
      }),
    ),
  }
}
