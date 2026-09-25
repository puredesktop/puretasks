import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { TASK_PACKAGE_SUFFIX } from '../../../constants'
import { AgentTasksToolError } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'
import { requiredString } from '../agentArgs'

/** Open another `.tasks` board — the same path as the document switcher. */
export async function openTaskProjectHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const path = requiredString(args, 'path').replace(/\/+$/, '')
  if (!path.endsWith(TASK_PACKAGE_SUFFIX)) {
    throw new AgentTasksToolError(
      `Not a ${TASK_PACKAGE_SUFFIX} board package: ${path}. Paths come from listTaskProjects.`,
    )
  }
  try {
    await context.board.open(path)
  } catch (error) {
    throw new AgentTasksToolError(
      `Could not open ${path}: ${
        error instanceof Error ? error.message : String(error)
      }. Check listTaskProjects for the current boards.`,
    )
  }
  const project = context.store.projects[0]
  return {
    content: formatAgentToolJson({
      path,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      taskCount: context.store.tasks.length,
    }),
  }
}
