import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import type { TasksAgentToolContext } from '../../context'

function cleanPath(path: string | null): string | null {
  return path ? path.replace(/\/+$/, '') : null
}

/**
 * Boards are `.tasks` packages, one project each. The open board carries its
 * project id (the only one the write tools accept); every other board is
 * addressed by path via openTaskProject / deleteTaskProject.
 */
export async function listTaskProjectsHandler(
  context: TasksAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const openPath = cleanPath(context.board.path)
  const project = context.activeProject
  const boards = (await context.board.list()).map(entry => ({
    path: entry.path,
    name: entry.name,
    isDraft: entry.isDraft,
    isOpen: cleanPath(entry.path) === openPath,
  }))
  return {
    content: formatAgentToolJson({
      openBoard: {
        path: context.board.path,
        status: context.board.status,
        projectId: project.id,
        name: project.name,
        description: project.description,
        taskCount: context.store.tasks.length,
      },
      boards,
    }),
  }
}
