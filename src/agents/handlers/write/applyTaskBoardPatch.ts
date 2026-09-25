import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  applyTaskBoardPatchAgentMutation,
  type AgentBoardPatchOperation,
} from '../../../lib/agentWriteTools'
import { AgentTasksToolError } from '../../../lib/agentReadTools'
import type { TasksAgentToolContext } from '../../context'
import {
  optionalBoolean,
  optionalString,
  persistAgentMutation,
} from '../agentArgs'

function readOperations(
  args: Record<string, unknown>,
): AgentBoardPatchOperation[] {
  const value = args.operations
  if (
    !Array.isArray(value) ||
    !value.every(item => item && typeof item === 'object')
  ) {
    throw new AgentTasksToolError('operations must be an array of objects.')
  }
  return value as AgentBoardPatchOperation[]
}

export async function applyTaskBoardPatchHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const input = {
    operations: readOperations(args),
    activeProjectId: context.activeProject.id,
    reason: optionalString(args, 'reason'),
    dryRun: optionalBoolean(args, 'dryRun'),
  }
  // A dry run must not touch the store; the mutation returns the untouched
  // store in that case, so the same atomic path serves both modes.
  const result = await persistAgentMutation(context, store =>
    applyTaskBoardPatchAgentMutation(store, input),
  )
  return { content: formatAgentToolJson(result) }
}
