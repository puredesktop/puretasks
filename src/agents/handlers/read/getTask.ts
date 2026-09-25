import {
  formatAgentToolJson,
  readAgentToolStringArg,
} from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  AgentTasksToolError,
  getTaskAgentSnapshot,
} from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'

export async function getTaskHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const taskId =
    readAgentToolStringArg(args, 'taskId') ?? context.selectedTask?.id
  if (!taskId) {
    throw new AgentTasksToolError(
      'No task is selected. Pass taskId — ids come from listTasks.',
    )
  }
  return {
    content: formatAgentToolJson(getTaskAgentSnapshot(context.store, taskId)),
  }
}
