import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentTasksToolError } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'
import { optionalNumber, optionalString, requiredString } from '../agentArgs'

/** Rename or describe the open board — the same path as the header controls. */
export async function updateTaskProjectHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const projectId = requiredString(args, 'projectId')
  if (projectId !== context.activeProject.id) {
    throw new AgentTasksToolError(
      `Unknown project: ${projectId}. Only the open board can be edited — ` +
        'its project id comes from getTasksContext; use listTaskProjects and ' +
        'openTaskProject({ path }) to switch boards first.',
    )
  }
  const name = optionalString(args, 'name')
  const description = optionalString(args, 'description')
  const archiveDoneAfterDays = optionalNumber(args, 'archiveDoneAfterDays')
  if (name === undefined && description === undefined && archiveDoneAfterDays === undefined) {
    throw new AgentTasksToolError('Pass a name, a description and/or archiveDoneAfterDays to change.')
  }
  if (archiveDoneAfterDays !== undefined && (!Number.isInteger(archiveDoneAfterDays) || archiveDoneAfterDays < 0 || archiveDoneAfterDays > 365)) {
    throw new AgentTasksToolError('archiveDoneAfterDays must be a whole number of days, 0–365 (0 = never).')
  }
  if (name !== undefined) context.board.rename(name)
  if (description !== undefined) context.board.setDescription(description)
  if (archiveDoneAfterDays !== undefined) context.board.setArchiveDoneAfterDays(archiveDoneAfterDays)
  return {
    content: formatAgentToolJson({
      project: context.activeProject,
      path: context.board.path,
    }),
  }
}
