import { AppFrame } from '@purescience/platform-bridge/components/AppFrame'
import { EmptyState } from '@purescience/platform-ui/components/common/feedback/EmptyState'
import { usePlatformBridge } from '@purescience/platform-ui/bridge/react/usePlatformBridge'
import { usePlatformViewportResource } from '@purescience/platform-ui/bridge/react/usePlatformViewportResource'
import { useDocumentLifecycle } from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'
import { useDocumentHotkeys } from '@purescience/platform-ui/bridge/react/useDocumentHotkeys'
import {
  DocumentHeaderActions,
  DocumentSwitcher,
} from '@purescience/platform-ui/components/common/documents'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  deleteTaskBoard,
  isStandaloneDevMode,
  listTaskBoards,
  readTextFile,
  updateTasksSettings,
} from './bridge/platformBridge'
import {
  TASK_PACKAGE_CONTENT_FILE,
  TASK_PACKAGE_SUFFIX,
  TASKS_APP_SLUG,
} from './constants'
import type { TasksAgentBoardApi } from './agents/context'
import { PureTasksShell } from './components/PureTasksShell'
import { usePureTasksBoot } from './hooks/usePureTasksBoot'
import { usePureTasksAgentTools } from './hooks/usePureTasksAgentTools'
import { useTasksSession } from './hooks/useTasksSession'
import { starterBoardStore } from './lib/taskModel'
import { useBoardsIndex } from './hooks/useBoardsIndex'
import type { BOARD_TEMPLATES } from './components/glass/BoardsHome'
import { tasksSnapshotHtml } from './lib/tasksSnapshot'
import { parseTaskPackageStore, taskPackageFiles } from './lib/taskPackage'
import type { TasksAppSettings, TasksStore } from './types'

const NEW_BOARD_NAME = 'Untitled board'

function nowIso(): string {
  return new Date().toISOString()
}

function folderName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() || path
}

function boardContentPath(packagePath: string): string {
  return `${packagePath.replace(/\/+$/, '')}/${TASK_PACKAGE_CONTENT_FILE}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Board operations the shell needs — owned by the document lifecycle here. */
export interface TasksBoardApi {
  /** Board (project) name — the naming surface. */
  title: string
  description: string
  status: 'none' | 'draft' | 'filed'
  /** Bound `.tasks` package path, or null while unsaved. */
  path: string | null
  savedLabel: string
  rename: (name: string) => void
  setDescription: (description: string) => void
  newBoard: () => void
  openSwitcher: () => void
}

export function App(): React.ReactElement {
  const { error: bridgeError, ready, meta } = usePlatformBridge()
  const standaloneDev = isStandaloneDevMode()
  const bootReady = ready || standaloneDev
  const { boot, bootError } = usePureTasksBoot(bootReady)
  const { resource: viewportResource, clearResource } =
    usePlatformViewportResource(ready && !standaloneDev, meta)

  if (bridgeError && !standaloneDev) {
    return (
      <AppFrame>
        <EmptyState
          tone="error"
          title="Bridge unavailable"
          message={bridgeError.message}
        />
      </AppFrame>
    )
  }

  if (!bootReady || !boot) {
    return (
      <AppFrame>
        <EmptyState
          tone={bootError ? 'error' : 'neutral'}
          title={bootError ? 'Boot failed' : 'PureTasks'}
          message={bootError ? bootError.message : 'Loading task boards…'}
        />
      </AppFrame>
    )
  }

  return (
    <ReadyTasksApp
      settings={boot.appSettings}
      bootResourcePath={meta?.viewport?.resource?.path?.trim() ?? null}
      viewportResource={viewportResource}
      onViewportResourceHandled={clearResource}
      agentToolsReady={ready && !standaloneDev}
      bridgeMethods={meta?.methods ?? []}
    />
  )
}

function ReadyTasksApp({
  settings,
  bootResourcePath,
  viewportResource,
  onViewportResourceHandled,
  agentToolsReady,
  bridgeMethods,
}: {
  settings: TasksAppSettings
  bootResourcePath: string | null
  viewportResource: { path?: string } | null
  onViewportResourceHandled: () => void
  agentToolsReady: boolean
  bridgeMethods: readonly string[]
}): React.ReactElement {
  // ---- Unified document lifecycle: one board = one `.tasks` package --------
  const boundStoreRef = useRef<TasksStore>(starterBoardStore(NEW_BOARD_NAME))
  const boundPathRef = useRef<string | null>(null)
  const openGeneration = useRef(0)
  useEffect(
    () => () => {
      openGeneration.current += 1
    },
    [],
  )
  const lastResourceRef = useRef<string | null | undefined>(undefined)
  const [boardName, setBoardName] = useState(
    boundStoreRef.current.projects[0]?.name ?? NEW_BOARD_NAME,
  )
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  /** A card to open once the board it lives on has loaded. */
  const pendingTaskRef = useRef<string | null>(null)

  const lifecycle = useDocumentLifecycle({
    appSlug: TASKS_APP_SLUG,
    suffix: TASK_PACKAGE_SUFFIX,
    kind: 'package',
    suggestedTitle: boardName,
    serialize: () => {
      const boardStore = boundStoreRef.current
      const project = boardStore.projects[0]
      if (!project) return []
      return taskPackageFiles(boardStore, project, nowIso())
    },
    // Another app or tab wrote this package (PureFiles, a mission, another
    // PureTasks window). Reload when this editor is clean; when it has
    // unsaved edits its own autosave is about to land, so those win.
    onExternalChange: ({ path, dirty }) => {
      if (dirty) return
      void reloadBoardRef.current(path)
    },
  })
  const lifecycleRef = useRef(lifecycle)
  useEffect(() => {
    lifecycleRef.current = lifecycle
  }, [lifecycle])

  // Every board mutation updates the bound snapshot and marks the document
  // dirty — the first meaningful edit lazily creates the draft in PureDrafts.
  const onMutated = useCallback((next: TasksStore) => {
    openGeneration.current += 1
    boundStoreRef.current = next
    setBoardName(next.projects[0]?.name ?? NEW_BOARD_NAME)
    lifecycleRef.current.markDirty()
  }, [])

  const session = useTasksSession({
    initialStore: boundStoreRef.current,
    initialSettings: settings,
    boardPath: lifecycle.doc.path,
    onMutated,
    methods: bridgeMethods,
  })
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Lifecycle-owned path changes (lazy draft, promote, rename) → remember it.
  useEffect(() => {
    const path = lifecycle.doc.path
    if (!path || boundPathRef.current === path) return
    boundPathRef.current = path
    lastResourceRef.current = path
    void updateTasksSettings({ lastBoardPath: path }).catch(() => undefined)
  }, [lifecycle.doc.path])

  const readBoard = useCallback(async (packagePath: string) => {
    return parseTaskPackageStore(
      await readTextFile(boardContentPath(packagePath)),
    )
  }, [])

  const openBoard = useCallback(
    async (packagePath: string): Promise<void> => {
      const clean = packagePath.replace(/\/+$/, '')
      if (boundPathRef.current === clean) {
        setSwitcherOpen(false)
        return
      }
      const generation = ++openGeneration.current
      const lifecycle = lifecycleRef.current
      await lifecycle.flush({ throwOnError: true })
      if (generation !== openGeneration.current)
        throw new Error('Board open superseded.')
      let boardStore: TasksStore
      try {
        boardStore = await readBoard(clean)
        if (generation !== openGeneration.current)
          throw new Error('Board open superseded.')
      } catch (error) {
        if (generation !== openGeneration.current) throw error
        setOpenError(
          `Could not open ${folderName(clean)}: ${errorMessage(error)}`,
        )
        throw error
      }
      setOpenError(null)
      boundStoreRef.current = boardStore
      boundPathRef.current = clean
      lastResourceRef.current = clean
      setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME)
      sessionRef.current.replaceStore(boardStore)
      lifecycle.adopt(clean)
      setSwitcherOpen(false)
      void updateTasksSettings({ lastBoardPath: clean }).catch(() => undefined)
      if (pendingTaskRef.current) {
        const taskId = pendingTaskRef.current
        pendingTaskRef.current = null
        sessionRef.current.setSelectedTask(taskId)
        setOpenTaskRequest({ taskId, at: Date.now() })
      }
    },
    [readBoard],
  )
  const [openTaskRequest, setOpenTaskRequest] = useState<{ taskId: string; at: number } | null>(null)
  const openBoardWithTask = useCallback((path: string, taskId?: string) => {
    pendingTaskRef.current = taskId ?? null
    void openBoard(path).catch(() => { pendingTaskRef.current = null })
  }, [openBoard])

  // Re-read the bound package after an external write, keeping selection.
  const reloadBoard = useCallback(
    async (packagePath: string): Promise<void> => {
      const clean = packagePath.replace(/\/+$/, '')
      if (boundPathRef.current !== clean) return
      const generation = ++openGeneration.current
      try {
        const boardStore = await readBoard(clean)
        if (
          generation !== openGeneration.current ||
          boundPathRef.current !== clean
        )
          return
        boundStoreRef.current = boardStore
        setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME)
        sessionRef.current.replaceStore(boardStore, { keepSelection: true })
      } catch {
        // The package is mid-write or gone; the next change event retries.
      }
    },
    [readBoard],
  )
  const reloadBoardRef = useRef(reloadBoard)
  reloadBoardRef.current = reloadBoard

  const newBoard = useCallback(async (name?: string, template?: (typeof BOARD_TEMPLATES)[number]): Promise<void> => {
    const generation = ++openGeneration.current
    const lifecycle = lifecycleRef.current
    await lifecycle.flush({ throwOnError: true })
    if (generation !== openGeneration.current)
      throw new Error('New board superseded.')
    const boardStore = template
      ? { ...starterBoardStore(name?.trim() || `${template.label} board`), columns: template.columns.map(column => ({ ...column })) }
      : starterBoardStore(name?.trim() || NEW_BOARD_NAME)
    boundStoreRef.current = boardStore
    boundPathRef.current = null
    lastResourceRef.current = null
    setOpenError(null)
    // Commit the name synchronously: the lifecycle names the lazily-created
    // draft from the last *rendered* suggestedTitle, so a deferred render
    // would file this board under the previous board's name.
    flushSync(() =>
      setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME),
    )
    sessionRef.current.replaceStore(boardStore)
    lifecycle.reset()
    setSwitcherOpen(false)
  }, [])

  // Boot: bound resource → last board → fresh starter.
  const bootedRef = useRef(false)
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void (async () => {
      const bootPath = bootResourcePath?.trim()
      if (bootPath?.replace(/\/+$/, '').endsWith(TASK_PACKAGE_SUFFIX)) {
        await openBoard(bootPath).catch(() => undefined)
        return
      }
      const lastPath = settings.lastBoardPath?.trim()
      if (lastPath) {
        try {
          await openBoard(lastPath)
          return
        } catch {
          // The remembered board is gone — fall through to a fresh board
          // rather than nag about a path the user may have deleted.
          setOpenError(null)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Warm `resource.open` — a `.tasks` package opened from PureFiles.
  useEffect(() => {
    const path = viewportResource?.path?.trim()
    if (!path) return
    onViewportResourceHandled()
    if (path === lastResourceRef.current) return
    if (path.replace(/\/+$/, '').endsWith(TASK_PACKAGE_SUFFIX)) {
      void openBoard(path).catch(() => undefined)
    }
  }, [onViewportResourceHandled, openBoard, viewportResource])

  const saveBoard = useCallback(async (): Promise<void> => {
    const lifecycle = lifecycleRef.current
    const path = await lifecycle.ensureDraft()
    if (!path) throw new Error('Could not create a board draft.')
    await lifecycle.flush({ throwOnError: true })
  }, [])

  useDocumentHotkeys({
    onSave: () => void saveBoard().catch(() => undefined),
    onNew: () => void newBoard().catch(() => undefined),
    onOpen: () => setSwitcherOpen(true),
  })

  // The board name is the package name: renaming the project renames the
  // draft or filed package with it, and a board named before its draft
  // exists gets that draft filed under the new name, not the stale one.
  const renameBoard = useCallback((name: string) => {
    const trimmed = name.trim()
    // An unchanged blur must not mark the board dirty or mint a draft.
    if (!trimmed || trimmed === boundStoreRef.current.projects[0]?.name) return
    flushSync(() => setBoardName(trimmed))
    sessionRef.current.renameActiveProject(trimmed)
    const lifecycle = lifecycleRef.current
    if (lifecycle.doc.path) {
      if (trimmed !== lifecycle.doc.title) void lifecycle.rename(trimmed)
      return
    }
    void (async () => {
      const path = await lifecycle.ensureDraft()
      if (path && folderName(path) !== `${trimmed}${TASK_PACKAGE_SUFFIX}`) {
        await lifecycle.rename(trimmed)
      }
    })()
  }, [])

  const setBoardDescription = useCallback((description: string) => {
    sessionRef.current.setActiveProjectDescription(description)
  }, [])

  const savedLabel = openError
    ? openError
    : lifecycle.doc.error
    ? lifecycle.doc.error
    : lifecycle.doc.saving
    ? 'Saving…'
    : lifecycle.doc.status === 'none'
    ? 'Unsaved'
    : lifecycle.doc.savedAt
    ? `Saved ${new Date(lifecycle.doc.savedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : lifecycle.doc.status === 'draft'
    ? 'Draft'
    : 'Saved'

  const board = useMemo<TasksBoardApi>(
    () => ({
      title: boardName,
      description: session.activeProject.description,
      status: lifecycle.doc.status,
      path: lifecycle.doc.path,
      savedLabel,
      rename: renameBoard,
      setDescription: setBoardDescription,
      newBoard: () => void newBoard().catch(() => undefined),
      openSwitcher: () => setSwitcherOpen(true),
    }),
    [
      boardName,
      lifecycle.doc.path,
      lifecycle.doc.status,
      newBoard,
      renameBoard,
      savedLabel,
      session.activeProject.description,
      setBoardDescription,
    ],
  )

  // Every board on this Mac, for the rail and the cross-board places.
  const boardsIndex = useBoardsIndex({ readBoard, openPath: lifecycle.doc.path, openStore: session.store, enabled: !isStandaloneDevMode() })
  const refreshBoards = boardsIndex.refresh
  useEffect(() => { void refreshBoards() }, [lifecycle.doc.path, lifecycle.doc.savedAt, refreshBoards])

  // Board operations for the drawer tools — the same callbacks the header
  // and the document switcher use, so a tool can never bypass the lifecycle.
  const createBoard = useCallback(
    async (name: string, description?: string) => {
      await newBoard(name)
      if (description?.trim()) {
        sessionRef.current.setActiveProjectDescription(description)
      }
      const path = await lifecycleRef.current.ensureDraft()
      return { path, project: sessionRef.current.readStore().projects[0] }
    },
    [newBoard],
  )

  const agentBoard = useMemo<TasksAgentBoardApi>(
    () => ({
      path: lifecycle.doc.path,
      status: lifecycle.doc.status,
      list: listTaskBoards,
      create: createBoard,
      open: openBoard,
      rename: renameBoard,
      setDescription: setBoardDescription,
      delete: deleteTaskBoard,
      setArchiveDoneAfterDays: days => sessionRef.current.setArchiveDoneAfterDays(days),
      createMission: (taskId, kind) => sessionRef.current.createMissionForTask(taskId, kind),
    }),
    [
      createBoard,
      lifecycle.doc.path,
      lifecycle.doc.status,
      openBoard,
      renameBoard,
      setBoardDescription,
    ],
  )

  usePureTasksAgentTools(agentToolsReady, session, agentBoard)
  // ---- end document lifecycle ----------------------------------------------

  // Switcher snapshots: real columns with the real cards.
  const loadBoardPreview = useCallback(
    async (item: {
      path: string
      kind: 'package' | 'file'
    }): Promise<{ kind: 'html'; html: string } | null> => {
      if (item.kind !== 'package') return null
      try {
        const store = await readBoard(item.path)
        const html = tasksSnapshotHtml(store.tasks)
        return html ? { kind: 'html', html } : null
      } catch {
        return null
      }
    },
    [readBoard],
  )

  return (
    <AppFrame
      headerDocumentName={
        boardName?.trim() || (lifecycle.doc.path ? folderName(lifecycle.doc.path) : undefined)
      }
      headerActions={
        <DocumentHeaderActions
          lifecycle={lifecycle}
          title={boardName}
          onOpenSwitcher={() => setSwitcherOpen(true)}
        />
      }
    >
      <PureTasksShell
        key={openTaskRequest ? `${openTaskRequest.taskId}:${openTaskRequest.at}` : 'shell'}
        session={session}
        board={board}
        boards={boardsIndex.boards}
        boardsLoading={boardsIndex.loading}
        settings={openTaskRequest ? { ...settings, place: 'board', selectedTaskId: openTaskRequest.taskId } : settings}
        onOpenBoard={openBoardWithTask}
        onNewBoard={template => void newBoard(undefined, template).catch(() => undefined)}
        initialOpenTaskId={openTaskRequest?.taskId ?? null}
      />
      <DocumentSwitcher
        appSlug={TASKS_APP_SLUG}
        suffixes={[TASK_PACKAGE_SUFFIX]}
        variant="modal"
        loadPreview={loadBoardPreview}
        open={switcherOpen}
        openError={openError}
        onClose={() => setSwitcherOpen(false)}
        onOpenDocument={path => openBoard(path).catch(() => undefined)}
        onCreateNew={() => void newBoard().catch(() => undefined)}
        newLabel="New board"
        title="Open a board"
        itemNoun="board"
      />
    </AppFrame>
  )
}
