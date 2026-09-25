import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentTasksToolError } from '../../../lib/agentReadTools'
import { MISSION_KINDS, type MissionKind } from '../../../lib/missions'
import type { TasksAgentToolContext } from '../../context'
import { optionalString, requiredString } from '../agentArgs'

/**
 * A card becomes a mission the shell runs — the same path as the card's
 * “Create mission” button. The mission's own tools land back on the card.
 */
export async function createMissionFromTaskHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const taskId = requiredString(args, 'taskId')
  const kind = (optionalString(args, 'kind') ?? 'do') as MissionKind
  if (!MISSION_KINDS.some(candidate => candidate.id === kind)) {
    throw new AgentTasksToolError(`kind must be one of ${MISSION_KINDS.map(candidate => candidate.id).join(', ')}.`)
  }
  if (!context.store.tasks.some(task => task.id === taskId)) {
    throw new AgentTasksToolError(`Unknown task: ${taskId}. Ids come from listTasks.`)
  }
  const mission = await context.board.createMission(taskId, kind)
  return {
    content: formatAgentToolJson({
      mission,
      note: 'The mission runs in the shell; its progress shows on the card and in getTask.missions. Do not do the work yourself as well.',
    }),
  }
}
