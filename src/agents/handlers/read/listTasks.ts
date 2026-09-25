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
  listTasksAgentSnapshot,
} from '../../../lib/agentReadTools'
import type { TaskStatus } from '../../../types'
import type { TasksAgentToolContext } from '../../context'

function readStatusArg(
  args: Record<string, unknown>,
): TaskStatus | 'all' | undefined {
  const value = readAgentToolStringArg(args, 'status')
  if (!value) return undefined
  if (value === 'all') return 'all'
  if (value.trim()) return value.trim()
  throw new AgentTasksToolError('status must be a column id or all')
}

export async function listTasksHandler(
  context: TasksAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const projectId = readAgentToolStringArg(args, 'projectId')
  const query = readAgentToolStringArg(args, 'query') ?? undefined
  const label = readAgentToolStringArg(args, 'label') ?? undefined
  const status = readStatusArg(args)

  const rows = listTasksAgentSnapshot({
    store: context.store,
    activeProject: context.activeProject,
    filters: context.filters,
    projectId,
    status,
    query,
    label,
  })

  return { content: formatAgentToolJson(rows) }
}
