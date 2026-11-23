import {
  createAppOperationsRegistry,
  defineAppTool,
  type AppAtomicToolDefinition,
  type BuildHandlersOptions,
} from '@purescience/platform-ui/bridge/appFunctions'
import type {
  AgentToolHandler,
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentTasksToolError } from '../lib/agentReadTools'
import { PURETASKS_ATOMIC_TOOL_SCHEMAS } from './atomicToolSchemas'
import type { TasksAgentToolContext } from './context'
import { PURETASKS_FUNCTIONS } from './functions'
import {
  addTaskResourceLinkHandler,
  createTaskChecklistHandler,
  createTaskChecklistItemHandler,
  createTaskColumnHandler,
  createTaskCommentHandler,
  createTaskHandler,
  createTaskProjectHandler,
} from './handlers/create'
import {
  deleteTaskChecklistHandler,
  deleteTaskChecklistItemHandler,
  deleteTaskColumnHandler,
  deleteTaskCommentHandler,
  deleteTaskHandler,
  deleteTaskProjectHandler,
  removeTaskResourceLinkHandler,
} from './handlers/delete'
import {
  getTaskHandler,
  getTasksContextHandler,
  listTaskActivityHandler,
  listTaskColumnsHandler,
  listTaskProjectsHandler,
  listTasksHandler,
  openTaskProjectHandler,
} from './handlers/read'
import {
  applyTaskBoardPatchHandler,
  createMissionFromTaskHandler,
  updateTaskChecklistHandler,
  updateTaskChecklistItemHandler,
  updateTaskColumnHandler,
  updateTaskCommentHandler,
  updateTaskHandler,
  updateTaskProjectHandler,
} from './handlers/write'

type AtomicRunner = (
  ctx: TasksAgentToolContext,
  invoke: AgentToolInvokeContext,
) => AgentToolHandlerResult | Promise<AgentToolHandlerResult>

const ATOMIC_RUNNERS: Record<string, AtomicRunner> = {
  getTasksContext: ctx => getTasksContextHandler(ctx),
  listTaskProjects: ctx => listTaskProjectsHandler(ctx),
  listTaskColumns: ctx => listTaskColumnsHandler(ctx),
  listTasks: (ctx, invoke) => listTasksHandler(ctx, invoke),
  getTask: (ctx, invoke) => getTaskHandler(ctx, invoke),
  listTaskActivity: (ctx, invoke) => listTaskActivityHandler(ctx, invoke),
  openTaskProject: (ctx, invoke) => openTaskProjectHandler(ctx, invoke),
  createTaskProject: (ctx, invoke) => createTaskProjectHandler(ctx, invoke),
  updateTaskProject: (ctx, invoke) => updateTaskProjectHandler(ctx, invoke),
  deleteTaskProject: (ctx, invoke) => deleteTaskProjectHandler(ctx, invoke),
  createTaskColumn: (ctx, invoke) => createTaskColumnHandler(ctx, invoke),
  updateTaskColumn: (ctx, invoke) => updateTaskColumnHandler(ctx, invoke),
  deleteTaskColumn: (ctx, invoke) => deleteTaskColumnHandler(ctx, invoke),
  createTask: (ctx, invoke) => createTaskHandler(ctx, invoke),
  updateTask: (ctx, invoke) => updateTaskHandler(ctx, invoke),
  deleteTask: (ctx, invoke) => deleteTaskHandler(ctx, invoke),
  createTaskComment: (ctx, invoke) => createTaskCommentHandler(ctx, invoke),
  updateTaskComment: (ctx, invoke) => updateTaskCommentHandler(ctx, invoke),
  deleteTaskComment: (ctx, invoke) => deleteTaskCommentHandler(ctx, invoke),
  createTaskChecklist: (ctx, invoke) => createTaskChecklistHandler(ctx, invoke),
  updateTaskChecklist: (ctx, invoke) => updateTaskChecklistHandler(ctx, invoke),
  deleteTaskChecklist: (ctx, invoke) => deleteTaskChecklistHandler(ctx, invoke),
  createTaskChecklistItem: (ctx, invoke) =>
    createTaskChecklistItemHandler(ctx, invoke),
  updateTaskChecklistItem: (ctx, invoke) =>
    updateTaskChecklistItemHandler(ctx, invoke),
  deleteTaskChecklistItem: (ctx, invoke) =>
    deleteTaskChecklistItemHandler(ctx, invoke),
  addTaskResourceLink: (ctx, invoke) => addTaskResourceLinkHandler(ctx, invoke),
  removeTaskResourceLink: (ctx, invoke) =>
    removeTaskResourceLinkHandler(ctx, invoke),
  applyTaskBoardPatch: (ctx, invoke) => applyTaskBoardPatchHandler(ctx, invoke),
  createMissionFromTask: (ctx, invoke) =>
    createMissionFromTaskHandler(ctx, invoke),
}

const atomicTools: AppAtomicToolDefinition<TasksAgentToolContext>[] =
  PURETASKS_ATOMIC_TOOL_SCHEMAS.map(schema =>
    defineAppTool<TasksAgentToolContext>({
      ...schema,
      run: async (ctx, args, invoke) => {
        const runner = ATOMIC_RUNNERS[schema.name]
        if (!runner) {
          throw new AgentTasksToolError(
            `Missing atomic tool handler for "${schema.name}".`,
          )
        }
        return runner(ctx, { ...invoke, arguments: args })
      },
    }),
  )

/**
 * PureTasks' unified Operations Registry built on `@purescience/platform-ui/bridge/appFunctions`:
 *   - 6 composite `function` workflows (`fn_*`, always exposed)
 *   - 7 core atomic tools (~24% of 29, including permanent-delete `deleteTaskProject`, always exposed)
 *   - 3 universal escape-hatch meta-tools (always exposed)
 *   - 22 extended specialist atomic tools (hidden by default, 100% reachable on demand)
 */
export const PURETASKS_OPERATIONS_REGISTRY =
  createAppOperationsRegistry<TasksAgentToolContext>({
    appSlug: 'tasks',
    appName: 'PureTasks',
    functions: PURETASKS_FUNCTIONS,
    tools: atomicTools,
  })

export function buildPureTasksHandlers(
  getCtx: () => TasksAgentToolContext,
  options: BuildHandlersOptions<TasksAgentToolContext> = {},
): Record<string, AgentToolHandler> {
  return PURETASKS_OPERATIONS_REGISTRY.buildHandlers(getCtx, {
    createError: message => new AgentTasksToolError(message),
    ...options,
  })
}
