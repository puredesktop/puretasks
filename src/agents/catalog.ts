/** Keep in sync with `plugin.json` → `app.agents.tools[].name`. */
export const PURETASKS_AGENT_TOOL_NAMES = [
  'getTasksContext',
  'listTaskProjects',
  'listTaskColumns',
  'listTasks',
  'getTask',
  'listTaskActivity',
  'createTaskProject',
  'updateTaskProject',
  'deleteTaskProject',
  'openTaskProject',
  'createTaskColumn',
  'updateTaskColumn',
  'deleteTaskColumn',
  'createTask',
  'updateTask',
  'deleteTask',
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
  'createMissionFromTask',
] as const

export const PURETASKS_AGENT_LOG_LABEL = 'puretasks'

export { AgentTasksToolError } from '../lib/agentReadTools'

export type { TasksAgentToolContext } from './context'
