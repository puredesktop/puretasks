import type { BoardIndexEntry } from '../../hooks/useBoardsIndex'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { checklistProgress, dueBucket, isBlocked } from '../../lib/taskModel'
import type { SuiteTask, TasksStore } from '../../types'
import { dueTone, dueWords, hueOf } from './cardBits'
import { Kicker, ListRowGlass, Meta, Pill, PlaceTitle, SectionRow, Tag } from './glassStyles'

export interface CrossTask { task: SuiteTask; board: BoardIndexEntry; store: TasksStore; done: boolean; foreign: boolean }

/** Every open card across every board, with where it lives. */
export function crossBoardTasks(boards: BoardIndexEntry[], openPath: string | null): CrossTask[] {
  const out: CrossTask[] = []
  for (const board of boards) {
    const store = board.store
    if (!store) continue
    const doneIds = new Set((store.columns ?? []).filter(column => column.done).map(column => column.id))
    for (const task of store.tasks) {
      if (task.archivedAt) continue
      out.push({ task, board, store, done: doneIds.has(task.status) || task.status === 'done', foreign: board.path !== (openPath?.replace(/\/+$/, '') ?? null) })
    }
  }
  return out
}

export const todayKey = (date = new Date()): string => { const pad = (n: number): string => String(n).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
export const taskRef = (entry: CrossTask): string => `${entry.board.path}#${entry.task.id}`

/** My day: overdue and today across boards, what you chose for today, and what waits on others. */
export function MyDayView({ session, boards, openPath, chosen, onChoose, onOpen, onToast }: {
  session: TasksSessionState
  boards: BoardIndexEntry[]
  openPath: string | null
  chosen: ReadonlySet<string>
  onChoose: (ref: string, on: boolean) => void
  onOpen: (entry: CrossTask) => void
  onToast: (text: string) => void
}): React.ReactElement {
  const all = crossBoardTasks(boards, openPath).filter(entry => !entry.done)
  const overdue = all.filter(entry => dueBucket(entry.task) === 'overdue')
  const today = all.filter(entry => dueBucket(entry.task) === 'today' || (chosen.has(taskRef(entry)) && dueBucket(entry.task) !== 'overdue'))
  const waiting = all.filter(entry => isBlocked(entry.task, entry.store) && !today.includes(entry) && !overdue.includes(entry))
  const hours = today.reduce((sum, entry) => sum + (entry.task.estimateHours ?? 0), 0)
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  async function toggleDone(entry: CrossTask): Promise<void> {
    if (entry.foreign) { onOpen(entry); return }
    const target = session.columns.find(column => column.done)?.id ?? 'done'
    const ok = await session.moveTask(entry.task.id, target)
    if (!ok) onToast('That column is at its limit.')
  }
  async function reschedule(entry: CrossTask, offset: number): Promise<void> {
    if (entry.foreign) { onOpen(entry); return }
    const date = new Date(); date.setDate(date.getDate() + offset)
    await session.updateTask(entry.task.id, { dueAt: todayKey(date) })
  }

  const row = (entry: CrossTask, actions: React.ReactNode, muted = false): React.ReactElement => {
    const progress = checklistProgress(entry.task)
    return (
      <ListRowGlass key={taskRef(entry)} $muted={muted}>
        <input type="checkbox" aria-label={`Done: ${entry.task.title}`} checked={false} disabled={muted} onChange={() => void toggleDone(entry)} />
        <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(entry)}>
          <b>{entry.task.title}</b>
          <div className="m">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: `oklch(0.55 0.12 ${hueOf(entry.board.name)})`, display: 'inline-block' }} />{entry.board.name}</span>
            {entry.task.dueAt ? <Tag $tone={dueTone(entry.task.dueAt, false)}>{dueWords(entry.task.dueAt)}</Tag> : null}
            {entry.task.priority === 'high' ? <Tag $tone="pri">High</Tag> : null}
            {progress.total ? <Tag>{progress.done} / {progress.total} steps</Tag> : null}
            {isBlocked(entry.task, entry.store) ? <Tag $tone="blocked">blocked</Tag> : null}
            {entry.task.labels.slice(0, 2).map(label => <Tag key={label}>{label}</Tag>)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{actions}</div>
      </ListRowGlass>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 8, paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 4 }}>
        <div><Kicker>{dateLine}</Kicker><PlaceTitle>My day</PlaceTitle></div>
        <span style={{ flex: 1 }} />
        <Meta>{today.length} for today{hours ? ` · about ${hours} h` : ''}{overdue.length ? ` · ${overdue.length} overdue carried in` : ''}</Meta>
        {session.missionsEnabled ? <Pill type="button" onClick={() => onToast('Plan my day: pick the cards above, then create a mission from them — the plan lands in your calendar.')}>Plan my day · mission</Pill> : null}
      </div>
      {overdue.length ? <SectionRow><h3>Overdue</h3><span>{overdue.length}</span></SectionRow> : null}
      {overdue.map(entry => row(entry, <><Pill type="button" onClick={() => void reschedule(entry, 0)} style={{ height: 26 }}>Today</Pill><Pill type="button" onClick={() => void reschedule(entry, 1)} style={{ height: 26 }}>Tomorrow</Pill></>))}
      <SectionRow><h3>Today</h3><span>{today.length}{today.length ? ' · tick when done' : ''}</span></SectionRow>
      {today.length ? today.map(entry => row(entry, <>{entry.task.estimateHours ? <span style={{ fontFamily: 'var(--tasks-mono)', fontSize: 11, color: 'var(--tasks-muted)' }}>~{entry.task.estimateHours} h</span> : null}{chosen.has(taskRef(entry)) ? <Pill type="button" $quiet onClick={() => onChoose(taskRef(entry), false)} style={{ height: 26 }}>Not today</Pill> : null}</>)) : <Meta style={{ padding: '6px 4px' }}>Nothing chosen yet. Open a card and press <kbd style={{ fontFamily: 'var(--tasks-mono)' }}>T</kbd>, or add due dates — cards due today land here on their own.</Meta>}
      {waiting.length ? <SectionRow><h3>Waiting on others</h3><span>{waiting.length} · not counted</span></SectionRow> : null}
      {waiting.map(entry => row(entry, <Pill type="button" onClick={() => onOpen(entry)} style={{ height: 26 }}>Open</Pill>, true))}
    </div>
  )
}

/** Upcoming: the next two weeks across boards, by day. */
export function UpcomingView({ boards, openPath, onOpen }: { boards: BoardIndexEntry[]; openPath: string | null; onOpen: (entry: CrossTask) => void }): React.ReactElement {
  const all = crossBoardTasks(boards, openPath).filter(entry => !entry.done && entry.task.dueAt)
  const days: Array<{ key: string; label: string; entries: CrossTask[] }> = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(today); date.setDate(date.getDate() + offset)
    const key = todayKey(date)
    const entries = all.filter(entry => entry.task.dueAt?.slice(0, 10) === key)
    days.push({ key, label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }), entries })
  }
  const later = all.filter(entry => (entry.task.dueAt ?? '') > days[days.length - 1].key)
  const overdue = all.filter(entry => dueBucket(entry.task) === 'overdue')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 8, paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 4 }}><div><Kicker>Next two weeks</Kicker><PlaceTitle>Upcoming</PlaceTitle></div><span style={{ flex: 1 }} /><Meta>{all.length} dated · {overdue.length} overdue · {later.length} later</Meta></div>
      {overdue.length ? <><SectionRow><h3>Overdue</h3><span>{overdue.length}</span></SectionRow>{overdue.map(entry => <Row key={taskRef(entry)} entry={entry} onOpen={onOpen} />)}</> : null}
      {days.filter(day => day.entries.length).map(day => (
        <div key={day.key} style={{ display: 'contents' }}>
          <SectionRow><h3>{day.label}</h3><span>{day.entries.length}</span></SectionRow>
          {day.entries.map(entry => <Row key={taskRef(entry)} entry={entry} onOpen={onOpen} />)}
        </div>
      ))}
      {later.length ? <><SectionRow><h3>Later</h3><span>{later.length}</span></SectionRow>{later.slice(0, 20).map(entry => <Row key={taskRef(entry)} entry={entry} onOpen={onOpen} />)}</> : null}
      {!all.length ? <Meta style={{ padding: '6px 4px' }}>No dated cards yet.</Meta> : null}
    </div>
  )
}

function Row({ entry, onOpen }: { entry: CrossTask; onOpen: (entry: CrossTask) => void }): React.ReactElement {
  return (
    <ListRowGlass style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', cursor: 'pointer' }} onClick={() => onOpen(entry)}>
      <div style={{ minWidth: 0 }}><b>{entry.task.title}</b><div className="m"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: `oklch(0.55 0.12 ${hueOf(entry.board.name)})`, display: 'inline-block' }} />{entry.board.name}</span>{entry.task.dueAt ? <Tag $tone={dueTone(entry.task.dueAt, false)}>{dueWords(entry.task.dueAt)}</Tag> : null}{entry.task.priority === 'high' ? <Tag $tone="pri">High</Tag> : null}</div></div>
      <Tag>{entry.store.columns?.find(column => column.id === entry.task.status)?.label ?? entry.task.status}</Tag>
    </ListRowGlass>
  )
}
