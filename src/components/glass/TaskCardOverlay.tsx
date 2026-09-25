import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { MISSION_KINDS, MISSION_PHASE_LABEL, missionLive, type MissionKind } from '../../lib/missions'
import { blocks, checklistProgress, isBlocked, openBlockers, subtasksOf, TASK_REPEATS } from '../../lib/taskModel'
import type { SuiteTask, TaskPriority, TaskRepeat } from '../../types'
import { TaskChecklistEditor, TaskConversationPanel, TaskResourceLinksEditor } from '../TaskCardInfoModal'
import { dueWords, hueOf, linkWord } from './cardBits'
import { Avatar, DoneRing, Field, FieldInput, FieldSelect, IconBtn, MenuHead, MenuItem, OverlayBackdrop, OverlayGrid, OverlayMain, OverlayPanel, OverlaySide, OverlayTop, Pill, Popover, Progress, Prose, SectionHead, SectionTitle, Stepper, SubtaskRow, Tag, TitleInput } from './glassStyles'
import { ownerInitials } from '../puretasksFormat'
import { OwnerPicker } from './OwnerPicker'

/** The card, whole: status, description, checklist, subtasks, comments; owner, priority, due, repeat, estimate, labels, dependencies, links, missions. */
export function TaskCardOverlay({ session, task, onClose, onOpenTask, onToast, onToggleMyDay, inMyDay }: {
  session: TasksSessionState
  task: SuiteTask
  onClose: () => void
  onOpenTask: (taskId: string) => void
  onToast: (text: string) => void
  onToggleMyDay: () => void
  inMyDay: boolean
}): React.ReactElement {
  const done = session.isDoneStatus(task.status)
  const store = session.store
  const blockers = openBlockers(task, store)
  const blockedCards = blocks(task, store)
  const subtasks = subtasksOf(task, store)
  const parent = task.parentId ? store.tasks.find(candidate => candidate.id === task.parentId) : undefined
  const progress = checklistProgress(task)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [labels, setLabels] = useState(task.labels.join(', '))
  const [owner, setOwner] = useState(task.ownerName ?? '')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [menu, setMenu] = useState<{ kind: 'blockedBy' | 'mission'; rect: DOMRect } | null>(null)
  useEffect(() => { setTitle(task.title); setNotes(task.notes); setLabels(task.labels.join(', ')); setOwner(task.ownerName ?? '') }, [task.id, task.title, task.notes, task.labels, task.ownerName])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (event.key === 'Escape') { if (menu) setMenu(null); else onClose(); return }
      if (editing) return
      const key = event.key.toLowerCase()
      if (key === 'd') void toggleDone()
      if (key === 't') onToggleMyDay()
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const order = session.columns.filter(column => !column.hidden).map(column => column.id)
        const index = order.indexOf(task.status)
        const next = order[index + (event.key === 'ArrowRight' ? 1 : -1)]
        if (next) void move(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function move(status: string): Promise<void> {
    const ok = await session.moveTask(task.id, status)
    if (!ok) onToast(`${session.columns.find(column => column.id === status)?.label ?? status} is at its limit — finish a card there first.`)
  }
  async function toggleDone(): Promise<void> {
    const target = done ? session.columns.find(column => !column.done && !column.hidden)?.id ?? 'inbox' : session.columns.find(column => column.done)?.id ?? 'done'
    await move(target)
  }
  async function mission(kind: MissionKind): Promise<void> {
    setMenu(null)
    try { const created = await session.createMissionForTask(task.id, kind); onToast(`Mission created: ${created.title}`) }
    catch (error) { onToast(error instanceof Error ? error.message : String(error)) }
  }
  const saveTitle = (): void => { const trimmed = title.trim(); if (trimmed && trimmed !== task.title) void session.updateTask(task.id, { title: trimmed }); else setTitle(task.title) }
  const saveNotes = (): void => { if (notes !== task.notes) void session.updateTask(task.id, { notes }) }
  const saveLabels = (): void => { const next = labels.split(',').map(label => label.trim()).filter(Boolean); if (next.join('\0') !== task.labels.join('\0')) void session.updateTask(task.id, { labels: next }) }
  const saveOwner = (value = owner): void => { if ((value.trim() || undefined) !== task.ownerName) void session.updateTask(task.id, { ownerName: value.trim() }) }
  const candidates = store.tasks.filter(candidate => candidate.id !== task.id && !candidate.archivedAt && !task.blockedBy.includes(candidate.id) && !session.isDoneStatus(candidate.status)).slice(0, 40)

  return (
    <OverlayBackdrop role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <OverlayPanel role="dialog" aria-modal="true" aria-labelledby="card-overlay-title" onMouseDown={() => { if (menu) setMenu(null) }}>
        <OverlayTop>
          <span>{session.activeProject.name} › {session.columns.find(column => column.id === task.status)?.label ?? task.status}{parent ? ` › ${parent.title}` : ''}</span>
          <span className="hint">D done · ← → move · T my day · Esc close</span>
          <Pill type="button" $quiet style={{ height: 26 }} onClick={() => { void session.updateTask(task.id, { archivedAt: new Date().toISOString() }); onClose() }}>Archive</Pill>
          <IconBtn type="button" aria-label="Close card" onClick={onClose}><X size={15} strokeWidth={2} /></IconBtn>
        </OverlayTop>
        <OverlayGrid>
          <OverlayMain>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <DoneRing type="button" $done={done} aria-label={done ? 'Mark not done' : 'Mark done'} title={done ? 'Mark not done' : 'Mark done'} onClick={() => void toggleDone()}>{done ? <Check size={14} strokeWidth={3} /> : null}</DoneRing>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span id="card-overlay-title" hidden>{task.title}</span>
                <TitleInput aria-label="Task title" value={title} onChange={event => setTitle(event.target.value)} onBlur={saveTitle} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
                <Stepper style={{ marginTop: 10 }} aria-label="Status">
                  {session.columns.filter(column => !column.hidden).map((column, index, list) => {
                    const current = list.findIndex(candidate => candidate.id === task.status)
                    return <button key={column.id} type="button" data-on={column.id === task.status} data-past={index < current} onClick={() => void move(column.id)}>{column.label}</button>
                  })}
                </Stepper>
              </div>
            </div>
            <div>
              <SectionHead><SectionTitle>Description</SectionTitle></SectionHead>
              <Prose aria-label="Description" placeholder="What is this, and what does done look like?" value={notes} onChange={event => setNotes(event.target.value)} onBlur={saveNotes} />
            </div>
            <div>
              <SectionHead>
                <SectionTitle>Checklist</SectionTitle>
                {progress.total ? <><span style={{ fontFamily: 'var(--tasks-mono)', fontSize: 11, color: 'var(--tasks-muted)' }}>{progress.done} / {progress.total}</span><Progress $value={(progress.done / progress.total) * 100} style={{ maxWidth: 120 }} /></> : null}
                {session.missionsEnabled ? <button type="button" className="link" onClick={() => void mission('steps')}>Create mission: break it into steps</button> : null}
              </SectionHead>
              <TaskChecklistEditor task={task} session={session} />
            </div>
            <div>
              <SectionHead><SectionTitle>Subtasks</SectionTitle><span style={{ fontFamily: 'var(--tasks-mono)', fontSize: 11, color: 'var(--tasks-muted)' }}>{subtasks.length}</span></SectionHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subtasks.map(subtask => (
                  <SubtaskRow key={subtask.id} role="button" tabIndex={0} onClick={() => onOpenTask(subtask.id)} onKeyDown={event => { if (event.key === 'Enter') onOpenTask(subtask.id) }}>
                    {subtask.ownerName ? <Avatar $hue={hueOf(subtask.ownerName)} $size={18}>{ownerInitials(subtask.ownerName)}</Avatar> : null}
                    <span style={session.isDoneStatus(subtask.status) ? { textDecoration: 'line-through', color: 'var(--tasks-muted)' } : undefined}>{subtask.title}</span>
                    <span className="status">{session.columns.find(column => column.id === subtask.status)?.label ?? subtask.status}</span>
                  </SubtaskRow>
                ))}
                <form style={{ display: 'flex', gap: 6 }} onSubmit={async event => { event.preventDefault(); const id = await session.createSubtask(task.id, subtaskDraft); if (id) setSubtaskDraft('') }}>
                  <FieldInput aria-label="New subtask" placeholder="+ Add a subtask · Enter" value={subtaskDraft} onChange={event => setSubtaskDraft(event.target.value)} style={{ background: 'var(--tasks-well)' }} />
                </form>
              </div>
            </div>
            <div>
              <SectionHead><SectionTitle>Linked</SectionTitle></SectionHead>
              <TaskResourceLinksEditor task={task} session={session} />
            </div>
            <div style={{ borderTop: '1px solid var(--tasks-line)', paddingTop: 12 }}>
              <TaskConversationPanel task={task} session={session} />
            </div>
          </OverlayMain>
          <OverlaySide>
            <Field><b>Owner</b><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{owner.trim() ? <Avatar $hue={hueOf(owner)} $size={22}>{ownerInitials(owner)}</Avatar> : null}<OwnerPicker value={owner} onChange={setOwner} onCommit={saveOwner} /></span></Field>
            <Field><b>Priority</b><FieldSelect aria-label="Priority" value={task.priority} onChange={event => void session.updateTask(task.id, { priority: event.target.value as TaskPriority })}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></FieldSelect></Field>
            <Field><b>Due</b><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FieldInput aria-label="Due date" type="date" value={task.dueAt?.slice(0, 10) ?? ''} onChange={event => void session.updateTask(task.id, { dueAt: event.target.value })} style={{ width: 'auto' }} />{task.dueAt ? <span style={{ fontSize: 11.5, color: 'var(--tasks-muted)', whiteSpace: 'nowrap' }}>{dueWords(task.dueAt)}</span> : null}</span></Field>
            <Field><b>Remind</b><FieldInput aria-label="Reminder" type="datetime-local" value={task.remindAt ? task.remindAt.slice(0, 16) : ''} onChange={event => void session.updateTask(task.id, { remindAt: event.target.value ? new Date(event.target.value).toISOString() : '' })} style={{ width: 'auto' }} /></Field>
            <Field><b>Repeat</b><FieldSelect aria-label="Repeat" value={task.repeat ?? 'none'} onChange={event => void session.updateTask(task.id, { repeat: (event.target.value === 'none' ? undefined : event.target.value) as TaskRepeat | undefined })}>{TASK_REPEATS.map(repeat => <option key={repeat} value={repeat}>{repeat === 'none' ? 'Never' : repeat[0].toUpperCase() + repeat.slice(1)}</option>)}</FieldSelect></Field>
            <Field data-stack="true"><b>Estimate</b><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, flexWrap: 'wrap' }}><FieldInput aria-label="Estimate in hours" type="number" min={0} step={0.25} placeholder="h" value={task.estimateHours ?? ''} onChange={event => void session.updateTask(task.id, { estimateHours: event.target.value === '' ? undefined : Number(event.target.value) })} style={{ width: 64 }} /><span style={{ color: 'var(--tasks-muted)' }}>h ·</span><FieldInput aria-label="Logged hours" type="number" min={0} step={0.25} placeholder="0" value={task.loggedHours ?? ''} onChange={event => void session.updateTask(task.id, { loggedHours: event.target.value === '' ? undefined : Number(event.target.value) })} style={{ width: 56 }} /><span style={{ color: 'var(--tasks-muted)' }}>logged</span></span></Field>
            <Field><b>Labels</b><FieldInput aria-label="Labels, comma separated" placeholder="launch, refs" value={labels} onChange={event => setLabels(event.target.value)} onBlur={saveLabels} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></Field>
            <Field data-stack="true"><b>Blocked by</b><span style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
              {task.blockedBy.map(id => { const blocker = store.tasks.find(candidate => candidate.id === id); if (!blocker) return null; const open = blockers.includes(blocker); return <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag $tone={open ? 'blocked' : 'ok'} style={{ cursor: 'pointer', maxWidth: 220 }} onClick={() => onOpenTask(id)} title={blocker.title}>{blocker.title} · {session.columns.find(column => column.id === blocker.status)?.label ?? blocker.status}</Tag><IconBtn type="button" aria-label={`No longer blocked by ${blocker.title}`} onClick={() => void session.updateTask(task.id, { blockedBy: task.blockedBy.filter(candidate => candidate !== id) })} style={{ width: 20, height: 20 }}><X size={12} /></IconBtn></span> })}
              <button type="button" className="link" style={{ alignSelf: 'flex-start', padding: 0, border: 0, background: 'none', font: '500 12px var(--platform-typography-font-family)', color: 'var(--tasks-acc-ink)', cursor: 'pointer' }} onClick={event => { event.stopPropagation(); setMenu({ kind: 'blockedBy', rect: event.currentTarget.getBoundingClientRect() }) }}>+ Waits on a card…</button>
              {!isBlocked(task, store) && task.blockedBy.length ? <span style={{ fontSize: 11, color: 'var(--tasks-ok-ink)' }}>All clear — nothing open blocks this.</span> : null}
            </span></Field>
            {blockedCards.length ? <Field data-stack="true"><b>Blocks</b><span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>{blockedCards.map(card => <Tag key={card.id} style={{ cursor: 'pointer' }} onClick={() => onOpenTask(card.id)}>{card.title}</Tag>)}</span></Field> : null}
            {task.links.filter(link => link.type !== 'mission').length ? <Field data-stack="true"><b>Linked</b><span style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>{task.links.filter(link => link.type !== 'mission').map(link => <Tag key={link.id} $tone="link" style={{ cursor: link.path ? 'pointer' : 'default', justifyContent: 'flex-start' }} onClick={() => void session.openLink(link)} title={link.path ?? link.title}>{linkWord(link)} · {link.title}</Tag>)}</span></Field> : null}
            <Field data-stack="true"><b>Missions</b><span style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
              {task.missions.slice().reverse().map(record => <Tag key={record.id} $tone={record.phase === 'done' ? 'ok' : record.phase === 'failed' || record.phase === 'needsYou' ? 'over' : missionLive(record) ? 'ai' : undefined} style={{ cursor: 'pointer', justifyContent: 'flex-start' }} onClick={() => void session.openMission(record.id)} title="Open the mission">{MISSION_PHASE_LABEL[record.phase ?? 'planning']} · {record.title} · {new Date(record.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Tag>)}
              {session.missionsEnabled ? <Pill type="button" $accent style={{ justifyContent: 'flex-start', alignSelf: 'flex-start' }} onClick={event => { event.stopPropagation(); setMenu({ kind: 'mission', rect: event.currentTarget.getBoundingClientRect() }) }}>Create mission from this card ▾</Pill> : <span style={{ fontSize: 11.5, color: 'var(--tasks-muted)' }}>Missions need PureDesktop.</span>}
            </span></Field>
            <Field data-stack="true"><b>My day</b><span><Pill type="button" $on={inMyDay} onClick={onToggleMyDay} style={{ alignSelf: 'flex-start' }}>{inMyDay ? 'In My day · remove' : 'Add to My day'} <kbd>T</kbd></Pill></span></Field>
            <div style={{ marginTop: 'auto', paddingTop: 10, fontSize: 11, color: 'var(--tasks-faint)', lineHeight: 1.5 }}>Created {new Date(task.createdAt).toLocaleDateString()} · updated {new Date(task.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · <button type="button" onClick={() => { void session.deleteTask(task.id); onClose() }} style={{ padding: 0, border: 0, background: 'none', font: 'inherit', color: 'var(--tasks-bad-ink)', cursor: 'pointer' }}>Delete…</button></div>
          </OverlaySide>
        </OverlayGrid>
        {menu ? (
          <Popover role="menu" aria-label={menu.kind === 'mission' ? 'Create mission' : 'Waits on'} style={{ left: Math.min(menu.rect.left, window.innerWidth - 300), top: menu.rect.bottom + 6, width: 290, maxHeight: 320, overflow: 'auto' }} onMouseDown={event => event.stopPropagation()}>
            {menu.kind === 'mission' ? (<><MenuHead>Create mission</MenuHead>{MISSION_KINDS.map(kind => <MenuItem key={kind.id} type="button" onClick={() => void mission(kind.id)}><span>{kind.label}<span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--tasks-muted)' }}>{kind.detail}</span></span></MenuItem>)}</>) : (
              <><MenuHead>Waits on</MenuHead>{candidates.map(candidate => <MenuItem key={candidate.id} type="button" onClick={() => { void session.updateTask(task.id, { blockedBy: [...task.blockedBy, candidate.id] }); setMenu(null) }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{candidate.title}</span><kbd>{session.columns.find(column => column.id === candidate.status)?.label}</kbd></MenuItem>)}{!candidates.length ? <span style={{ padding: '6px 10px', fontSize: 12, color: 'var(--tasks-muted)' }}>No other open cards.</span> : null}</>
            )}
          </Popover>
        ) : null}
      </OverlayPanel>
    </OverlayBackdrop>
  )
}
