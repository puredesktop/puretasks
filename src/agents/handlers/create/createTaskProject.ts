import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import type { TasksAgentToolContext } from '../../context'
import { optionalString, requiredString } from '../agentArgs'

/**
 * A project is a board is a `.tasks` package: creating one starts a new
 * board through the same path as the header's "New board", files its draft,
 * and makes it the open board — every later tool call works on it.
 */
export async function createTaskProjectHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const { path, project } = await context.board.create(
    requiredString(args, 'name'),
    optionalString(args, 'description'),
  )
  return {
    content: formatAgentToolJson({
      project,
      path,
      note: 'This board is now the open board; tasks and columns you create next land here.',
    }),
  }
}
