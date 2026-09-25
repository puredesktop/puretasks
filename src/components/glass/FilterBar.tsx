import { useEffect, useRef, useState } from 'react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { MISSION_KINDS, type MissionKind } from '../../lib/missions'
import { columnAtLimit, DEFAULT_FILTERS } from '../../lib/taskModel'
import type { TaskPriority, TasksAppSettings } from '../../types'
import { Divider, FilterRow, Kicker, MenuHead, MenuItem, Meta, Pill, Popover, SelectionBar } from './glassStyles'

export type GroupBy = NonNullable<TasksAppSettings['groupBy']>
export type Swimlanes = NonNullable<TasksAppSettings['swimlanes']>

type Open = 'label' | 'due' | 'priority' | 'group' | 'lanes' | 'selMove' | 'selOwner' | 'selLabel' | 'selDue' | 'selPriority' | 'selMission' | null

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
  const rowRef = useRef<HTMLDivElement>(null)
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
  const owners = Array.from(new Set(session.store.tasks.map(task => task.ownerName?.trim()).filter((name): name is string => Boolean(name)))).sort()

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
    <Popover data-popover role="menu" style={{ left: Math.min(anchor.left, window.innerWidth - width - 8), top: anchor.bottom + 6, width }}>{children}</Popover>
  ) : null

  if (ids.length) {
    return (
      <FilterRow ref={rowRef}>
        <SelectionBar role="toolbar" aria-label="Selected cards">
          <strong>{ids.length} selected</strong>
          <Pill type="button" onClick={toggle('selMove')}>Move to ▾</Pill>
          <Pill type="button" onClick={toggle('selOwner')}>Owner ▾</Pill>
          <Pill type="button" onClick={toggle('selLabel')}>Label ▾</Pill>
          <Pill type="button" onClick={toggle('selDue')}>Due ▾</Pill>
          <Pill type="button" onClick={toggle('selPriority')}>Priority ▾</Pill>
          <Divider />
          {session.missionsEnabled ? <Pill type="button" onClick={toggle('selMission')}>Create mission ▾</Pill> : null}
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

  const active = filters.status !== 'all' || filters.label || filters.query || dueFilter || priorityFilter
  return (
    <FilterRow ref={rowRef}>
      <Kicker>Filters</Kicker>
      <Pill type="button" $on={filters.status !== 'all'} onClick={toggle('label')} style={{ display: 'none' }}>x</Pill>
      <Pill type="button" $on={Boolean(filters.label)} onClick={toggle('label')}>{filters.label ? `Label: ${filters.label} ×` : 'Label ▾'}</Pill>
      <Pill type="button" $on={Boolean(dueFilter)} onClick={toggle('due')}>{dueFilter ? `Due: ${dueFilter} ×` : 'Due ▾'}</Pill>
      <Pill type="button" $on={Boolean(priorityFilter)} onClick={toggle('priority')}>{priorityFilter ? `Priority: ${priorityFilter} ×` : 'Priority ▾'}</Pill>
      {active ? <Pill type="button" $quiet onClick={() => session.setFilters(DEFAULT_FILTERS)}>Clear</Pill> : null}
      <Divider />
      {session.viewMode === 'board' ? <Pill type="button" $on={swimlanes !== 'none'} onClick={toggle('lanes')}>Swimlanes: {swimlanes} ▾</Pill> : null}
      {session.viewMode === 'list' ? <Pill type="button" $on={groupBy !== 'none'} onClick={toggle('group')}>Group: {groupBy} ▾</Pill> : null}
      <span style={{ flex: 1 }} />
      <Meta>{summary}</Meta>
      {open === 'label' ? pop(<><MenuHead>Label</MenuHead>{session.labels.map(label => <MenuItem key={label} type="button" $on={filters.label === label} onClick={() => { session.setFilters({ ...filters, label: filters.label === label ? '' : label }); setOpen(null) }}>{label}</MenuItem>)}{!session.labels.length ? <Meta style={{ padding: '6px 10px' }}>No labels yet.</Meta> : null}</>) : null}
      {open === 'due' ? pop(<><MenuHead>Due</MenuHead>{[['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['none', 'No date']].map(([value, label]) => <MenuItem key={value} type="button" $on={dueFilter === value} onClick={() => { session.setFilters({ ...filters, due: dueFilter === value ? '' : value } as typeof filters); setOpen(null) }}>{label}</MenuItem>)}</>) : null}
      {open === 'priority' ? pop(<><MenuHead>Priority</MenuHead>{(['high', 'normal', 'low'] as TaskPriority[]).map(priority => <MenuItem key={priority} type="button" $on={priorityFilter === priority} onClick={() => { session.setFilters({ ...filters, priority: priorityFilter === priority ? '' : priority } as typeof filters); setOpen(null) }}>{priority[0].toUpperCase() + priority.slice(1)}</MenuItem>)}</>) : null}
      {open === 'lanes' ? pop(<><MenuHead>Swimlanes</MenuHead>{(['none', 'owner', 'label', 'priority'] as Swimlanes[]).map(value => <MenuItem key={value} type="button" $on={swimlanes === value} onClick={() => { onSwimlanes(value); setOpen(null) }}>{value === 'none' ? 'None' : `By ${value}`}</MenuItem>)}</>) : null}
      {open === 'group' ? pop(<><MenuHead>Group by</MenuHead>{(['none', 'owner', 'label', 'priority', 'due'] as GroupBy[]).map(value => <MenuItem key={value} type="button" $on={groupBy === value} onClick={() => { onGroupBy(value); setOpen(null) }}>{value === 'none' ? 'None' : `By ${value}`}</MenuItem>)}</>) : null}
    </FilterRow>
  )
}
