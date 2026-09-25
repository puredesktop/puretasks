import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { listTaskColumnsAgentSnapshot } from '../../../lib/agentWriteTools'
import type { TasksAgentToolContext } from '../../context'

export async function listTaskColumnsHandler(
  context: TasksAgentToolContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson(listTaskColumnsAgentSnapshot(context.store)),
  }
}
