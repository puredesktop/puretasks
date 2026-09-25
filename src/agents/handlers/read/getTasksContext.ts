import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { getTasksAgentContext } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'

export async function getTasksContextHandler(
  context: TasksAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const snapshot = getTasksAgentContext({
    storePath: context.board.path,
    boardStatus: context.board.status,
    store: context.store,
    activeProject: context.activeProject,
    selectedTaskId: context.selectedTask?.id ?? null,
    filters: context.filters,
    viewMode: context.viewMode,
  })
  return { content: formatAgentToolJson(snapshot) }
}
