import { Fragment, useRef, useState } from 'react'
import { Check, MoreHorizontal, Plus } from 'lucide-react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { checklistProgress, columnAtLimit, columnLoad, TASK_STATUSES } from '../../lib/taskModel'
import type { SuiteTask, TaskColumn, TaskStatus } from '../../types'
import { CardChips } from './cardBits'
import type { Swimlanes } from './FilterBar'
import { AddRow, BoardGrid, Card, CardList, CardMeta, ColumnHead, ColumnTitleField, DropSlot, GlassColumn, IconBtn, Lane, LaneHead, MenuHead, MenuItem, MenuRule, Pick, Popover, Progress, QuickAdd, Wip } from './glassStyles'

export interface BoardCallbacks {
  onOpenTask: (taskId: string) => void
  onPeek: (taskId: string, rect: DOMRect) => void
  /** A real card drag has begun (after the browser's movement threshold). */
  onDragBegin: () => void
  selection: ReadonlySet<string>
  onToggleSelect: (taskId: string, all?: string[]) => void
  onToast: (text: string) => void
  swimlanes: Swimlanes
}

/** One card on the board: title, the chips, a checklist bar when there is one, the pick box in select mode. */
export function GlassCard({ task, session, selected, picked, picking, dragging, drop, onOpen, onPeek, onPick, onDragStart, onDragEnd, onDragOver, onDrop }: {
  task: SuiteTask; session: TasksSessionState; selected: boolean; picked: boolean; picking: boolean; dragging: boolean; drop?: 'before' | 'after' | null
  onOpen: () => void; onPeek: (rect: DOMRect) => void; onPick: (shift: boolean) => void
  onDragStart: (event: React.DragEvent<HTMLElement>) => void; onDragEnd: () => void
  onDragOver: (event: React.DragEvent<HTMLElement>) => void; onDrop: (event: React.DragEvent<HTMLElement>) => void
}): React.ReactElement {
  const done = session.isDoneStatus(task.status)
  const progress = checklistProgress(task)
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLElement>(null)
  const live = task.missions.some(mission => !mission.phase || ['planning', 'planned', 'running'].includes(mission.phase))
  return (
    <Card
      ref={ref}
      tabIndex={0}
      draggable
      aria-selected={selected}
      $selected={selected}
      $picked={picked}
      $dragging={dragging}
      $done={done}
      $drop={drop ?? null}
      onClick={event => { if (event.shiftKey || picking) { onPick(event.shiftKey); return } onOpen() }}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); onOpen() }
        if (event.key === ' ') { event.preventDefault(); if (ref.current) onPeek(ref.current.getBoundingClientRect()) }
        if (event.key.toLowerCase() === 'x') { event.preventDefault(); onPick(false) }
      }}
      onMouseEnter={() => { hover.current = setTimeout(() => { if (ref.current) onPeek(ref.current.getBoundingClientRect()) }, 650) }}
      onMouseLeave={() => { if (hover.current) { clearTimeout(hover.current); hover.current = null } }}
      onDragStart={event => { if (hover.current) clearTimeout(hover.current); onDragStart(event) }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {picking || picked ? <Pick onClick={event => event.stopPropagation()}><input type="checkbox" aria-label={`Select “${task.title}”`} checked={picked} onChange={() => onPick(false)} /></Pick> : null}
      <h4 style={picking || picked ? { paddingRight: 24 } : undefined}>{task.title}</h4>
      <CardMeta><CardChips task={task} store={session.store} done={done} /></CardMeta>
      {progress.total ? <CardMeta style={{ gap: 8 }}><span style={{ fontSize: 11 }}>{progress.done} / {progress.total}</span><Progress $value={(progress.done / progress.total) * 100} /></CardMeta> : null}
      {live ? <Progress $value={70} $tone="ai" aria-label="Mission running" /> : null}
    </Card>
  )
}

/** The board: frosted columns with WIP limits, drag and drop that respects them, quick add, and optional swimlanes. */
export function GlassBoardView({ session, callbacks }: { session: TasksSessionState; callbacks: BoardCallbacks }): React.ReactElement {
  const { onOpenTask, onPeek, onDragBegin, selection, onToggleSelect, onToast, swimlanes } = callbacks
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ status: string; before: string | null; lane?: string } | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ status: string; label: string } | null>(null)
  const [menu, setMenu] = useState<{ status: string; rect: DOMRect } | null>(null)
  const [wipDraft, setWipDraft] = useState<string>('')
  const picking = selection.size > 0

  const lanes: Array<{ id: string; label: string; match: (task: SuiteTask) => boolean; assign: Partial<Parameters<TasksSessionState['updateTask']>[1]> }> = (() => {
    if (swimlanes === 'owner') {
      const owners = Array.from(new Set(session.visibleTasks.map(task => task.ownerName?.trim() || ''))).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      return owners.map(name => ({ id: name || '__none', label: name || 'Nobody yet', match: task => (task.ownerName?.trim() || '') === name, assign: { ownerName: name } }))
    }
    if (swimlanes === 'label') {
      const labels = Array.from(new Set(session.visibleTasks.flatMap(task => (task.labels.length ? [task.labels[0]] : ['']))))
      return labels.map(label => ({ id: label || '__none', label: label || 'No label', match: task => (task.labels[0] ?? '') === label, assign: {} }))
    }
    if (swimlanes === 'priority') {
      return (['high', 'normal', 'low'] as const).map(priority => ({ id: priority, label: priority[0].toUpperCase() + priority.slice(1), match: task => task.priority === priority, assign: { priority } }))
    }
    return [{ id: '__all', label: '', match: () => true, assign: {} }]
  })()

  function beginDrag(event: React.DragEvent<HTMLElement>, task: SuiteTask): void {
    onDragBegin()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', task.id)
    setDragId(task.id)
  }
  function endDrag(): void { setDragId(null); setOver(null); setRefused(null) }
  /** Where a pointer over a card would drop: before it (upper half) or after it (lower half), as a `before` id. */
  function targetAt(event: React.DragEvent<HTMLElement>, tasks: SuiteTask[], task: SuiteTask): string | null {
    const rect = event.currentTarget.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    const index = tasks.findIndex(candidate => candidate.id === task.id)
    return after ? tasks[index + 1]?.id ?? null : task.id
  }
  async function drop(status: TaskStatus, before: string | null, lane?: typeof lanes[number]): Promise<void> {
    const id = dragId
    endDrag()
    if (!id) return
    const task = session.store.tasks.find(candidate => candidate.id === id)
    if (!task) return
    if (task.status !== status && columnAtLimit(session.store, status)) {
      setRefused(status); setTimeout(() => setRefused(null), 900)
      onToast(`${session.columns.find(column => column.id === status)?.label ?? status} is at its limit — finish a card there first.`)
      return
    }
    // "Before itself" means "stay where it is": resolve to the card after it, or the end.
    let anchor = before
    if (anchor === id) {
      const column = session.visibleTasks.filter(candidate => candidate.status === status)
      const index = column.findIndex(candidate => candidate.id === id)
      anchor = column[index + 1]?.id ?? null
    }
    if (anchor === null && task.status === status) {
      const column = session.visibleTasks.filter(candidate => candidate.status === status)
      if (column[column.length - 1]?.id === id) return // already last: nothing to do
    }
    await session.reorderTask(id, status, anchor ?? undefined)
    if (lane && swimlanes !== 'none' && !lane.match(task) && Object.keys(lane.assign).length) await session.updateTask(id, lane.assign)
    session.setSelectedTask(id)
  }
  function dragOverColumn(event: React.DragEvent<HTMLElement>, status: string, before: string | null, lane?: string): void {
    if (!dragId) return
    event.preventDefault(); event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    if (over?.status !== status || over.before !== before || over.lane !== lane) setOver({ status, before, lane })
  }
  async function quickAdd(status: TaskStatus): Promise<void> {
    const title = draft.trim()
    if (!title) return
    if (columnAtLimit(session.store, status)) { onToast(`${session.columns.find(column => column.id === status)?.label ?? status} is at its limit.`); return }
    await session.createTask(title, status)
    setDraft('')
  }
  function columnMenu(column: TaskColumn, item: string): void {
    if (item === 'rename') setEditing({ status: column.id, label: column.label })
    if (item === 'collapse') void session.patchColumn(column.id, { collapsed: !column.collapsed })
    if (item === 'done') void session.patchColumn(column.id, { done: !column.done })
    if (item === 'hide') void session.patchColumn(column.id, { hidden: true })
    if (item === 'left') { const index = session.columns.findIndex(candidate => candidate.id === column.id); const previous = session.columns[index - 1]; if (previous) void session.reorderColumn(column.id, previous.id) }
    if (item === 'right') { const index = session.columns.findIndex(candidate => candidate.id === column.id); void session.reorderColumn(column.id, session.columns[index + 2]?.id) }
    if (item === 'delete') { const target = session.columns.find(candidate => candidate.id !== column.id && !candidate.hidden)?.id; void session.deleteColumn(column.id, target) }
    if (item === 'selectAll') onToggleSelect('', session.visibleTasks.filter(task => task.status === column.id).map(task => task.id))
    if (item !== 'wip') setMenu(null)
  }

  const renderColumn = (column: TaskColumn, lane: typeof lanes[number], showHead: boolean): React.ReactElement => {
    const status = column.id
    const tasks = session.visibleTasks.filter(task => task.status === status && lane.match(task))
    const load = columnLoad(session.store, status)
    const full = Boolean(column.wipLimit) && load >= (column.wipLimit ?? 0)
    const isOver = over?.status === status && (over.lane ?? '__all') === lane.id
    return (
      <GlassColumn
        key={`${lane.id}:${status}`}
        aria-label={column.label}
        $over={isOver && dragId !== null}
        $refused={refused === status}
        $done={column.done}
        onDragOver={event => dragOverColumn(event, status, null, lane.id)}
        onDrop={event => { event.preventDefault(); void drop(status, null, lane) }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && over?.status === status) setOver(null) }}
      >
        {showHead ? (
          <ColumnHead>
            {editing?.status === status ? (
              <ColumnTitleField autoFocus aria-label="Column name" value={editing.label} onChange={event => setEditing({ status, label: event.target.value })} onBlur={() => { if (editing.label.trim()) void session.renameColumn(status, editing.label); setEditing(null) }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditing(null) }} />
            ) : (
              <span className="label" onDoubleClick={() => setEditing({ status, label: column.label })} title="Double-click to rename">{column.label}</span>
            )}
            <small>{load}</small>
            {column.wipLimit ? <Wip $full={full} title="Work-in-progress limit">{load} / {column.wipLimit}{full ? ' · at limit' : ''}</Wip> : column.done ? <Wip title="Done cards leave the board after the archive window">{session.activeProject.archiveDoneAfterDays === 0 ? 'kept' : `archives ${session.activeProject.archiveDoneAfterDays ?? 14} d`}</Wip> : null}
            <IconBtn type="button" aria-label={`Add a task to ${column.label}`} title="Add a task" disabled={column.collapsed} onClick={() => { setAdding(status); setDraft('') }}><Plus size={14} strokeWidth={2} /></IconBtn>
            <IconBtn type="button" aria-label={`${column.label} column menu`} onClick={event => { setWipDraft(String(column.wipLimit ?? '')); setMenu(menu?.status === status ? null : { status, rect: event.currentTarget.getBoundingClientRect() }) }}><MoreHorizontal size={14} strokeWidth={2} /></IconBtn>
          </ColumnHead>
        ) : null}
        {column.collapsed ? (
          <AddRow type="button" onClick={() => void session.patchColumn(status, { collapsed: false })}>Expand · {load}</AddRow>
        ) : (
          <>
            <CardList>
              {tasks.map((task, index) => {
                // The line shows where the card will land: before this card, or after the last one.
                const line = dragId && dragId !== task.id && isOver
                  ? over?.before === task.id ? 'before' : over?.before === null && index === tasks.length - 1 ? 'after' : null
                  : null
                return (
                  <Fragment key={task.id}>
                    <GlassCard
                      task={task}
                      session={session}
                      selected={task.id === session.selectedTask?.id}
                      picked={selection.has(task.id)}
                      picking={picking}
                      dragging={task.id === dragId}
                      drop={line}
                      onOpen={() => onOpenTask(task.id)}
                      onPeek={rect => onPeek(task.id, rect)}
                      onPick={() => onToggleSelect(task.id)}
                      onDragStart={event => beginDrag(event, task)}
                      onDragEnd={endDrag}
                      onDragOver={event => {
                        if (!dragId) return
                        if (dragId === task.id) { event.preventDefault(); event.stopPropagation(); return }
                        dragOverColumn(event, status, targetAt(event, tasks, task), lane.id)
                      }}
                      onDrop={event => {
                        event.preventDefault(); event.stopPropagation()
                        // Decide from the pointer at drop time, not from state that may lag a frame.
                        void drop(status, dragId === task.id ? task.id : targetAt(event, tasks, task), lane)
                      }}
                    />
                  </Fragment>
                )
              })}
              <DropSlot aria-hidden="true" $active={dragId !== null && isOver && over?.before === null && tasks.length > 0} onDragOver={event => dragOverColumn(event, status, null, lane.id)} onDrop={event => { event.preventDefault(); event.stopPropagation(); void drop(status, null, lane) }} />
            </CardList>
            {adding === status && lane.id === lanes[0].id ? (
              <QuickAdd onSubmit={event => { event.preventDefault(); void quickAdd(status) }}>
                <input autoFocus aria-label={`New task in ${column.label}`} placeholder="Task title · Enter to add" value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => { if (!draft.trim()) setAdding(null) }} onKeyDown={event => { if (event.key === 'Escape') { setAdding(null); setDraft('') } }} />
              </QuickAdd>
            ) : full ? (
              <AddRow type="button" disabled>At the limit — finish one first</AddRow>
            ) : lane.id === lanes[0].id ? (
              <AddRow type="button" onClick={() => { setAdding(status); setDraft('') }}><Plus size={13} strokeWidth={2} /> Add a task</AddRow>
            ) : null}
          </>
        )}
      </GlassColumn>
    )
  }

  const columns = session.visibleColumns
  const menuColumn = menu ? session.columns.find(column => column.id === menu.status) : null
  return (
    <>
      <BoardGrid onMouseDown={() => { if (menu) setMenu(null) }}>
        {swimlanes === 'none' ? (
          <>
            {columns.map(column => renderColumn(column, lanes[0], true))}
            {session.hiddenColumns.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, width: 160, padding: '10px 0' }}>
                <MenuHead>Hidden</MenuHead>
                {session.hiddenColumns.map(column => <AddRow key={column.id} type="button" onClick={() => void session.patchColumn(column.id, { hidden: false })}>Show {column.label}</AddRow>)}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12 }}>{columns.map(column => <div key={column.id} style={{ width: 250, flexShrink: 0 }}><ColumnHead><span className="label">{column.label}</span><small>{columnLoad(session.store, column.id)}</small>{column.wipLimit ? <Wip $full={columnAtLimit(session.store, column.id)}>{columnLoad(session.store, column.id)} / {column.wipLimit}</Wip> : null}</ColumnHead></div>)}</div>
            {lanes.map(lane => (
              <Lane key={lane.id}>
                <LaneHead>{lane.label}<small style={{ fontFamily: 'var(--tasks-mono)', fontWeight: 400 }}>{session.visibleTasks.filter(lane.match).length}</small></LaneHead>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>{columns.map(column => renderColumn(column, lane, false))}</div>
              </Lane>
            ))}
          </div>
        )}
      </BoardGrid>
      {menu && menuColumn ? (
        <Popover role="menu" aria-label={`${menuColumn.label} column`} style={{ left: Math.min(menu.rect.left, window.innerWidth - 240), top: menu.rect.bottom + 6, width: 230 }} onMouseDown={event => event.stopPropagation()}>
          <MenuHead>{menuColumn.label}</MenuHead>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'rename')}>Rename</MenuItem>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'selectAll')}>Select all cards here<kbd>A</kbd></MenuItem>
          <MenuRule />
          <form style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }} onSubmit={event => { event.preventDefault(); void session.patchColumn(menuColumn.id, { wipLimit: Number(wipDraft) || 0 }); setMenu(null) }}>
            <span style={{ fontSize: 13 }}>WIP limit</span>
            <input aria-label="WIP limit" inputMode="numeric" placeholder="none" value={wipDraft} onChange={event => setWipDraft(event.target.value.replace(/\D/g, ''))} style={{ width: 56, height: 26, padding: '0 8px', borderRadius: 7, border: '1px solid var(--tasks-line)', background: 'var(--tasks-card)', font: 'inherit', fontSize: 12.5, color: 'inherit' }} />
            <button type="submit" style={{ height: 26, padding: '0 10px', borderRadius: 7, border: 0, background: 'var(--tasks-acc)', color: 'var(--pure-chrome-on-accent)', font: 'inherit', fontSize: 12, cursor: 'pointer' }}><Check size={12} strokeWidth={2.5} /></button>
          </form>
          <MenuRule />
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'left')} disabled={session.columns[0]?.id === menuColumn.id}>Move left</MenuItem>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'right')} disabled={session.columns[session.columns.length - 1]?.id === menuColumn.id}>Move right</MenuItem>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'collapse')}>{menuColumn.collapsed ? 'Expand' : 'Collapse'}</MenuItem>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'done')}>{menuColumn.done ? 'Not a done column' : 'Counts as done'}</MenuItem>
          <MenuItem type="button" onClick={() => columnMenu(menuColumn, 'hide')}>Hide column</MenuItem>
          {!(TASK_STATUSES as readonly string[]).includes(menuColumn.id) && session.columns.length > 1 ? <MenuItem type="button" $tone="danger" onClick={() => columnMenu(menuColumn, 'delete')}>Delete column…</MenuItem> : null}
        </Popover>
      ) : null}
    </>
  )
}
