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
import { compactMutationReply } from '../replies'

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
  // Each operation reports what it changed; a card is its change summary,
  // never the whole card with every comment and checklist (getTask has it).
  return {
    content: formatAgentToolJson({
      ...result,
      applied: result.applied.map(item => ({
        type: item.type,
        result: compactMutationReply(item.result),
      })),
    }),
  }
}
