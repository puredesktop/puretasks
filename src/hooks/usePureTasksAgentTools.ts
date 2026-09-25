import { usePlatformAgentTools } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { useRef } from 'react'
import {
  AgentTasksToolError,
  PURETASKS_AGENT_LOG_LABEL,
  PURETASKS_AGENT_TOOL_NAMES,
} from '../agents/catalog'
import type {
  TasksAgentBoardApi,
  TasksAgentToolContext,
} from '../agents/context'
import {
  addTaskResourceLinkHandler,
  createTaskChecklistHandler,
  createTaskChecklistItemHandler,
  createTaskCommentHandler,
  createTaskColumnHandler,
  createTaskHandler,
  createTaskProjectHandler,
} from '../agents/handlers/create'
import {
  deleteTaskChecklistHandler,
  deleteTaskChecklistItemHandler,
  deleteTaskCommentHandler,
  deleteTaskColumnHandler,
  deleteTaskHandler,
  deleteTaskProjectHandler,
  removeTaskResourceLinkHandler,
} from '../agents/handlers/delete'
import {
  getTaskHandler,
  getTasksContextHandler,
  listTaskActivityHandler,
  listTaskColumnsHandler,
  listTaskProjectsHandler,
  listTasksHandler,
  openTaskProjectHandler,
} from '../agents/handlers/read'
import {
  applyTaskBoardPatchHandler,
  createMissionFromTaskHandler,
  updateTaskChecklistHandler,
  updateTaskChecklistItemHandler,
  updateTaskCommentHandler,
  updateTaskColumnHandler,
  updateTaskHandler,
  updateTaskProjectHandler,
} from '../agents/handlers/write'
import type { TasksSessionState } from './useTasksSession'

function toTasksAgentToolContext(
  session: TasksSessionState,
  board: TasksAgentBoardApi,
): TasksAgentToolContext {
  return {
    storePath: session.storePath,
    // Live reads: a handler that opens or creates a board mid-call, or two
    // calls landing in one tick, must see the store as it is now.
    get store() {
      return session.readStore()
    },
    get activeProject() {
      return session.readStore().projects[0]
    },
    selectedTask: session.selectedTask,
    filters: session.filters,
    viewMode: session.viewMode,
    board,
    applyStoreUpdate: session.applyStoreUpdate,
  }
}

export function usePureTasksAgentTools(
  ready: boolean,
  session: TasksSessionState,
  board: TasksAgentBoardApi,
): void {
  const contextRef = useRef<TasksAgentToolContext>(
    toTasksAgentToolContext(session, board),
  )
  contextRef.current = toTasksAgentToolContext(session, board)

  usePlatformAgentTools({
    ready,
    tools: PURETASKS_AGENT_TOOL_NAMES,
    logLabel: PURETASKS_AGENT_LOG_LABEL,
    errorType: AgentTasksToolError,
    handlers: {
      getTasksContext: () => getTasksContextHandler(contextRef.current),
      getTask: invoke => getTaskHandler(contextRef.current, invoke),
      listTaskProjects: () => listTaskProjectsHandler(contextRef.current),
      listTaskColumns: () => listTaskColumnsHandler(contextRef.current),
      listTasks: invoke => listTasksHandler(contextRef.current, invoke),
      listTaskActivity: invoke =>
        listTaskActivityHandler(contextRef.current, invoke),
      createTaskProject: invoke =>
        createTaskProjectHandler(contextRef.current, invoke),
      updateTaskProject: invoke =>
        updateTaskProjectHandler(contextRef.current, invoke),
      deleteTaskProject: invoke =>
        deleteTaskProjectHandler(contextRef.current, invoke),
      openTaskProject: invoke =>
        openTaskProjectHandler(contextRef.current, invoke),
      createTaskColumn: invoke =>
        createTaskColumnHandler(contextRef.current, invoke),
      updateTaskColumn: invoke =>
        updateTaskColumnHandler(contextRef.current, invoke),
      deleteTaskColumn: invoke =>
        deleteTaskColumnHandler(contextRef.current, invoke),
      createTask: invoke => createTaskHandler(contextRef.current, invoke),
      updateTask: invoke => updateTaskHandler(contextRef.current, invoke),
      deleteTask: invoke => deleteTaskHandler(contextRef.current, invoke),
      createTaskComment: invoke =>
        createTaskCommentHandler(contextRef.current, invoke),
      updateTaskComment: invoke =>
        updateTaskCommentHandler(contextRef.current, invoke),
      deleteTaskComment: invoke =>
        deleteTaskCommentHandler(contextRef.current, invoke),
      createTaskChecklist: invoke =>
        createTaskChecklistHandler(contextRef.current, invoke),
      updateTaskChecklist: invoke =>
        updateTaskChecklistHandler(contextRef.current, invoke),
      deleteTaskChecklist: invoke =>
        deleteTaskChecklistHandler(contextRef.current, invoke),
      createTaskChecklistItem: invoke =>
        createTaskChecklistItemHandler(contextRef.current, invoke),
      updateTaskChecklistItem: invoke =>
        updateTaskChecklistItemHandler(contextRef.current, invoke),
      deleteTaskChecklistItem: invoke =>
        deleteTaskChecklistItemHandler(contextRef.current, invoke),
      addTaskResourceLink: invoke =>
        addTaskResourceLinkHandler(contextRef.current, invoke),
      removeTaskResourceLink: invoke =>
        removeTaskResourceLinkHandler(contextRef.current, invoke),
      applyTaskBoardPatch: invoke =>
        applyTaskBoardPatchHandler(contextRef.current, invoke),
    },
  })
}
