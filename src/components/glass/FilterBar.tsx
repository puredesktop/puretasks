import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { MISSION_KINDS, type MissionKind } from '../../lib/missions'
import { columnAtLimit, DEFAULT_FILTERS, UNASSIGNED_OWNER_FILTER } from '../../lib/taskModel'
import type { TaskFilterDefinition, TaskFilterView, TaskPriority, TasksAppSettings } from '../../types'
import { Divider, FilterRow, Kicker, MenuHead, MenuItem, Meta, Pill, Popover, SelectionBar } from './glassStyles'

/** A drawn chevron, not a typed ▾: it sits on the text's centre line. */
const Caret = (): React.ReactElement => <ChevronDown size={12} strokeWidth={2} aria-hidden="true" style={{ opacity: 0.7, marginLeft: -2 }} />

export type GroupBy = NonNullable<TasksAppSettings['groupBy']>
export type Swimlanes = NonNullable<TasksAppSettings['swimlanes']>

type Open = 'owner' | 'status' | 'label' | 'due' | 'priority' | 'group' | 'lanes' | 'views' | 'saveView' | 'selMove' | 'selOwner' | 'selLabel' | 'selDue' | 'selPriority' | 'selMission' | null

/** The filter row: chips for the board's filters, group-by, swimlanes, and the selection bar when cards are picked. */
export function FilterBar({
  session,
  groupBy,
  swimlanes,
  onGroupBy,
  onSwimlanes,
  selection,
  onClearSelection,
  onToast,
  summary,
}: {
  session: TasksSessionState
  groupBy: GroupBy
  swimlanes: Swimlanes
  onGroupBy: (value: GroupBy) => void
  onSwimlanes: (value: Swimlanes) => void
  selection: ReadonlySet<string>
  onClearSelection: () => void
  onToast: (text: string) => void
  summary: string
}): React.ReactElement {
  const [open, setOpen] = useState<Open>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [viewName, setViewName] = useState('')
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setOpen(null)
    setViewName('')
  }, [session.activeProject.id])
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent): void => { if (!(event.target as HTMLElement).closest('[data-popover]')) setOpen(null) }
    const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(null) }
    window.addEventListener('mousedown', close); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key) }
  }, [open])
  const toggle = (id: Open) => (event: React.MouseEvent<HTMLButtonElement>) => { setAnchor(event.currentTarget.getBoundingClientRect()); setOpen(current => (current === id ? null : id)) }
  const filters = session.filters
  const dueFilter = (filters as { due?: string }).due ?? ''
  const priorityFilter = (filters as { priority?: string }).priority ?? ''
  const ids = Array.from(selection)
  const boardTasks = session.store.tasks.filter(task => task.projectId === session.activeProject.id && !task.archivedAt)
  const owners = Array.from(new Set(boardTasks.map(task => task.ownerName?.trim()).filter((name): name is string => Boolean(name)))).sort()
  const hasUnassigned = boardTasks.some(task => !task.ownerName?.trim())
  const definition: TaskFilterDefinition = { owner: filters.owner ?? '', status: filters.status, label: filters.label }

  async function moveSelected(status: string): Promise<void> {
    const refused = ids.filter(id => session.store.tasks.find(task => task.id === id)?.status !== status && columnAtLimit(session.store, status))
    if (refused.length && refused.length === ids.length) { onToast(`${session.columns.find(column => column.id === status)?.label ?? status} is at its limit.`); setOpen(null); return }
    await session.moveTasks(ids, status)
    onToast(`Moved ${ids.length} to ${session.columns.find(column => column.id === status)?.label ?? status}`)
    setOpen(null); onClearSelection()
  }
  async function patchSelected(patch: Parameters<TasksSessionState['updateTask']>[1], note: string): Promise<void> {
    for (const id of ids) await session.updateTask(id, patch)
    onToast(`${note} · ${ids.length} card${ids.length === 1 ? '' : 's'}`)
    setOpen(null); onClearSelection()
  }
  async function missionSelected(kind: MissionKind): Promise<void> {
    let made = 0
    for (const id of ids) { try { await session.createMissionForTask(id, kind); made += 1 } catch { /* reported below */ } }
    onToast(`${made} mission${made === 1 ? '' : 's'} created`)
    setOpen(null); onClearSelection()
  }
  const day = (offset: number): string => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10) }
  const pop = (children: React.ReactNode, width = 200): React.ReactElement | null => open && anchor ? (
    <Popover data-popover role="menu" style={{ left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)), top: anchor.bottom + 6, width: Math.min(width, window.innerWidth - 16) }}>{children}</Popover>
  ) : null

  const applyView = (view: TaskFilterView): void => {
    session.setFilters({ ...DEFAULT_FILTERS, ...view.filters })
    setOpen(null)
    onToast(`Opened view ${view.name}`)
  }

  const saveView = async (): Promise<void> => {
    const name = viewName.trim()
    if (!name) return
    const existing = session.filterViews.some(view => view.name.toLocaleLowerCase() === name.slice(0, 80).toLocaleLowerCase())
    try {
      await session.saveFilterView(name, definition)
      setViewName('')
      setOpen(null)
      onToast(`${existing ? 'View updated' : 'View added'}: ${name.slice(0, 80)}`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : String(error))
    }
  }

  const changeView = async (operation: () => Promise<void>, message: string): Promise<void> => {
    try {
      await operation()
      setOpen(null)
      onToast(message)
    } catch (error) {
      onToast(error instanceof Error ? error.message : String(error))
    }
  }

  const viewPreview = (view: TaskFilterView): string => {
    const parts = [
      view.filters.owner === UNASSIGNED_OWNER_FILTER ? 'Nobody' : view.filters.owner,
      view.filters.status !== 'all' ? session.columns.find(column => column.id === view.filters.status)?.label ?? view.filters.status : '',
      view.filters.label,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : 'All tasks'
  }

  if (ids.length) {
    return (
      <FilterRow ref={rowRef}>
        <SelectionBar role="toolbar" aria-label="Selected cards">
          <strong>{ids.length} selected</strong>
          <Pill type="button" onClick={toggle('selMove')}>Move to <Caret /></Pill>
          <Pill type="button" onClick={toggle('selOwner')}>Owner <Caret /></Pill>
          <Pill type="button" onClick={toggle('selLabel')}>Label <Caret /></Pill>
          <Pill type="button" onClick={toggle('selDue')}>Due <Caret /></Pill>
          <Pill type="button" onClick={toggle('selPriority')}>Priority <Caret /></Pill>
          <Divider />
          {session.missionsEnabled ? <Pill type="button" onClick={toggle('selMission')}>Create mission <Caret /></Pill> : null}
          <Pill type="button" onClick={() => void patchSelected({ archivedAt: new Date().toISOString() }, 'Archived')}>Archive</Pill>
          <Pill type="button" $quiet aria-label="Clear selection" onClick={onClearSelection}>×</Pill>
        </SelectionBar>
        <Meta style={{ marginLeft: 'auto', fontFamily: 'var(--tasks-mono)', fontSize: 10.5 }}>⇧ click or X to select · A all in column · Esc clears</Meta>
        {open === 'selMove' ? pop(<><MenuHead>Move to</MenuHead>{session.columns.filter(column => !column.hidden).map(column => <MenuItem key={column.id} type="button" onClick={() => void moveSelected(column.id)}>{column.label}{columnAtLimit(session.store, column.id) ? <small>at limit</small> : null}</MenuItem>)}</>) : null}
        {open === 'selOwner' ? pop(<><MenuHead>Owner</MenuHead>{owners.map(name => <MenuItem key={name} type="button" onClick={() => void patchSelected({ ownerName: name }, `Owner ${name}`)}>{name}</MenuItem>)}<MenuItem type="button" onClick={() => void patchSelected({ ownerName: '' }, 'Owner cleared')}>Nobody</MenuItem></>) : null}
        {open === 'selLabel' ? pop(<><MenuHead>Add label</MenuHead>{session.labels.map(label => <MenuItem key={label} type="button" onClick={async () => { for (const id of ids) { const task = session.store.tasks.find(candidate => candidate.id === id); if (task && !task.labels.includes(label)) await session.updateTask(id, { labels: [...task.labels, label] }) } onToast(`Label ${label} added`); setOpen(null); onClearSelection() }}>{label}</MenuItem>)}{!session.labels.length ? <Meta style={{ padding: '6px 10px' }}>No labels on this board yet.</Meta> : null}</>) : null}
        {open === 'selDue' ? pop(<><MenuHead>Due</MenuHead>{[['Today', day(0)], ['Tomorrow', day(1)], ['Next week', day(7)], ['No due date', '']].map(([label, value]) => <MenuItem key={label} type="button" onClick={() => void patchSelected({ dueAt: value }, `Due ${label.toLowerCase()}`)}>{label}</MenuItem>)}</>) : null}
        {open === 'selPriority' ? pop(<><MenuHead>Priority</MenuHead>{(['high', 'normal', 'low'] as TaskPriority[]).map(priority => <MenuItem key={priority} type="button" onClick={() => void patchSelected({ priority }, `Priority ${priority}`)}>{priority[0].toUpperCase() + priority.slice(1)}</MenuItem>)}</>) : null}
        {open === 'selMission' ? pop(<><MenuHead>Create a mission per card</MenuHead>{MISSION_KINDS.map(kind => <MenuItem key={kind.id} type="button" title={kind.detail} onClick={() => void missionSelected(kind.id)}>{kind.label}</MenuItem>)}</>, 240) : null}
      </FilterRow>
    )
  }

  const active = filters.status !== 'all' || filters.label || filters.owner || filters.query || dueFilter || priorityFilter
  return (
    <FilterRow ref={rowRef}>
      <Kicker>Filters</Kicker>
      <Pill type="button" $on={Boolean(filters.owner)} onClick={toggle('owner')}>{filters.owner ? `Owner: ${filters.owner === UNASSIGNED_OWNER_FILTER ? 'Nobody' : filters.owner} ×` : <>Owner <Caret /></>}</Pill>
      <Pill type="button" $on={filters.status !== 'all'} onClick={toggle('status')}>{filters.status !== 'all' ? `Status: ${session.columns.find(column => column.id === filters.status)?.label ?? filters.status} ×` : <>Status <Caret /></>}</Pill>
      <Pill type="button" $on={Boolean(filters.label)} onClick={toggle('label')}>{filters.label ? `Label: ${filters.label} ×` : <>Label <Caret /></>}</Pill>
      <Pill type="button" $on={Boolean(dueFilter)} onClick={toggle('due')}>{dueFilter ? `Due: ${dueFilter} ×` : <>Due <Caret /></>}</Pill>
      <Pill type="button" $on={Boolean(priorityFilter)} onClick={toggle('priority')}>{priorityFilter ? `Priority: ${priorityFilter} ×` : <>Priority <Caret /></>}</Pill>
      {active ? <Pill type="button" $quiet onClick={() => session.setFilters(DEFAULT_FILTERS)}>Clear</Pill> : null}
      <Divider />
      {session.viewMode === 'board' ? <Pill type="button" $on={swimlanes !== 'none'} onClick={toggle('lanes')}>Swimlanes: {swimlanes} <Caret /></Pill> : null}
      {session.viewMode === 'list' ? <Pill type="button" $on={groupBy !== 'none'} onClick={toggle('group')}>Group: {groupBy} <Caret /></Pill> : null}
      <Pill type="button" onClick={toggle('views')}>Views{session.filterViews.length ? ` (${session.filterViews.length})` : ''} <Caret /></Pill>
      <Pill type="button" $accent={open === 'saveView'} onClick={toggle('saveView')}>Save view</Pill>
      <span style={{ flex: 1 }} />
      <Meta>{summary}</Meta>
      {open === 'owner' ? pop(<><MenuHead>Owner</MenuHead><MenuItem type="button" $on={!filters.owner} onClick={() => { session.setFilters({ ...filters, owner: '' }); setOpen(null) }}>Any owner</MenuItem>{owners.map(name => <MenuItem key={name} type="button" $on={filters.owner === name} onClick={() => { session.setFilters({ ...filters, owner: filters.owner === name ? '' : name }); setOpen(null) }}>{name}</MenuItem>)}{hasUnassigned ? <MenuItem type="button" $on={filters.owner === UNASSIGNED_OWNER_FILTER} onClick={() => { session.setFilters({ ...filters, owner: filters.owner === UNASSIGNED_OWNER_FILTER ? '' : UNASSIGNED_OWNER_FILTER }); setOpen(null) }}>Nobody</MenuItem> : null}{!owners.length && !hasUnassigned ? <Meta style={{ padding: '6px 10px' }}>No owner values yet.</Meta> : null}</>) : null}
      {open === 'status' ? pop(<><MenuHead>Status</MenuHead><MenuItem type="button" $on={filters.status === 'all'} onClick={() => { session.setFilters({ ...filters, status: 'all' }); setOpen(null) }}>Any status</MenuItem>{session.columns.map(column => <MenuItem key={column.id} type="button" $on={filters.status === column.id} onClick={() => { session.setFilters({ ...filters, status: filters.status === column.id ? 'all' : column.id }); setOpen(null) }}>{column.label}</MenuItem>)}</>) : null}
      {open === 'label' ? pop(<><MenuHead>Label</MenuHead>{session.labels.map(label => <MenuItem key={label} type="button" $on={filters.label === label} onClick={() => { session.setFilters({ ...filters, label: filters.label === label ? '' : label }); setOpen(null) }}>{label}</MenuItem>)}{!session.labels.length ? <Meta style={{ padding: '6px 10px' }}>No labels yet.</Meta> : null}</>) : null}
      {open === 'due' ? pop(<><MenuHead>Due</MenuHead>{[['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['none', 'No date']].map(([value, label]) => <MenuItem key={value} type="button" $on={dueFilter === value} onClick={() => { session.setFilters({ ...filters, due: dueFilter === value ? '' : value } as typeof filters); setOpen(null) }}>{label}</MenuItem>)}</>) : null}
      {open === 'priority' ? pop(<><MenuHead>Priority</MenuHead>{(['high', 'normal', 'low'] as TaskPriority[]).map(priority => <MenuItem key={priority} type="button" $on={priorityFilter === priority} onClick={() => { session.setFilters({ ...filters, priority: priorityFilter === priority ? '' : priority } as typeof filters); setOpen(null) }}>{priority[0].toUpperCase() + priority.slice(1)}</MenuItem>)}</>) : null}
      {open === 'lanes' ? pop(<><MenuHead>Swimlanes</MenuHead>{(['none', 'owner', 'label', 'priority'] as Swimlanes[]).map(value => <MenuItem key={value} type="button" $on={swimlanes === value} onClick={() => { onSwimlanes(value); setOpen(null) }}>{value === 'none' ? 'None' : `By ${value}`}</MenuItem>)}</>) : null}
      {open === 'group' ? pop(<><MenuHead>Group by</MenuHead>{(['none', 'owner', 'label', 'priority', 'due'] as GroupBy[]).map(value => <MenuItem key={value} type="button" $on={groupBy === value} onClick={() => { onGroupBy(value); setOpen(null) }}>{value === 'none' ? 'None' : `By ${value}`}</MenuItem>)}</>) : null}
      {open === 'views' ? pop(<><MenuHead>Saved views</MenuHead>{session.filterViews.length ? session.filterViews.map(view => <div key={view.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', alignItems: 'center', gap: 4, padding: '3px 4px' }}><button type="button" onClick={() => applyView(view)} title={`Open ${view.name}`} style={{ minWidth: 0, padding: '5px 6px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--tasks-ink)', textAlign: 'left', cursor: 'pointer', overflow: 'hidden' }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{view.name}</span><small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tasks-muted)' }}>{viewPreview(view)}</small></button><button type="button" onClick={() => void changeView(() => session.updateFilterView(view.id, view.name, definition), `Updated view ${view.name}`)} aria-label={`Update ${view.name}`} title="Update from current filters" style={{ padding: '5px 6px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--tasks-acc-ink)', cursor: 'pointer', fontSize: 11 }}>Update</button><button type="button" onClick={() => void changeView(() => session.deleteFilterView(view.id), `Removed view ${view.name}`)} aria-label={`Remove ${view.name}`} title="Remove view" style={{ padding: '5px 6px', border: 0, borderRadius: 7, background: 'transparent', color: 'var(--tasks-bad-ink)', cursor: 'pointer', fontSize: 11 }}>Remove</button></div>) : <Meta style={{ padding: '6px 10px' }}>No saved views yet.</Meta>}<Divider /><MenuItem type="button" onClick={() => { setViewName(''); setOpen('saveView') }}>Save current filters as a view</MenuItem></>, 300) : null}
      {open === 'saveView' ? pop(<><MenuHead>Save named view</MenuHead><label style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '4px 10px 8px', fontSize: 12, color: 'var(--tasks-muted)' }}><span>Name</span><input autoFocus aria-label="View name" value={viewName} maxLength={80} placeholder="e.g. Maya's review" onChange={event => setViewName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void saveView() } }} style={{ boxSizing: 'border-box', width: '100%', height: 30, padding: '0 8px', border: '1px solid var(--tasks-line)', borderRadius: 7, background: 'var(--tasks-card)', color: 'var(--tasks-ink)', font: 'inherit' }} /></label><Meta style={{ padding: '0 10px 8px' }}>Owner, status and label filters are saved.</Meta><MenuItem type="button" $tone="accent" disabled={!viewName.trim()} onClick={() => void saveView()}>Save view</MenuItem></>, 280) : null}
    </FilterRow>
  )
}
