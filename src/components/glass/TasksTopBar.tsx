import { Search } from 'lucide-react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import type { TaskViewMode, TasksPlace } from '../../types'
import { Pill, SearchBox, TopBar, ViewTab, ViewTabs, Wordmark } from './glassStyles'

const VIEWS: Array<{ id: TaskViewMode; label: string }> = [
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'activity', label: 'Activity' },
]

export function TasksTopBar({
  session,
  place,
  boardName,
  onOpenSwitcher,
  onNewTask,
  searchRef,
}: {
  session: TasksSessionState
  place: TasksPlace
  boardName: string
  onOpenSwitcher: () => void
  onNewTask: () => void
  searchRef: React.RefObject<HTMLInputElement | null>
}): React.ReactElement {
  const onBoard = place === 'board'

  return (
    <TopBar>
      <Wordmark>pure<strong>tasks</strong></Wordmark>
      {onBoard ? (
        <>
          <Pill type="button" onClick={onOpenSwitcher} style={{ fontWeight: 600 }} title="Open another board">{boardName} <span style={{ color: 'var(--tasks-faint)' }}>▾</span></Pill>
          <ViewTabs role="tablist" aria-label="Views">
            {VIEWS.map(view => (
              <ViewTab key={view.id} role="tab" type="button" aria-selected={session.viewMode === view.id} $on={session.viewMode === view.id} onClick={() => session.setViewMode(view.id)}>{view.label}</ViewTab>
            ))}
          </ViewTabs>
        </>
      ) : (
        <span style={{ fontFamily: 'var(--tasks-mono)', fontSize: 11, color: 'var(--tasks-muted)' }}>across all boards</span>
      )}
      <span style={{ flex: 1 }} />
      {onBoard ? (
        <SearchBox>
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <input ref={searchRef} aria-label="Search this board" placeholder="Search this board   /" value={session.filters.query} onChange={event => session.setFilters({ ...session.filters, query: event.target.value })} onKeyDown={event => { if (event.key === 'Escape') { session.setFilters({ ...session.filters, query: '' }); event.currentTarget.blur() } }} />
        </SearchBox>
      ) : null}
      <Pill type="button" $accent onClick={onNewTask}>+ Task <kbd>N</kbd></Pill>
    </TopBar>
  )
}
