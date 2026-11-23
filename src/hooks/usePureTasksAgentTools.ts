/**
 * Registering PureTasks' exposed operations with the platform:
 *   - 6 composite `fn_*` functions (always exposed)
 *   - 7 core atomic tools (~24% of 29, including permanent-delete `deleteTaskProject`, always exposed)
 *   - 3 universal escape-hatch meta-tools (`discoverAppTools`,
 *     `callExtendedReadTool`, `callExtendedTool`) giving full on-demand access
 *     to all 22 specialist atomic tools.
 */
import { useMemo, useRef } from 'react'
import type { AgentToolHandler } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { usePlatformAgentTools } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  AgentTasksToolError,
  EXPOSED_TOOL_NAMES,
  PURETASKS_AGENT_LOG_LABEL,
} from '../agents/catalog'
import type {
  TasksAgentBoardApi,
  TasksAgentToolContext,
} from '../agents/context'
import { buildPureTasksHandlers } from '../agents/operationsRegistry'
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

  const registryHandlers = useMemo(
    () => buildPureTasksHandlers(() => contextRef.current),
    [],
  )

  // Statically key-preserving registration so `scripts/check-manifests.mjs`
  // can verify every manifest tool has a live registered handler at build time.
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        EXPOSED_TOOL_NAMES.map(name => [
          name,
          async (invoke: Parameters<AgentToolHandler>[0]) =>
            registryHandlers[name]!(invoke),
        ]),
      ),
    [registryHandlers],
  )

  usePlatformAgentTools({
    ready,
    tools: EXPOSED_TOOL_NAMES,
    logLabel: PURETASKS_AGENT_LOG_LABEL,
    errorType: AgentTasksToolError,
    handlers,
  })
}
