import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlatformDeepLink } from '@purescience/platform-ui/bridge/react/usePlatformDeepLink'
import type { TasksBoardApi } from '../App'
import type { BoardIndexEntry } from '../hooks/useBoardsIndex'
import type { TasksSessionState } from '../hooks/useTasksSession'
import { updateTasksSettings } from '../bridge/platformBridge'
import { DEFAULT_FILTERS, dueBucket, isBlocked } from '../lib/taskModel'
import type { TasksAppSettings, TasksPlace } from '../types'
import { useAppearance } from '../hooks/useAppearance'
import { BoardsHome, type BOARD_TEMPLATES } from './glass/BoardsHome'
import { FilterBar, type GroupBy, type Swimlanes } from './glass/FilterBar'
import { GlassBoardView } from './glass/GlassBoardView'
import { GlassListView } from './glass/GlassListView'
import { Body, GlassShell, Main, Toast } from './glass/glassStyles'
import { crossBoardTasks, MyDayView, taskRef, todayKey, UpcomingView, type CrossTask } from './glass/MyDayView'
import { TaskCardOverlay } from './glass/TaskCardOverlay'
import { TaskPeek } from './glass/TaskPeek'
import { TasksRail } from './glass/TasksRail'
import { TasksTopBar } from './glass/TasksTopBar'
import { GlassActivityView } from './glass/GlassActivityView'
import { GlassCalendarView } from './glass/GlassCalendarView'
import { GlassTimelineView } from './glass/GlassTimelineView'

interface PureTasksShellProps {
  session: TasksSessionState
  board: TasksBoardApi
  boards: BoardIndexEntry[]
  boardsLoading: boolean
  settings: TasksAppSettings
  /** Open another board; with a task id, open that card once it is loaded. */
  onOpenBoard: (path: string, taskId?: string) => void
  onNewBoard: (template: (typeof BOARD_TEMPLATES)[number]) => void
  /** A card to open straight away (a board opened for one of its cards). */
  initialOpenTaskId?: string | null
}

export function PureTasksShell({ session, board, boards, boardsLoading, settings, onOpenBoard, onNewBoard, initialOpenTaskId }: PureTasksShellProps): React.ReactElement {
  const [place, setPlaceState] = useState<TasksPlace>(settings.place ?? 'board')
  const [groupBy, setGroupByState] = useState<GroupBy>(settings.groupBy ?? 'none')
  const [swimlanes, setSwimlanesState] = useState<Swimlanes>(settings.swimlanes ?? 'none')
  const [myDay, setMyDayState] = useState<Record<string, string[]>>(settings.myDay ?? {})
  const appearance = useAppearance()
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId ?? null)
  const [peek, setPeek] = useState<{ taskId: string; rect: DOMRect } | null>(null)
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  const setPlace = useCallback((next: TasksPlace) => { setPlaceState(next); setPeek(null); setSelection(new Set()); void updateTasksSettings({ place: next }).catch(() => undefined) }, [])

  useEffect(() => {
    setPeek(null)
  }, [session.viewMode])
  const setGroupBy = useCallback((next: GroupBy) => { setGroupByState(next); void updateTasksSettings({ groupBy: next }).catch(() => undefined) }, [])
  const setSwimlanes = useCallback((next: Swimlanes) => { setSwimlanesState(next); void updateTasksSettings({ swimlanes: next }).catch(() => undefined) }, [])
  const chosenToday = useMemo(() => new Set(myDay[todayKey()] ?? []), [myDay])
  const chooseForDay = useCallback((ref: string, on: boolean) => {
    setMyDayState(current => {
      const key = todayKey()
      const today = new Set(current[key] ?? [])
      if (on) today.add(ref); else today.delete(ref)
      // Keep only today and yesterday so the setting never grows.
      const kept: Record<string, string[]> = { [key]: Array.from(today) }
      const next = { ...kept }
      void updateTasksSettings({ myDay: next }).catch(() => undefined)
      return next
    })
  }, [])

  const openTask = useCallback((taskId: string) => { setPeek(null); session.setSelectedTask(taskId); setOpenTaskId(taskId) }, [session])
  const closeTask = useCallback(() => setOpenTaskId(null), [])
  const toggleSelect = useCallback((taskId: string, all?: string[]) => {
    setSelection(current => {
      const next = new Set(current)
      if (all) { for (const id of all) next.add(id); return next }
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId)
      return next
    })
  }, [])
  const openCross = useCallback((entry: CrossTask) => {
    if (entry.foreign) onOpenBoard(entry.board.path, entry.task.id)
    else { setPlace('board'); openTask(entry.task.id) }
  }, [onOpenBoard, openTask, setPlace])

  usePlatformDeepLink('tasks', taskId => {
    if (session.store.tasks.some(task => task.id === taskId)) { setPlace('board'); openTask(taskId) }
  })

  // Keyboard: N new task, / search, Esc clears selection and peeks.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target as HTMLElement | null)?.isContentEditable
      if (openTaskId) return
      if (event.key === 'Escape') { if (peek) setPeek(null); else if (selection.size) setSelection(new Set()); return }
      if (editing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '/' && place === 'board') { event.preventDefault(); searchRef.current?.focus() }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); void newTask() }
      if (event.key.toLowerCase() === 'a' && place === 'board' && session.selectedTask) {
        event.preventDefault()
        toggleSelect('', session.visibleTasks.filter(task => task.status === session.selectedTask?.status).map(task => task.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function newTask(): Promise<void> {
    if (place !== 'board') setPlace('board')
    session.setFilters(DEFAULT_FILTERS)
    if (session.viewMode !== 'board') session.setViewMode('board')
    const first = session.columns.find(column => !column.hidden && !column.done)?.id ?? 'inbox'
    await session.createTask('New task', first)
    const created = session.readStore().tasks.find(task => task.title === 'New task' && task.status === first)
    if (created) openTask(created.id)
  }

  const cross = useMemo(() => crossBoardTasks(boards, board.path).filter(entry => !entry.done), [boards, board.path])
  const counts = useMemo(() => ({
    myDay: cross.filter(entry => dueBucket(entry.task) === 'overdue' || dueBucket(entry.task) === 'today' || chosenToday.has(taskRef(entry))).length,
    upcoming: cross.filter(entry => { const bucket = dueBucket(entry.task); return bucket === 'tomorrow' || bucket === 'week' || bucket === 'later' }).length,
    unfiled: 0,
  }), [cross, chosenToday])

  const summary = (() => {
    const open = session.visibleTasks.filter(task => !session.isDoneStatus(task.status))
    const overdue = open.filter(task => dueBucket(task) === 'overdue').length
    const blocked = open.filter(task => isBlocked(task, session.store)).length
    const days = session.activeProject.archiveDoneAfterDays ?? 14
    return `${session.visibleTasks.length} task${session.visibleTasks.length === 1 ? '' : 's'}${overdue ? ` · ${overdue} overdue` : ''}${blocked ? ` · ${blocked} blocked` : ''} · ${days ? `Done archives after ${days} days` : 'Done kept'} · ${board.savedLabel}`
  })()

  // Dev only: lets a CDP probe read the live session (never in a build).
  if (import.meta.env.DEV) (window as unknown as { __tasks?: unknown }).__tasks = session
  const openTask_ = openTaskId ? session.store.tasks.find(task => task.id === openTaskId) ?? null : null
  const peekTask = peek ? session.store.tasks.find(task => task.id === peek.taskId) ?? null : null
  const openRef = openTask_ && board.path ? `${board.path.replace(/\/+$/, '')}#${openTask_.id}` : null

  return (
    <GlassShell data-place={place} data-appearance={appearance}>
      <TasksTopBar session={session} place={place} boardName={board.title} onOpenSwitcher={board.openSwitcher} onNewTask={() => void newTask()} searchRef={searchRef} />
      <Body onMouseDown={() => { if (peek) setPeek(null) }}>
        <TasksRail place={place} boards={boards} openPath={board.path} counts={counts} onPlace={setPlace} onOpenBoard={path => { setPlace('board'); if (path !== board.path) onOpenBoard(path) }} />
        <Main>
          {place === 'board' ? (
            <>
              <FilterBar session={session} groupBy={groupBy} swimlanes={swimlanes} onGroupBy={setGroupBy} onSwimlanes={setSwimlanes} selection={selection} onClearSelection={() => setSelection(new Set())} onToast={onToast} summary={summary} />
              {session.viewMode === 'board' ? <GlassBoardView session={session} callbacks={{ onOpenTask: openTask, onPeek: (taskId, rect) => setPeek({ taskId, rect }), onDragBegin: () => setPeek(null), selection, onToggleSelect: toggleSelect, onToast, swimlanes }} /> : null}
              {session.viewMode === 'list' ? <GlassListView session={session} groupBy={groupBy} onOpenTask={openTask} /> : null}
              {session.viewMode === 'calendar' ? <GlassCalendarView session={session} onOpenTask={openTask} /> : null}
              {session.viewMode === 'timeline' ? <GlassTimelineView session={session} onOpenTask={openTask} /> : null}
              {session.viewMode === 'activity' || session.viewMode === 'files' ? <GlassActivityView session={session} onOpenTask={openTask} /> : null}
            </>
          ) : null}
          {place === 'myDay' ? <MyDayView session={session} boards={boards} openPath={board.path} chosen={chosenToday} onChoose={chooseForDay} onOpen={openCross} onToast={onToast} /> : null}
          {place === 'upcoming' ? <UpcomingView boards={boards} openPath={board.path} onOpen={openCross} /> : null}
          {place === 'boards' ? <BoardsHome boards={boards} openPath={board.path} loading={boardsLoading} onOpenBoard={path => { setPlace('board'); onOpenBoard(path) }} onNewBoard={template => { setPlace('board'); onNewBoard(template) }} /> : null}
        </Main>
      </Body>
      {peekTask && peek && !openTaskId ? <TaskPeek session={session} task={peekTask} anchor={peek.rect} onClose={() => setPeek(null)} onOpen={() => openTask(peekTask.id)} onToast={onToast} /> : null}
      {openTask_ ? <TaskCardOverlay session={session} task={openTask_} onClose={closeTask} onOpenTask={openTask} onToast={onToast} inMyDay={openRef ? chosenToday.has(openRef) : false} onToggleMyDay={() => { if (!openRef) { onToast('Save the board first.'); return } const on = !chosenToday.has(openRef); chooseForDay(openRef, on); onToast(on ? 'Added to My day' : 'Taken off My day') }} /> : null}
      {toast ? <Toast role="status">{toast}</Toast> : null}
    </GlassShell>
  )
}
