import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { MISSION_KINDS, type MissionKind } from '../../lib/missions'
import { checklistProgress, columnAtLimit } from '../../lib/taskModel'
import type { SuiteTask, TaskPriority } from '../../types'
import { CardChips } from './cardBits'
import { MenuHead, MenuItem, MenuRule, Pill, Popover, Progress } from './glassStyles'

export type PeekMenu = 'move' | 'owner' | 'due' | 'priority' | 'mission' | null

/**
 * Peek: everything you need about a card without opening it, and the single
 * key actions. Opens on hover (after a beat) or Space; one submenu at a time.
 */
export function TaskPeek({
  session,
  task,
  anchor,
  onClose,
  onOpen,
  onToast,
}: {
  session: TasksSessionState
  task: SuiteTask
  anchor: DOMRect
  onClose: () => void
  onOpen: () => void
  onToast: (text: string) => void
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<PeekMenu>(null)
  const [pos, setPos] = useState({ left: anchor.right + 10, top: anchor.top })
  const done = session.isDoneStatus(task.status)
  const progress = checklistProgress(task)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const width = el.offsetWidth, height = el.offsetHeight
    let left = anchor.right + 10
    if (left + width > window.innerWidth - 8) left = Math.max(8, anchor.left - width - 10)
    let top = anchor.top
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8)
    setPos({ left, top })
  }, [anchor, menu])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (event.key === 'Escape') { if (menu) setMenu(null); else onClose(); return }
      if (key === 'enter') { onOpen(); return }
      if (key === 'd') { void toggleDone(); return }
      if (key === 'v') { setMenu(current => (current === 'move' ? null : 'move')); return }
      if (key === 'o') { setMenu(current => (current === 'owner' ? null : 'owner')); return }
      if (key === 'u') { setMenu(current => (current === 'due' ? null : 'due')); return }
      if (key === 'p') { setMenu(current => (current === 'priority' ? null : 'priority')); return }
      if (key === 'm') { setMenu(current => (current === 'mission' ? null : 'mission')); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function toggleDone(): Promise<void> {
    const target = done
      ? session.columns.find(column => !column.done && !column.hidden)?.id ?? 'inbox'
      : session.columns.find(column => column.done)?.id ?? 'done'
    const ok = await session.moveTask(task.id, target)
    if (!ok) onToast(`${session.columns.find(column => column.id === target)?.label ?? target} is at its limit.`)
    onClose()
  }

  async function move(status: string): Promise<void> {
    const ok = await session.moveTask(task.id, status)
    if (!ok) onToast(`${session.columns.find(column => column.id === status)?.label ?? status} is at its limit — finish a card there first.`)
    onClose()
  }

  async function mission(kind: MissionKind): Promise<void> {
    try {
      const created = await session.createMissionForTask(task.id, kind)
      onToast(`Mission created: ${created.title}`)
    } catch (error) {
      onToast(error instanceof Error ? error.message : String(error))
    }
    onClose()
  }

  const owners = Array.from(new Set(session.store.tasks.map(candidate => candidate.ownerName?.trim()).filter((name): name is string => Boolean(name)))).sort()
  const dueOptions: Array<{ label: string; value: string | undefined }> = (() => {
    const day = (offset: number): string => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10) }
    return [
      { label: 'Today', value: day(0) }, { label: 'Tomorrow', value: day(1) }, { label: 'In 3 days', value: day(3) }, { label: 'Next week', value: day(7) }, { label: 'No due date', value: undefined },
    ]
  })()

  return (
    <Popover ref={ref} role="dialog" aria-label={`Peek: ${task.title}`} style={{ left: pos.left, top: pos.top, width: 360, gap: 10, padding: '14px 14px 8px' }} onMouseDown={event => event.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--tasks-mono)', fontSize: 10.5, color: 'var(--tasks-muted)' }}>{session.columns.find(column => column.id === task.status)?.label ?? task.status}</div>
          <strong style={{ display: 'block', fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{task.title}</strong>
        </div>
        <Pill type="button" onClick={onOpen} style={{ marginLeft: 'auto', flexShrink: 0 }}>Open <kbd>↵</kbd></Pill>
      </div>
      {task.notes.trim() ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--tasks-muted)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.notes}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5 }}>
        <CardChips task={task} store={session.store} done={done} />
      </div>
      {progress.total ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tasks-muted)' }}><span>Checklist {progress.done} / {progress.total}</span><Progress $value={(progress.done / progress.total) * 100} /></div> : null}
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--tasks-line)', paddingTop: 6 }}>
        <MenuItem type="button" onClick={() => void toggleDone()}>{done ? 'Mark not done' : 'Mark done'}<kbd>D</kbd></MenuItem>
        <MenuItem type="button" $on={menu === 'move'} onClick={() => setMenu(menu === 'move' ? null : 'move')}>Move to ▸<kbd>V</kbd></MenuItem>
        <MenuItem type="button" $on={menu === 'owner'} onClick={() => setMenu(menu === 'owner' ? null : 'owner')}>Owner · {task.ownerName?.trim() || 'nobody'}<kbd>O</kbd></MenuItem>
        <MenuItem type="button" $on={menu === 'due'} onClick={() => setMenu(menu === 'due' ? null : 'due')}>Due · {task.dueAt ? task.dueAt.slice(0, 10) : 'none'}<kbd>U</kbd></MenuItem>
        <MenuItem type="button" $on={menu === 'priority'} onClick={() => setMenu(menu === 'priority' ? null : 'priority')}>Priority · {task.priority}<kbd>P</kbd></MenuItem>
        {session.missionsEnabled ? <MenuItem type="button" $tone="accent" $on={menu === 'mission'} onClick={() => setMenu(menu === 'mission' ? null : 'mission')}>Create mission ▸<kbd>M</kbd></MenuItem> : null}
      </div>
      {menu ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 6, borderRadius: 10, background: 'var(--tasks-well)' }}>
          {menu === 'move' ? (<>
            <MenuHead>Move to</MenuHead>
            {session.columns.filter(column => !column.hidden).map(column => {
              const full = column.id !== task.status && columnAtLimit(session.store, column.id)
              return <MenuItem key={column.id} type="button" $on={column.id === task.status} onClick={() => void move(column.id)}>{column.label}{full ? <small>at limit</small> : null}</MenuItem>
            })}
          </>) : null}
          {menu === 'owner' ? (<>
            <MenuHead>Owner</MenuHead>
            {owners.map(name => <MenuItem key={name} type="button" $on={name === task.ownerName} onClick={() => { void session.updateTask(task.id, { ownerName: name }); setMenu(null) }}>{name}</MenuItem>)}
            <OwnerEntry onPick={name => { void session.updateTask(task.id, { ownerName: name }); setMenu(null) }} />
            <MenuRule />
            <MenuItem type="button" onClick={() => { void session.updateTask(task.id, { ownerName: '' }); setMenu(null) }}>Nobody</MenuItem>
          </>) : null}
          {menu === 'due' ? (<>
            <MenuHead>Due</MenuHead>
            {dueOptions.map(option => <MenuItem key={option.label} type="button" onClick={() => { void session.updateTask(task.id, { dueAt: option.value ?? '' }); setMenu(null) }}>{option.label}</MenuItem>)}
          </>) : null}
          {menu === 'priority' ? (<>
            <MenuHead>Priority</MenuHead>
            {(['high', 'normal', 'low'] as TaskPriority[]).map(priority => <MenuItem key={priority} type="button" $on={priority === task.priority} onClick={() => { void session.updateTask(task.id, { priority }); setMenu(null) }}>{priority[0].toUpperCase() + priority.slice(1)}</MenuItem>)}
          </>) : null}
          {menu === 'mission' ? (<>
            <MenuHead>Create mission</MenuHead>
            {MISSION_KINDS.map(kind => <MenuItem key={kind.id} type="button" title={kind.detail} onClick={() => void mission(kind.id)}>{kind.label}</MenuItem>)}
            <span style={{ padding: '6px 10px 4px', fontSize: 11, color: 'var(--tasks-faint)', lineHeight: 1.45 }}>A mission with the card as its brief. Progress shows on the card; results land through its tools.</span>
          </>) : null}
        </div>
      ) : null}
    </Popover>
  )
}

function OwnerEntry({ onPick }: { onPick: (name: string) => void }): React.ReactElement {
  const [value, setValue] = useState('')
  return (
    <form style={{ display: 'flex', gap: 6, padding: '4px 4px 2px' }} onSubmit={event => { event.preventDefault(); if (value.trim()) onPick(value.trim()) }}>
      <input aria-label="Owner name" placeholder="Someone else…" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => event.stopPropagation()} style={{ flex: 1, height: 26, padding: '0 8px', borderRadius: 7, border: '1px solid var(--tasks-line)', background: 'var(--tasks-card)', font: 'inherit', fontSize: 12.5, color: 'inherit' }} />
    </form>
  )
}
