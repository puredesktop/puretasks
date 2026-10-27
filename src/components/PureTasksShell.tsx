import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePlatformDeepLink } from '@purescience/platform-ui/bridge/react/usePlatformDeepLink'
import type { TasksBoardApi } from '../App'
import type { BoardIndexEntry } from '../hooks/useBoardsIndex'
import type { TasksSessionState } from '../hooks/useTasksSession'
import { updateTasksSettings } from '../bridge/platformBridge'
import { dueBucket, isBlocked, isReviewStatus } from '../lib/taskModel'
import type { TasksAppSettings, TasksPlace } from '../types'
import { useAppearance } from '../hooks/useAppearance'
import { BoardsHome, type BOARD_TEMPLATES } from './glass/BoardsHome'
import { FilterBar, type GroupBy, type Swimlanes } from './glass/FilterBar'
import { GlassBoardView } from './glass/GlassBoardView'
import { GlassListView } from './glass/GlassListView'
import { Body, GlassShell, Main, Toast } from './glass/glassStyles'
import { crossBoardTasks, MyDayView, ReviewView, taskRef, todayKey, UpcomingView, type CrossTask } from './glass/MyDayView'
import { TaskCardOverlay } from './glass/TaskCardOverlay'
import { TaskPeek } from './glass/TaskPeek'
import { TasksRail } from './glass/TasksRail'
import { TasksTopBar } from './glass/TasksTopBar'
import { QuickCapture } from './glass/QuickCapture'
import { boardAgentRefs } from '../agentRefs'
import { GlassActivityView } from './glass/GlassActivityView'
import { GlassCalendarView } from './glass/GlassCalendarView'
import { GlassTimelineView } from './glass/GlassTimelineView'

/** A narrow window starts with its side panels put away, until the person says otherwise. */
const narrowWindow = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches

interface PureTasksShellProps {
  session: TasksSessionState
  board: TasksBoardApi
  boards: BoardIndexEntry[]
  boardsLoading: boolean
  boardsError?: string | null
  onRetryBoards?: () => Promise<void>
  settings: TasksAppSettings
  onSettingsChange?: (patch: Partial<TasksAppSettings>) => void
  /** Open another board; with a task id, open that card once it is loaded. */
  onOpenBoard: (path: string, taskId?: string) => void
  onNewBoard: (template: (typeof BOARD_TEMPLATES)[number]) => void
  /** A card to open straight away (a board opened for one of its cards). */
  initialOpenTaskId?: string | null
}

export function PureTasksShell({ session, board, boards, boardsLoading, boardsError, onRetryBoards, settings, onSettingsChange, onOpenBoard, onNewBoard, initialOpenTaskId }: PureTasksShellProps): React.ReactElement {
  const [place, setPlaceState] = useState<TasksPlace>(settings.place ?? 'board')
  const [groupBy, setGroupByState] = useState<GroupBy>(settings.groupBy ?? 'none')
  const [swimlanes, setSwimlanesState] = useState<Swimlanes>(settings.swimlanes ?? 'none')
  const [myDay, setMyDayState] = useState<Record<string, string[]>>(settings.myDay ?? {})
  const dayChoices = useRef(myDay)
  const choiceWrites = useRef(Promise.resolve())
  const [dayKey, setDayKey] = useState(todayKey)
  const [railOpen, setRailOpen] = useState<boolean>(() => settings.railOpen ?? !narrowWindow())
  const [detailsOpen, setDetailsOpen] = useState<boolean>(() => settings.cardDetailsOpen ?? !narrowWindow())
  const appearance = useAppearance()
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId ?? null)
  const [peek, setPeek] = useState<{ taskId: string; rect: DOMRect } | null>(null)
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set())
  const [capturing, setCapturing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveSettings = useCallback(async (patch: Partial<TasksAppSettings>) => {
    await updateTasksSettings(patch)
    onSettingsChange?.(patch)
  }, [onSettingsChange])
  useEffect(() => {
    if (settings.myDay) { dayChoices.current = settings.myDay; setMyDayState(settings.myDay) }
  }, [settings.myDay])

  useEffect(() => { setPlaceState(settings.place ?? 'board') }, [settings.place])

  const onToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const setPlace = useCallback((next: TasksPlace) => { setPlaceState(next); setPeek(null); setSelection(new Set()); void saveSettings({ place: next }).catch(() => undefined) }, [saveSettings])

  useEffect(() => {
    setPeek(null)
  }, [session.viewMode])
  const setGroupBy = useCallback((next: GroupBy) => { setGroupByState(next); void saveSettings({ groupBy: next }).catch(() => undefined) }, [saveSettings])
  const toggleRail = useCallback(() => { const next = !railOpen; setRailOpen(next); void saveSettings({ railOpen: next }).catch(() => undefined) }, [railOpen, saveSettings])
  const toggleDetails = useCallback(() => { const next = !detailsOpen; setDetailsOpen(next); void saveSettings({ cardDetailsOpen: next }).catch(() => undefined) }, [detailsOpen, saveSettings])
  const setSwimlanes = useCallback((next: Swimlanes) => { setSwimlanesState(next); void saveSettings({ swimlanes: next }).catch(() => undefined) }, [saveSettings])
  useEffect(() => {
    const timer = setInterval(() => setDayKey(todayKey()), 30_000)
    return () => clearInterval(timer)
  }, [])
  const chosenToday = useMemo(() => new Set(myDay[dayKey] ?? []), [myDay, dayKey])
  const chooseForDay = useCallback((ref: string, on: boolean) => {
    // Serialize settings writes so rapid choices compose; failed writes leave the visible list intact.
    choiceWrites.current = choiceWrites.current.then(async () => {
      const key = todayKey()
      const today = new Set(dayChoices.current[key] ?? [])
      if (on) today.add(ref); else today.delete(ref)
      const next = { [key]: Array.from(today) }
      await saveSettings({ myDay: next })
      dayChoices.current = next
      setDayKey(key)
      setMyDayState(next)
    }).catch(error => onToast(`Could not save Today: ${error instanceof Error ? error.message : String(error)}`))
  }, [onToast, saveSettings])

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

  function newTask(): void { setCapturing(true) }

  const cross = useMemo(() => crossBoardTasks(boards, board.path).filter(entry => !entry.done), [boards, board.path])
  const counts = useMemo(() => ({
    myDay: cross.filter(entry => dueBucket(entry.task) === 'overdue' || dueBucket(entry.task) === 'today' || chosenToday.has(taskRef(entry))).length,
    upcoming: cross.filter(entry => { const bucket = dueBucket(entry.task); return bucket === 'tomorrow' || bucket === 'week' || bucket === 'later' }).length,
    review: cross.filter(entry => isReviewStatus(entry.store, entry.task.status)).length,
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
      <TasksTopBar session={session} place={place} railOpen={railOpen} onToggleRail={toggleRail} boardName={board.title} onOpenSwitcher={board.openSwitcher} onNewTask={() => void newTask()} searchRef={searchRef} />
      {capturing ? <QuickCapture key={session.activeProject.id} session={session} boardName={board.title} onClose={() => setCapturing(false)} onCreated={id => { setCapturing(false); openTask(id) }} /> : null}
      <Body onMouseDown={() => { if (peek) setPeek(null) }}>
        {railOpen ? <TasksRail place={place} boards={boards} openPath={board.path} counts={counts} onPlace={setPlace} onOpenBoard={path => { setPlace('board'); if (path !== board.path) onOpenBoard(path) }} /> : null}
        <Main {...(place === 'board' ? boardAgentRefs({ path: board.path, projectId: session.activeProject.id, name: board.title, open: true }) : {})}>
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
          {place !== 'board' && place !== 'boards' && (boardsLoading || boardsError || boards.some(entry => entry.error)) ? <div role={boardsError || boards.some(entry => entry.error) ? 'alert' : 'status'} style={{ padding: '8px 0', fontSize: 12 }}>
            {boardsLoading ? 'Refreshing boards…' : boardsError ?? 'Some boards could not be read. This view may be incomplete.'}
            {onRetryBoards && !boardsLoading ? <button type="button" onClick={() => void onRetryBoards()}>Retry</button> : null}
          </div> : null}
          {place === 'review' ? <ReviewView boards={boards} openPath={board.path} onOpen={openCross} /> : null}
          {place === 'myDay' ? <MyDayView session={session} boards={boards} openPath={board.path} chosen={chosenToday} onChoose={chooseForDay} onOpen={openCross} onToast={onToast} /> : null}
          {place === 'upcoming' ? <UpcomingView boards={boards} openPath={board.path} onOpen={openCross} /> : null}
          {place === 'boards' ? <BoardsHome boards={boards} openPath={board.path} loading={boardsLoading} error={boardsError} onRetry={onRetryBoards} onOpenBoard={path => { setPlace('board'); onOpenBoard(path) }} onNewBoard={template => { setPlace('board'); onNewBoard(template) }} /> : null}
        </Main>
      </Body>
      {peekTask && peek && !openTaskId ? <TaskPeek session={session} task={peekTask} anchor={peek.rect} onClose={() => setPeek(null)} onOpen={() => openTask(peekTask.id)} onToast={onToast} /> : null}
      {openTask_ ? <TaskCardOverlay session={session} task={openTask_} detailsOpen={detailsOpen} onToggleDetails={toggleDetails} onClose={closeTask} onOpenTask={openTask} onToast={onToast} inMyDay={openRef ? chosenToday.has(openRef) : false} onToggleMyDay={() => { if (!openRef) { onToast('Save the board first.'); return } const on = !chosenToday.has(openRef); chooseForDay(openRef, on) }} /> : null}
      {toast ? <Toast role="status">{toast}</Toast> : null}
    </GlassShell>
  )
}
