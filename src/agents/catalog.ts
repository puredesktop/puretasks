/**
 * Exposed PureTasks operations (must stay in sync 1:1 with `plugin.json` → `app.agents.tools[].name`).
 *
 * 3-tier exposure (built on `@purescience/platform-ui/bridge/appFunctions`):
 *   1. 6 composite `function` workflows (`fn_*`) — replace 3–15 atomic round-trips each
 *   2. 7 core atomic tools (~24% of 29) — indispensable direct read/write/mission verbs + permanent-delete `deleteTaskProject`
 *   3. 3 universal escape-hatch meta-tools (`discoverAppTools`, `callExtendedReadTool`, `callExtendedTool`)
 *      providing full on-demand access to the remaining 22 specialist atomic tools.
 */
export const PURETASKS_FUNCTION_NAMES = [
  'fn_boardBriefingAndSchedule',
  'fn_workloadAndHealthAudit',
  'fn_getTaskDossier',
  'fn_captureStructuredTask',
  'fn_batchTriageTasks',
  'fn_periodReviewDigest',
] as const

export const PURETASKS_CORE_TOOL_NAMES = [
  'getTasksContext',
  'listTasks',
  'getTask',
  'createTask',
  'updateTask',
  'createMissionFromTask',
  'deleteTaskProject',
] as const

export const PURETASKS_META_TOOL_NAMES = [
  'discoverAppTools',
  'callExtendedReadTool',
  'callExtendedTool',
] as const

export const EXPOSED_TOOL_NAMES = [
  ...PURETASKS_FUNCTION_NAMES,
  ...PURETASKS_CORE_TOOL_NAMES,
  ...PURETASKS_META_TOOL_NAMES,
] as const

/** Keep in sync with `plugin.json` → `app.agents.tools[].name`. */
export const PURETASKS_AGENT_TOOL_NAMES = EXPOSED_TOOL_NAMES

export const PURETASKS_EXTENDED_TOOL_NAMES = [
  'listTaskProjects',
  'openTaskProject',
  'createTaskProject',
  'updateTaskProject',
  'listTaskColumns',
  'createTaskColumn',
  'updateTaskColumn',
  'deleteTaskColumn',
  'deleteTask',
  'listTaskActivity',
  'createTaskComment',
  'updateTaskComment',
  'deleteTaskComment',
  'createTaskChecklist',
  'updateTaskChecklist',
  'deleteTaskChecklist',
  'createTaskChecklistItem',
  'updateTaskChecklistItem',
  'deleteTaskChecklistItem',
  'addTaskResourceLink',
  'removeTaskResourceLink',
  'applyTaskBoardPatch',
] as const

export const PURETASKS_ALL_ATOMIC_TOOL_NAMES = [
  ...PURETASKS_CORE_TOOL_NAMES,
  ...PURETASKS_EXTENDED_TOOL_NAMES,
] as const

export const PURETASKS_AGENT_LOG_LABEL = 'puretasks'

export { AgentTasksToolError } from '../lib/agentReadTools'

export type { TasksAgentToolContext } from './context'
