import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { TASK_PACKAGE_SUFFIX } from '../../../constants'
import { AgentTasksToolError } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'
import { requiredString } from '../agentArgs'

function cleanPath(path: string): string {
  return path.replace(/\/+$/, '')
}

/**
 * Delete a board package — the same call as the document switcher's Delete.
 * This removes the folder outright (no Trash, no snapshot), so the open
 * board is refused and the description tells the model it is irreversible.
 */
export async function deleteTaskProjectHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const path = cleanPath(requiredString(args, 'path'))
  if (!path.endsWith(TASK_PACKAGE_SUFFIX)) {
    throw new AgentTasksToolError(
      `Not a ${TASK_PACKAGE_SUFFIX} board package: ${path}. Paths come from listTaskProjects.`,
    )
  }
  if (context.board.path && cleanPath(context.board.path) === path) {
    throw new AgentTasksToolError(
      'That is the open board. Open another board (openTaskProject) or ' +
        'create one (createTaskProject) first, then delete this one.',
    )
  }
  await context.board.delete(path)
  return {
    content: formatAgentToolJson({
      deletedPath: path,
      note: 'The package folder was deleted permanently; there is no restore.',
    }),
  }
}
