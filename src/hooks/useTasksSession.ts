import { useCallback, useMemo, useRef, useState } from 'react'
import { catalogOpen, createMission as createShellMission, missionsAvailable, openMission as openShellMission, readMissionStatus, updateTasksSettings } from '../bridge/platformBridge'
import { missionBrief, missionLive, missionRecord, type MissionKind } from '../lib/missions'
import {
  DEFAULT_FILTERS,
  archiveDoneTasks,
  columnAtLimit,
  createActivity,
  createTask,
  createTaskColumn,
  labelsForProject,
  moveTaskStatus,
  nextRepeatDue,
  normalizeResourceLink,
  taskColumnsForStore,
  taskStatusLabel,
  updateTaskDetails,
  visibleTasksForProject,
} from '../lib/taskModel'
import type {
  SuiteTask,
  TaskFilters,
  TaskPriority,
  TaskProject,
  TaskRepeat,
  TaskResourceLink,
  TaskStatus,
  TaskViewMode,
  TaskColumn,
  TasksAppSettings,
  TasksStore,
} from '../types'
import { useEffect } from 'react'

interface UseTasksSessionOptions {
  initialStore: TasksStore
  initialSettings: TasksAppSettings
  /** Path of the bound `.tasks` package (null while a board is unsaved). */
  boardPath: string | null
  /** Called after every board mutation with the new store — the document
   * lifecycle (in App) autosaves it into the bound `.tasks` package. */
  onMutated: (store: TasksStore) => void
  /** Bridge methods the shell advertised; missions need `missions.create`. */
  methods?: readonly string[]
}

export interface TasksSessionState {
  store: TasksStore
  storePath: string | null
  /** The board's single project. */
  activeProject: TaskProject
  selectedTask: SuiteTask | null
  columns: TaskColumn[]
  visibleColumns: TaskColumn[]
  hiddenColumns: TaskColumn[]
  visibleTasks: SuiteTask[]
  labels: string[]
  filters: TaskFilters
  viewMode: TaskViewMode
  setSelectedTask: (taskId: string | null) => void
  setViewMode: (mode: TaskViewMode) => void
  setFilters: (filters: TaskFilters) => void
  /** Rename the board's project (the naming surface). */
  renameActiveProject: (name: string) => void
  setActiveProjectDescription: (description: string) => void
  /** Load a board store opened from a `.tasks` package (not a mutation). */
  replaceStore: (
    store: TasksStore,
    options?: { keepSelection?: boolean },
  ) => void
  /** The live store, independent of render timing. */
  readStore: () => TasksStore
  /**
   * The one write path. The producer runs synchronously over the live store,
   * so back-to-back mutations (a burst of edits, two agent tool calls in one
   * tick) compose instead of the later one overwriting the earlier one.
   */
  applyStoreUpdate: (
    producer: (current: TasksStore) => TasksStore,
  ) => Promise<TasksStore>
  createTask: (title: string, status?: TaskStatus) => Promise<void>
  createColumn: (label: string) => Promise<void>
  renameColumn: (status: TaskStatus, label: string) => Promise<void>
  reorderColumn: (
    status: TaskStatus,
    beforeStatus?: TaskStatus,
  ) => Promise<void>
  patchColumn: (
    status: TaskStatus,
    patch: Partial<Pick<TaskColumn, 'collapsed' | 'hidden' | 'done' | 'wipLimit'>>,
  ) => Promise<void>
  setArchiveDoneAfterDays: (days: number) => void
  deleteColumn: (status: TaskStatus, targetStatus?: TaskStatus) => Promise<void>
  isDoneStatus: (status: TaskStatus) => boolean
  updateTask: (
    taskId: string,
    patch: Partial<{
      title: string
      notes: string
      priority: TaskPriority
      ownerName: string
      labels: string[]
      dueAt: string
      checklists: SuiteTask['checklists']
      comments: SuiteTask['comments']
      blockedBy: string[]
      parentId: string | undefined
      estimateHours: number | undefined
      loggedHours: number | undefined
      repeat: TaskRepeat | undefined
      remindAt: string | undefined
      archivedAt: string | undefined
    }>,
  ) => Promise<void>
  /** Refused (returns false) when the target column is at its WIP limit, unless forced. */
  moveTask: (taskId: string, status: TaskStatus, options?: { force?: boolean }) => Promise<boolean>
  moveTasks: (taskIds: string[], status: TaskStatus) => Promise<void>
  /** A card under another: same column, parentId set. */
  createSubtask: (parentId: string, title: string) => Promise<string | null>
  /** Done cards past the board's archive window leave the board. */
  archiveDone: () => Promise<number>
  restoreArchived: (taskId: string) => Promise<void>
  archivedTasks: SuiteTask[]
  /** Missions: the card is the brief, the shell runs it. */
  missionsEnabled: boolean
  createMissionForTask: (taskId: string, kind: MissionKind) => Promise<{ id: string; title: string }>
  refreshMissions: () => Promise<void>
  openMission: (missionId: string) => Promise<void>
  reorderTask: (
    taskId: string,
    status: TaskStatus,
    beforeTaskId?: string,
  ) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  addLink: (taskId: string, link: Omit<TaskResourceLink, 'id'>) => Promise<void>
  removeLink: (taskId: string, linkId: string) => Promise<void>
  openLink: (link: TaskResourceLink) => Promise<void>
}

function resolveFilters(settings: TasksAppSettings): TaskFilters {
  return { ...DEFAULT_FILTERS, ...settings.filters }
}

function nowIso(): string {
  return new Date().toISOString()
}

export function useTasksSession({
  initialStore,
  initialSettings,
  boardPath,
  onMutated,
  methods,
}: UseTasksSessionOptions): TasksSessionState {
  const [store, setStore] = useState(initialStore)
  // The store React renders from, mirrored in a ref that every mutation
  // updates synchronously. Producers run against the ref, never against a
  // possibly-stale render or a deferred React updater.
  const storeRef = useRef(initialStore)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialSettings.selectedTaskId ?? null,
  )
  const [filters, setFiltersState] = useState<TaskFilters>(
    resolveFilters(initialSettings),
  )
  const [viewMode, setViewModeState] = useState<TaskViewMode>(
    initialSettings.viewMode ?? 'board',
  )
  const activeProject = store.projects[0]
  const columns = useMemo(() => taskColumnsForStore(store), [store])
  const visibleColumns = useMemo(
    () => columns.filter(column => !column.hidden),
    [columns],
  )
  const hiddenColumns = useMemo(
    () => columns.filter(column => column.hidden),
    [columns],
  )
  const visibleTasks = useMemo(
    () => visibleTasksForProject(store, activeProject.id, filters),
    [activeProject.id, filters, store],
  )
  const selectedTask =
    store.tasks.find(task => task.id === selectedTaskId && !task.archivedAt) ??
    visibleTasks[0] ??
    null
  const labels = useMemo(
    () => labelsForProject(store, activeProject.id),
    [activeProject.id, store],
  )
  const archivedTasks = useMemo(
    () => store.tasks.filter(task => task.archivedAt).sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [store],
  )
  const missionsEnabled = missionsAvailable(methods ?? [])

  const readStore = useCallback(() => storeRef.current, [])

  // Every board mutation updates in-memory state and notifies App, which
  // autosaves it into the bound `.tasks` package through the document
  // lifecycle. There is no global store write any more.
  const applyStoreUpdate = useCallback(
    async (producer: (current: TasksStore) => TasksStore) => {
      const next = producer(storeRef.current)
      if (next === storeRef.current) return next
      storeRef.current = next
      setStore(next)
      onMutated(next)
      return next
    },
    [onMutated],
  )

  const replaceStore = useCallback(
    (next: TasksStore, options?: { keepSelection?: boolean }) => {
      storeRef.current = next
      setStore(next)
      if (!options?.keepSelection) setSelectedTaskId(null)
    },
    [],
  )

  const updateActiveProject = useCallback(
    (patch: Partial<Pick<TaskProject, 'name' | 'description'>>) => {
      void applyStoreUpdate(current => ({
        ...current,
        projects: current.projects.map((project, index) =>
          index === 0 ? { ...project, ...patch, updatedAt: nowIso() } : project,
        ),
      }))
    },
    [applyStoreUpdate],
  )

  const renameActiveProject = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed || trimmed === storeRef.current.projects[0]?.name) return
      updateActiveProject({ name: trimmed })
    },
    [updateActiveProject],
  )

  const setActiveProjectDescription = useCallback(
    (description: string) => {
      const trimmed = description.trim()
      if (trimmed === storeRef.current.projects[0]?.description) return
      updateActiveProject({ description: trimmed })
    },
    [updateActiveProject],
  )

  const persistSettings = useCallback(
    async (patch: Partial<TasksAppSettings>) => {
      await updateTasksSettings(patch).catch(() => undefined)
    },
    [],
  )

  const setSelectedTask = useCallback(
    (taskId: string | null) => {
      setSelectedTaskId(taskId)
      void persistSettings({ selectedTaskId: taskId ?? undefined })
    },
    [persistSettings],
  )

  const setViewMode = useCallback(
    (mode: TaskViewMode) => {
      setViewModeState(mode)
      void persistSettings({ viewMode: mode })
    },
    [persistSettings],
  )

  const setFilters = useCallback(
    (next: TaskFilters) => {
      setFiltersState(next)
      void persistSettings({ filters: next })
    },
    [persistSettings],
  )

  const createTaskAction = useCallback(
    async (title: string, status: TaskStatus = 'inbox') => {
      const trimmed = title.trim()
      if (!trimmed) return
      let createdId: string | null = null
      await applyStoreUpdate(current => {
        const created = createTask(current.projects[0].id, trimmed, status)
        const task = moveTaskStatus(
          created,
          status,
          created.updatedAt,
          undefined,
          Boolean(
            taskColumnsForStore(current).find(column => column.id === status)
              ?.done,
          ),
        )
        createdId = task.id
        const activity = createActivity(task.id, 'create', 'Created task')
        return {
          ...current,
          tasks: [task, ...current.tasks],
          activity: [activity, ...current.activity],
        }
      })
      if (createdId) setSelectedTask(createdId)
    },
    [applyStoreUpdate, setSelectedTask],
  )

  const createColumn = useCallback(
    async (label: string) => {
      await applyStoreUpdate(current => {
        const existing = taskColumnsForStore(current)
        const column = createTaskColumn(label, existing)
        if (!column) return current
        return { ...current, columns: [...existing, column] }
      })
    },
    [applyStoreUpdate],
  )

  const isDoneStatus = useCallback(
    (status: TaskStatus) =>
      Boolean(columns.find(column => column.id === status)?.done),
    [columns],
  )

  const renameColumn = useCallback(
    async (status: TaskStatus, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      await applyStoreUpdate(current => ({
        ...current,
        columns: taskColumnsForStore(current).map(column =>
          column.id === status ? { ...column, label: trimmed } : column,
        ),
      }))
    },
    [applyStoreUpdate],
  )

  const reorderColumn = useCallback(
    async (status: TaskStatus, beforeStatus?: TaskStatus) => {
      if (status === beforeStatus) return
      await applyStoreUpdate(current => {
        const ordered = taskColumnsForStore(current)
        const moving = ordered.find(column => column.id === status)
        if (!moving) return current
        const rest = ordered.filter(column => column.id !== status)
        const beforeIndex = beforeStatus
          ? rest.findIndex(column => column.id === beforeStatus)
          : -1
        rest.splice(beforeIndex >= 0 ? beforeIndex : rest.length, 0, moving)
        return { ...current, columns: rest }
      })
    },
    [applyStoreUpdate],
  )

  const setArchiveDoneAfterDays = useCallback(
    (days: number) => {
      const clean = Math.max(0, Math.min(365, Math.floor(days)))
      updateActiveProject({ archiveDoneAfterDays: clean } as Partial<Pick<TaskProject, 'name' | 'description'>>)
    },
    [updateActiveProject],
  )

  const patchColumn = useCallback(
    async (
      status: TaskStatus,
      patch: Partial<Pick<TaskColumn, 'collapsed' | 'hidden' | 'done' | 'wipLimit'>>,
    ) => {
      await applyStoreUpdate(current => {
        const columns = taskColumnsForStore(current)
        const column = columns.find(column => column.id === status)
        if (!column) return current
        const completionChanged =
          patch.done !== undefined && Boolean(column.done) !== patch.done
        const now = nowIso()
        return {
          ...current,
          columns: columns.map(column =>
            column.id === status
              ? { ...column, ...patch, ...(patch.wipLimit !== undefined && !(patch.wipLimit > 0) ? { wipLimit: undefined } : {}) }
              : column,
          ),
          tasks: completionChanged
            ? current.tasks.map(task =>
                task.status === status
                  ? moveTaskStatus(task, status, now, undefined, patch.done)
                  : task,
              )
            : current.tasks,
        }
      })
    },
    [applyStoreUpdate],
  )

  const deleteColumn = useCallback(
    async (status: TaskStatus, targetStatus?: TaskStatus) => {
      await applyStoreUpdate(current => {
        const currentColumns = taskColumnsForStore(current)
        const remaining = currentColumns.filter(column => column.id !== status)
        if (
          remaining.length === currentColumns.length ||
          remaining.length === 0
        )
          return current
        const target =
          targetStatus && remaining.some(column => column.id === targetStatus)
            ? targetStatus
            : remaining.find(column => !column.hidden)?.id ?? remaining[0].id
        const targetDone = Boolean(
          remaining.find(column => column.id === target)?.done,
        )
        const now = nowIso()
        return {
          ...current,
          columns: remaining,
          tasks: current.tasks.map(task =>
            task.status === status
              ? moveTaskStatus(task, target, now, task.order, targetDone)
              : task,
          ),
        }
      })
    },
    [applyStoreUpdate],
  )

  const updateTask = useCallback(
    async (
      taskId: string,
      patch: Parameters<TasksSessionState['updateTask']>[1],
    ) => {
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.map(task =>
          task.id === taskId ? updateTaskDetails(task, patch) : task,
        ),
      }))
    },
    [applyStoreUpdate],
  )

  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus, options?: { force?: boolean }) => {
      const before = storeRef.current.tasks.find(candidate => candidate.id === taskId)
      if (!before || before.status === status) return true
      if (!options?.force && columnAtLimit(storeRef.current, status)) return false
      await applyStoreUpdate(current => {
        const task = current.tasks.find(candidate => candidate.id === taskId)
        if (!task || task.status === status) return current
        const currentColumns = taskColumnsForStore(current)
        const done = Boolean(
          currentColumns.find(column => column.id === status)?.done,
        )
        const now = nowIso()
        const activity = createActivity(
          taskId,
          'move',
          `Moved to ${taskStatusLabel(currentColumns, status)}`,
          now,
        )
        const moved = moveTaskStatus(task, status, now, undefined, done)
        // A repeating card that is done comes back as a fresh open card.
        const repeatDue = done && task.repeat ? nextRepeatDue(task.dueAt, task.repeat) : undefined
        const firstOpen = currentColumns.find(column => !column.done && !column.hidden)?.id ?? 'inbox'
        const reborn = repeatDue
          ? updateTaskDetails(
              { ...createTask(task.projectId, task.title, firstOpen), notes: task.notes, priority: task.priority, ownerName: task.ownerName, labels: task.labels, links: task.links, repeat: task.repeat, estimateHours: task.estimateHours, parentId: task.parentId },
              { dueAt: repeatDue, checklists: task.checklists.map(list => ({ ...list, items: list.items.map(item => ({ ...item, done: false })) })) },
              now,
            )
          : null
        return {
          ...current,
          tasks: [
            ...(reborn ? [reborn] : []),
            ...current.tasks.map(candidate => (candidate.id === taskId ? moved : candidate)),
          ],
          activity: [
            ...(reborn ? [createActivity(reborn.id, 'create', `Repeats ${task.repeat}: next due ${repeatDue}`, now)] : []),
            activity,
            ...current.activity,
          ],
        }
      })
      return true
    },
    [applyStoreUpdate],
  )

  const moveTasks = useCallback(
    async (taskIds: string[], status: TaskStatus) => {
      for (const taskId of taskIds) await moveTask(taskId, status, { force: true })
    },
    [moveTask],
  )

  const createSubtask = useCallback(
    async (parentId: string, title: string) => {
      const trimmed = title.trim()
      const parent = storeRef.current.tasks.find(task => task.id === parentId)
      if (!trimmed || !parent) return null
      let createdId: string | null = null
      await applyStoreUpdate(current => {
        const created = updateTaskDetails(createTask(current.projects[0].id, trimmed, parent.status), { parentId }, nowIso())
        createdId = created.id
        return {
          ...current,
          tasks: [...current.tasks, created],
          activity: [createActivity(created.id, 'create', `Created as a subtask of “${parent.title}”`), ...current.activity],
        }
      })
      return createdId
    },
    [applyStoreUpdate],
  )

  const archiveDone = useCallback(async () => {
    let count = 0
    await applyStoreUpdate(current => {
      const next = archiveDoneTasks(current)
      if (next === current) return current
      count = next.tasks.filter(task => task.archivedAt).length - current.tasks.filter(task => task.archivedAt).length
      return next
    })
    return count
  }, [applyStoreUpdate])

  const restoreArchived = useCallback(
    async (taskId: string) => {
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.map(task => (task.id === taskId ? updateTaskDetails(task, { archivedAt: undefined }) : task)),
        activity: [createActivity(taskId, 'restore', 'Restored from the archive'), ...current.activity],
      }))
    },
    [applyStoreUpdate],
  )

  // Once a board is open, done cards past the archive window leave it.
  useEffect(() => {
    const timer = setTimeout(() => { void archiveDone() }, 1500)
    return () => clearTimeout(timer)
  }, [archiveDone, activeProject.id])

  const createMissionForTask = useCallback(
    async (taskId: string, kind: MissionKind) => {
      const task = storeRef.current.tasks.find(candidate => candidate.id === taskId)
      if (!task) throw new Error('Unknown task.')
      if (!missionsEnabled) throw new Error('This shell does not offer missions to apps yet.')
      const brief = missionBrief(kind, task, boardPath, taskColumnsForStore(storeRef.current))
      const mission = await createShellMission({ ...brief, autoStart: true })
      const record = missionRecord(mission.id, brief.title)
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.map(candidate =>
          candidate.id === taskId
            ? updateTaskDetails(candidate, {
                missions: [...candidate.missions, { ...record, phase: 'planning' }],
                links: [...candidate.links, normalizeResourceLink({ type: 'mission', title: `Mission · ${brief.title}`, resourceId: mission.id })],
              })
            : candidate,
        ),
        activity: [createActivity(taskId, 'mission', `Mission created: ${kind === 'do' ? 'do the task' : kind === 'steps' ? 'break it into steps' : kind === 'draft' ? 'draft the linked document' : 'find what it depends on'}`), ...current.activity],
      }))
      return { id: mission.id, title: brief.title }
    },
    [applyStoreUpdate, boardPath, missionsEnabled],
  )

  const refreshMissions = useCallback(async () => {
    if (!missionsEnabled) return
    const live = storeRef.current.tasks.flatMap(task => task.missions.filter(missionLive).map(mission => ({ taskId: task.id, mission })))
    if (!live.length) return
    const statuses = await Promise.all(live.map(async entry => ({ ...entry, status: await readMissionStatus(entry.mission.id).catch(() => null) })))
    const changed = statuses.filter(entry => entry.status && entry.status.phase !== entry.mission.phase)
    if (!changed.length) return
    const now = nowIso()
    await applyStoreUpdate(current => ({
      ...current,
      tasks: current.tasks.map(task => {
        const mine = changed.filter(entry => entry.taskId === task.id)
        if (!mine.length) return task
        return updateTaskDetails(task, {
          missions: task.missions.map(mission => {
            const hit = mine.find(entry => entry.mission.id === mission.id)
            return hit?.status ? { ...mission, phase: hit.status.phase, checkedAt: now } : mission
          }),
        }, now)
      }),
      activity: [
        ...changed.filter(entry => entry.status && ['done', 'failed', 'needsYou'].includes(entry.status.phase)).map(entry => createActivity(entry.taskId, 'mission', `Mission ${entry.status!.phase === 'done' ? 'finished' : entry.status!.phase === 'failed' ? 'failed' : 'needs you'}: ${entry.mission.title}`, now)),
        ...current.activity,
      ],
    }))
  }, [applyStoreUpdate, missionsEnabled])

  // Live missions are polled while the board is open; the card shows the phase.
  useEffect(() => {
    if (!missionsEnabled) return
    const hasLive = store.tasks.some(task => task.missions.some(missionLive))
    if (!hasLive) return
    const timer = setInterval(() => { void refreshMissions() }, 8000)
    void refreshMissions()
    return () => clearInterval(timer)
  }, [missionsEnabled, refreshMissions, store])

  const openMission = useCallback(async (missionId: string) => { await openShellMission(missionId) }, [])

  const reorderTask = useCallback(
    async (taskId: string, status: TaskStatus, beforeTaskId?: string) => {
      await applyStoreUpdate(current => {
        const movingTask = current.tasks.find(task => task.id === taskId)
        if (!movingTask) return current
        const currentColumns = taskColumnsForStore(current)
        const columnTasks = current.tasks
          .filter(task => task.id !== taskId && task.status === status)
          .sort((a, b) => a.order - b.order)
        const beforeIndex = beforeTaskId
          ? columnTasks.findIndex(task => task.id === beforeTaskId)
          : -1
        const insertIndex = beforeIndex >= 0 ? beforeIndex : columnTasks.length
        const statusChanged = movingTask.status !== status
        const done = Boolean(
          currentColumns.find(column => column.id === status)?.done,
        )
        // Renumber the whole column so orders never tie (ties made drops land
        // somewhere else than the line showed); the moving card takes its slot.
        const sequence = [...columnTasks]
        sequence.splice(insertIndex, 0, movingTask)
        const orders = new Map(sequence.map((task, index) => [task.id, (index + 1) * 1000]))
        const now = nowIso()
        return {
          ...current,
          tasks: current.tasks.map(task =>
            task.id === taskId
              ? moveTaskStatus(task, status, now, orders.get(task.id), done)
              : orders.has(task.id) && task.order !== orders.get(task.id)
              ? { ...task, order: orders.get(task.id)! }
              : task,
          ),
          activity: statusChanged
            ? [
                createActivity(
                  taskId,
                  'move',
                  `Moved to ${taskStatusLabel(currentColumns, status)}`,
                ),
                ...current.activity,
              ]
            : current.activity,
        }
      })
    },
    [applyStoreUpdate],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.filter(task => task.id !== taskId),
        activity: current.activity.filter(item => item.taskId !== taskId),
      }))
      setSelectedTask(null)
    },
    [applyStoreUpdate, setSelectedTask],
  )

  const addLink = useCallback(
    async (taskId: string, link: Omit<TaskResourceLink, 'id'>) => {
      const normalized = normalizeResourceLink(link)
      const activity = createActivity(
        taskId,
        'link',
        `Linked ${normalized.title}`,
      )
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.map(task =>
          task.id === taskId
            ? updateTaskDetails(task, { links: [...task.links, normalized] })
            : task,
        ),
        activity: [activity, ...current.activity],
      }))
    },
    [applyStoreUpdate],
  )

  const removeLink = useCallback(
    async (taskId: string, linkId: string) => {
      await applyStoreUpdate(current => ({
        ...current,
        tasks: current.tasks.map(task =>
          task.id === taskId
            ? updateTaskDetails(task, {
                links: task.links.filter(link => link.id !== linkId),
              })
            : task,
        ),
      }))
    },
    [applyStoreUpdate],
  )

  const openLink = useCallback(async (link: TaskResourceLink) => {
    if (!link.path?.trim()) return
    await catalogOpen({
      path: link.path,
      name: link.title,
      ...(link.appSlug ? { appSlug: link.appSlug } : {}),
    })
  }, [])

  return {
    store,
    storePath: boardPath,
    activeProject,
    selectedTask,
    columns,
    visibleColumns,
    hiddenColumns,
    visibleTasks,
    labels,
    filters,
    viewMode,
    setSelectedTask,
    setViewMode,
    setFilters,
    renameActiveProject,
    setActiveProjectDescription,
    replaceStore,
    readStore,
    applyStoreUpdate,
    createTask: createTaskAction,
    createColumn,
    renameColumn,
    reorderColumn,
    patchColumn,
    setArchiveDoneAfterDays,
    deleteColumn,
    isDoneStatus,
    updateTask,
    moveTask,
    moveTasks,
    createSubtask,
    archiveDone,
    restoreArchived,
    archivedTasks,
    missionsEnabled,
    createMissionForTask,
    refreshMissions,
    openMission,
    reorderTask,
    deleteTask,
    addLink,
    removeLink,
    openLink,
  }
}
