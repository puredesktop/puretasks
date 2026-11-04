import { AppFrame } from '@purescience/platform-bridge/components/AppFrame'
import { EmptyState } from '@purescience/platform-ui/components/common/feedback/EmptyState'
import { usePlatformBridge } from '@purescience/platform-ui/bridge/react/usePlatformBridge'
import { usePlatformViewportResource } from '@purescience/platform-ui/bridge/react/usePlatformViewportResource'
import { useDocumentLifecycle } from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'
import { useDocumentHotkeys } from '@purescience/platform-ui/bridge/react/useDocumentHotkeys'
import { useLiveJson } from '@purescience/platform-ui/editing/live/useLiveJson'
import { useHeldCommand } from '@purescience/platform-ui/bridge/react/heldCommand'
import {
  DocumentHeaderActions,
  DocumentSwitcher,
} from '@purescience/platform-ui/components/common/documents'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  askIfHeld,
  deleteTaskBoard,
  isStandaloneDevMode,
  listTaskBoards,
  onClosingTab,
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
import { useCompactInRoom } from './hooks/useCompactInRoom'
import { usePureTasksBoot } from './hooks/usePureTasksBoot'
import { usePureTasksAgentTools } from './hooks/usePureTasksAgentTools'
import { useTasksSession } from './hooks/useTasksSession'
import { BoardFile } from './lib/boardFile'
import { findOutIfHeld, isHeldCopy, listenForHeld } from './lib/heldCopy'
import { titlesTaken } from './lib/taken'
import { starterBoardStore, taskColumnsForStore } from './lib/taskModel'
import { useBoardsIndex } from './hooks/useBoardsIndex'
import type { BOARD_TEMPLATES } from './components/glass/BoardsHome'
import { tasksSnapshotHtml } from './lib/tasksSnapshot'
import { parseTaskPackageStore, taskPackageContent, taskPackageFiles } from './lib/taskPackage'
import type { TasksAppSettings, TasksStore } from './types'

const NEW_BOARD_NAME = 'Untitled board'
/** How long after a change it saves, and how often it looks for what another copy saved. */
const SAVE_AFTER_MS = 1_200
const LOOK_EVERY_MS = 15_000

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
  const compact = useCompactInRoom()
  // lying flat in the page that holds it, on either kind of page: only while compact
  useEffect(() => {
    document.documentElement.toggleAttribute('data-held-in-room', compact)
    return () => document.documentElement.removeAttribute('data-held-in-room')
  }, [compact])
  // a second copy, from the moment the shell says so and for good: Full app does not make it the only one
  useEffect(() => { if (!isStandaloneDevMode()) void findOutIfHeld(() => askIfHeld()); return listenForHeld() }, [])
  const [uiSettings, setUiSettings] = useState(settings)
  const rememberUiSettings = useCallback((patch: Partial<TasksAppSettings>) => {
    setUiSettings(current => ({ ...current, ...patch }))
  }, [])
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
  const [openTaskRequest, setOpenTaskRequest] = useState<{ taskId: string; at: number } | null>(null)
  const taskRequestSequence = useRef(0)
  const [boardViewRevision, setBoardViewRevision] = useState(0)

  // What BoardFile has handed over to be written; what went into the last write.
  const handing = useRef<{ store: TasksStore; revision: string; expected: string | null } | null>(null)
  const serialized = useRef<{ store: TasksStore; revision: string } | null>(null)
  const fileRef = useRef<BoardFile | null>(null)
  // A board nobody has touched gets no draft.
  const touched = useRef(false)

  const lifecycle = useDocumentLifecycle({
    appSlug: TASKS_APP_SLUG,
    suffix: TASK_PACKAGE_SUFFIX,
    kind: 'package',
    suggestedTitle: boardName,
    serialize: () => {
      // The lifecycle also writes on its own as a tab hides or closes. With nothing to save it writes nothing, so a copy
      // that has done nothing never rewrites the file; with something, the revision below refuses it if the file has moved on.
      if (!handing.current && boundPathRef.current && fileRef.current && !fileRef.current.unsaved) { serialized.current = null; return [] }
      const store = handing.current?.store ?? boundStoreRef.current
      const project = store.projects[0]
      if (!project) { serialized.current = null; return [] }
      const revision = handing.current?.revision ?? crypto.randomUUID()
      serialized.current = { store, revision }
      return taskPackageFiles(store, project, nowIso(), revision)
    },
    // the check only when something is being written: a write of nothing must never be refused
    revision: () => (serialized.current ? { file: TASK_PACKAGE_CONTENT_FILE, field: 'revision', expected: handing.current ? handing.current.expected : fileRef.current?.revision ?? null } : undefined) as never,
    onSaved: () => {
      const wrote = serialized.current
      if (wrote && !handing.current) fileRef.current?.wrote(wrote.store, wrote.revision)
    },
    // Another app or tab wrote this package (PureFiles, a mission, another copy of PureTasks): taken in, with what this
    // copy has not saved kept on top.
    onExternalChange: ({ path }) => {
      if (liveRef.current?.status === 'on' || path.replace(/\/+$/, '') !== boundPathRef.current) return
      void fileRef.current?.pickUp()
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
    // Live: the change goes to everyone on the board, and the live copy writes the package when it is time.
    const project = next.projects[0]
    if (liveRef.current?.status === 'on' && project) {
      liveRef.current.write(JSON.parse(taskPackageContent(next, project)) as Record<string, unknown>)
      return
    }
    touched.current = true
    saveSoonRef.current()
  }, [])
  const liveRef = useRef<ReturnType<typeof useLiveJson> | null>(null)
  const saveSoonRef = useRef<() => void>(() => undefined)

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

  // Saving: BoardFile merges with what is on disk and writes only if that is still there; the lifecycle does the writing.
  if (!fileRef.current) {
    fileRef.current = new BoardFile(
      {
        readStore: () => sessionRef.current.readStore(),
        takeIn: next => {
          boundStoreRef.current = next
          setBoardName(next.projects[0]?.name ?? NEW_BOARD_NAME)
          sessionRef.current.replaceStore(next, { keepSelection: true, keepBoard: true })
        },
      },
      {
        read: async () => (boundPathRef.current ? readTextFile(boardContentPath(boundPathRef.current)) : null),
        write: async (store, revision, expected) => {
          handing.current = { store, revision, expected }
          try { await lifecycleRef.current.flush({ throwOnError: true }) } finally { handing.current = null }
        },
      },
    )
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveNow = useCallback(async (): Promise<void> => {
    if (saveTimer.current !== null) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (liveRef.current?.status === 'on') return
    if (!boundPathRef.current) {
      if (!touched.current) return
      const path = await lifecycleRef.current.ensureDraft()
      if (!path) return
      boundPathRef.current = path
    }
    if (fileRef.current?.unsaved) await fileRef.current.save()
  }, [])
  const saveSoon = useCallback((): void => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveNow().catch(() => saveSoonRef.current()) }, SAVE_AFTER_MS)
  }, [saveNow])
  saveSoonRef.current = saveSoon

  // What another copy saved comes in: when it says so, when this one is looked at again, and every so often.
  useEffect(() => {
    if (isStandaloneDevMode()) return
    const look = (): void => {
      if (liveRef.current?.status !== 'on' && boundPathRef.current && document.visibilityState === 'visible') void fileRef.current?.pickUp()
    }
    const hidden = (): void => { if (document.visibilityState === 'hidden') void saveNow().catch(() => undefined) }
    const every = window.setInterval(look, LOOK_EVERY_MS)
    window.addEventListener('focus', look)
    document.addEventListener('visibilitychange', look)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('beforeunload', hidden)
    const unclose = onClosingTab(() => { void saveNow().catch(() => undefined) })
    return () => {
      window.clearInterval(every)
      window.removeEventListener('focus', look)
      document.removeEventListener('visibilitychange', look)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('beforeunload', hidden)
      unclose()
    }
  }, [saveNow])

  // A board the organisation shares, edited live (useLiveJson): everyone's cards, columns and moves merged card by
  // card; the live copy writes the package, so this tab stops writing it itself while live.
  const live = useLiveJson(lifecycle.doc.path ? boardContentPath(lifecycle.doc.path) : null, {
    loadSaved: async path => JSON.parse(await readTextFile(path)) as Record<string, unknown>,
    onRemote: next => {
      let boardStore: TasksStore
      try {
        boardStore = parseTaskPackageStore(JSON.stringify(next))
      } catch {
        return
      }
      boundStoreRef.current = boardStore
      setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME)
      sessionRef.current.replaceStore(boardStore, { keepSelection: true, keepBoard: true })
    },
    serialize: () => {
      const path = lifecycleRef.current.doc.path
      const project = boundStoreRef.current.projects[0]
      if (!path || !project) return null
      return { resourcePath: path, files: taskPackageFiles(boundStoreRef.current, project, nowIso()) }
    },
    // Let go by the live copy: what is on screen is saved as the board always was.
    onEnded: () => saveSoonRef.current(),
  })
  liveRef.current = live

  // A copy held in a page shows the board it was given: that does not change which one the app comes back to.
  const rememberBoard = useCallback((path: string) => {
    if (!isHeldCopy()) void updateTasksSettings({ lastBoardPath: path }).catch(() => undefined)
  }, [])

  // Lifecycle-owned path changes (lazy draft, promote, rename) → remember it.
  const rememberedPath = useRef<string | null>(null)
  useEffect(() => {
    const path = lifecycle.doc.path
    if (path) boundPathRef.current = path
    if (!path || rememberedPath.current === path) return
    rememberedPath.current = path
    lastResourceRef.current = path
    rememberBoard(path)
  }, [lifecycle.doc.path, rememberBoard])

  const readBoard = useCallback(async (packagePath: string) => {
    return parseTaskPackageStore(
      await readTextFile(boardContentPath(packagePath)),
    )
  }, [])

  const openBoard = useCallback(
    async (packagePath: string, taskId?: string): Promise<void> => {
      const clean = packagePath.replace(/\/+$/, '')
      const revealTask = () => {
        if (taskId && sessionRef.current.readStore().tasks.some(task => task.id === taskId)) {
          sessionRef.current.setSelectedTask(taskId)
          setOpenTaskRequest({ taskId, at: ++taskRequestSequence.current })
        } else setOpenTaskRequest(null)
      }
      if (boundPathRef.current === clean) {
        // Returning to the bound board also supersedes an in-flight foreign open.
        openGeneration.current += 1
        setSwitcherOpen(false)
        revealTask()
        return
      }
      const generation = ++openGeneration.current
      const lifecycle = lifecycleRef.current
      await saveNow()
      await lifecycle.flush({ throwOnError: true })
      if (generation !== openGeneration.current)
        throw new Error('Board open superseded.')
      let boardStore: TasksStore
      let boardText: string
      try {
        boardText = await readTextFile(boardContentPath(clean))
        boardStore = parseTaskPackageStore(boardText)
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
      rememberedPath.current = clean
      touched.current = false
      fileRef.current?.opened(boardText)
      setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME)
      sessionRef.current.replaceStore(boardStore)
      setBoardViewRevision(value => value + 1)
      lifecycle.adopt(clean)
      setSwitcherOpen(false)
      rememberBoard(clean)
      revealTask()
    },
    [rememberBoard, saveNow],
  )
  const openBoardWithTask = useCallback((path: string, taskId?: string) => {
    setUiSettings(current => ({ ...current, place: 'board' }))
    // The requested card belongs to this open, never to another pending read.
    void openBoard(path, taskId).catch(() => undefined)
  }, [openBoard])

  const newBoard = useCallback(async (name?: string, template?: (typeof BOARD_TEMPLATES)[number]): Promise<void> => {
    const generation = ++openGeneration.current
    const lifecycle = lifecycleRef.current
    await saveNow()
    await lifecycle.flush({ throwOnError: true })
    if (generation !== openGeneration.current)
      throw new Error('New board superseded.')
    const boardStore = template
      ? { ...starterBoardStore(name?.trim() || `${template.label} board`), columns: template.columns.map(column => ({ ...column })) }
      : starterBoardStore(name?.trim() || NEW_BOARD_NAME)
    boundStoreRef.current = boardStore
    boundPathRef.current = null
    lastResourceRef.current = null
    touched.current = false
    fileRef.current?.opened(null)
    setOpenError(null)
    setOpenTaskRequest(null)
    // Commit the name synchronously: the lifecycle names the lazily-created
    // draft from the last *rendered* suggestedTitle, so a deferred render
    // would file this board under the previous board's name.
    flushSync(() =>
      setBoardName(boardStore.projects[0]?.name ?? NEW_BOARD_NAME),
    )
    sessionRef.current.replaceStore(boardStore)
    setUiSettings(current => ({ ...current, place: 'board' }))
    setBoardViewRevision(value => value + 1)
    lifecycle.reset()
    setSwitcherOpen(false)
  }, [saveNow])

  // Boot: bound resource → last board → fresh starter.
  const bootedRef = useRef(false)
  // Settles when the board this copy was given (or the one it comes back to) has been read, so a command waits for it.
  const bootSettled = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    bootSettled.current = (async () => {
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

  // Told by the page holding this copy: add a card to the board that is open, the way the quick add box does. It never
  // makes a board of its own, so with none open it says so.
  const lastAdded = useRef<string | null>(null)
  useHeldCommand(async (command, text) => {
    if (command === 'take') {
      const titles = titlesTaken(text)
      if (!titles.length) return { ok: false, say: 'There’s nothing there to make a task of.' }
      await bootSettled.current
      if (!boundPathRef.current && !touched.current) return { ok: false, say: 'There’s no board open here to add to. Open or make one in Tasks first.' }
      const session = sessionRef.current
      const columns = taskColumnsForStore(session.readStore())
      const column = columns.find(each => each.id === 'inbox') ?? columns.find(each => !each.done)
      if (!column) return { ok: false, say: 'This board has no column to add a task to.' }
      const ids: string[] = []
      for (const each of titles) {
        const id = await session.createTask(each, column.id)
        if (id) ids.push(id)
      }
      return ids.length
        ? { ok: true, say: `Added ${ids.length === 1 ? 'a task' : `${ids.length} tasks`} to ${boundStoreRef.current.projects[0]?.name ?? boardName}, in ${column.label}.`, undo: ids.join(',') }
        : { ok: false, say: 'The tasks weren’t added. Try again.' }
    }
    if (command === 'undo') {
      const session = sessionRef.current
      const ids = text.split(',').filter(id => session.readStore().tasks.some(task => task.id === id))
      await Promise.all(ids.map(id => session.deleteTask(id)))
      return { ok: true, say: ids.length ? `Took ${ids.length === 1 ? 'that task' : `those ${ids.length} tasks`} back off the board.` : 'Those tasks have already gone.' }
    }
    if (command !== 'add') return { ok: false, say: 'Tasks can’t do that.' }
    const title = text.trim()
    if (!title) return { ok: false, say: 'Say what to add, like: Write the plan by Friday.' }
    await bootSettled.current
    if (!boundPathRef.current && !touched.current) return { ok: false, say: 'There’s no board open here to add to. Open or make one in Tasks first.' }
    const current = sessionRef.current
    const columns = taskColumnsForStore(current.readStore())
    const column = columns.find(each => each.id === 'inbox') ?? columns.find(each => !each.done)
    if (!column) return { ok: false, say: 'This board has no column to add a task to.' }
    try {
      const id = await current.createTask(title, column.id)
      if (!id || !sessionRef.current.readStore().tasks.some(task => task.id === id)) return { ok: false, say: 'The task wasn’t added. Try again.' }
      lastAdded.current = id
    } catch (failure) {
      return { ok: false, say: failure instanceof Error ? failure.message : String(failure) }
    }
    return { ok: true, say: `Added “${title}” to ${boundStoreRef.current.projects[0]?.name ?? boardName}, in ${column.label}.`, ...(lastAdded.current ? { undo: lastAdded.current } : {}) }
  })

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
    touched.current = true
    await saveNow()
  }, [saveNow])

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
      {...(compact ? { 'data-compact-room': '' } : undefined)}
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
        key={`${boardViewRevision}:${openTaskRequest?.at ?? 0}`}
        session={session}
        board={board}
        boards={boardsIndex.boards}
        boardsLoading={boardsIndex.loading}
        boardsError={boardsIndex.error}
        onRetryBoards={boardsIndex.refresh}
        settings={openTaskRequest ? { ...uiSettings, place: 'board', selectedTaskId: openTaskRequest.taskId } : uiSettings}
        onSettingsChange={rememberUiSettings}
        onOpenBoard={openBoardWithTask}
        onNewBoard={template => void newBoard(undefined, template).catch(() => undefined)}
        initialOpenTaskId={openTaskRequest?.taskId ?? null}
        compact={compact}
      />
      <DocumentSwitcher
        appSlug={TASKS_APP_SLUG}
        suffixes={[TASK_PACKAGE_SUFFIX]}
        variant="modal"
        loadPreview={loadBoardPreview}
        open={switcherOpen}
        openError={openError}
        onClose={() => setSwitcherOpen(false)}
        onOpenDocument={path => { setUiSettings(current => ({ ...current, place: 'board' })); return openBoard(path).catch(() => undefined) }}
        onCreateNew={() => void newBoard().catch(() => undefined)}
        newLabel="New board"
        title="Open a board"
        itemNoun="board"
      />
    </AppFrame>
  )
}
