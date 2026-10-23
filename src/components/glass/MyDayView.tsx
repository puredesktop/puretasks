import { useRef, useState } from 'react'
import { styled } from 'styled-components'
import type { BoardIndexEntry } from '../../hooks/useBoardsIndex'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { dueBucket, isBlocked, isReviewStatus } from '../../lib/taskModel'
import { crossBoardTasks, taskRef, todayKey, workQueue, type CrossTask } from '../../lib/workQueue'
import { taskAgentRefs } from '../../agentRefs'
import { dueTone, dueWords, hueOf } from './cardBits'
import { FieldInput, Kicker, ListRowGlass, Meta, Pill, PlaceTitle, SectionRow, Tag } from './glassStyles'
export { crossBoardTasks, taskRef, todayKey, type CrossTask } from '../../lib/workQueue'

const TaskTitle = styled.button`
  display: block; text-align: left; color: inherit; font: inherit; font-weight: 600;
  padding: 0; border: 0; background: transparent; cursor: pointer; overflow-wrap: anywhere;
  &:hover { color: var(--tasks-acc-ink); }
  &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 3px; }
`
const Queue = styled.div`
  display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;
  overflow: auto; padding: 4px 8px 24px 0;
  header { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .queue-row { grid-template-columns: minmax(0, 1fr) auto; }
  @media (max-width: 600px) { .queue-row { grid-template-columns: minmax(0, 1fr); gap: 10px; } }
`
function WorkRow({ entry, onOpen, children }: { entry: CrossTask; onOpen: (entry: CrossTask) => void; children?: React.ReactNode }) {
  return <ListRowGlass className="queue-row" {...(entry.foreign ? {} : taskAgentRefs(entry.task))}>
    <div style={{ minWidth: 0 }}>
      <TaskTitle type="button" onClick={() => onOpen(entry)}>{entry.task.title}</TaskTitle>
      <div className="m"><span>{entry.board.name}</span><Tag>{entry.store.columns?.find(column => column.id === entry.task.status)?.label ?? entry.task.status}</Tag>
        {entry.task.ownerName ? <span>{entry.task.ownerName}</span> : null}
        {entry.task.dueAt ? <Tag $tone={dueTone(entry.task.dueAt, false)}>{dueWords(entry.task.dueAt)}</Tag> : null}
        {isBlocked(entry.task, entry.store) ? <Tag $tone="blocked">Blocked</Tag> : null}
      </div>
    </div><div className="actions">{children}</div>
  </ListRowGlass>
}
export function MyDayView({ session, boards, openPath, chosen, onChoose, onOpen, onToast }: {
  session: TasksSessionState; boards: BoardIndexEntry[]; openPath: string | null;
  chosen: ReadonlySet<string>; onChoose: (ref: string, on: boolean) => void;
  onOpen: (entry: CrossTask) => void; onToast: (text: string) => void;
}): React.ReactElement {
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const queue = workQueue(crossBoardTasks(boards, openPath), chosen)
  async function finish(entry: CrossTask) {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const ok = await session.moveTask(entry.task.id, session.columns.find(column => column.done)?.id ?? 'done')
      if (!ok) onToast('The done column is at its limit.')
    } catch (error) { onToast(error instanceof Error ? error.message : String(error)) }
    finally { pending.current = false; setBusy(false) }
  }
  const choice = (entry: CrossTask) => <Pill type="button" $quiet onClick={() => onChoose(taskRef(entry), !chosen.has(taskRef(entry)))}>{chosen.has(taskRef(entry)) ? 'Remove from today' : 'Choose for today'}</Pill>
  const rows = (entries: CrossTask[]) => entries.map(entry => <WorkRow key={taskRef(entry)} entry={entry} onOpen={onOpen}>
    {choice(entry)}
    {entry.foreign || isReviewStatus(entry.store, entry.task.status) || isBlocked(entry.task, entry.store)
      ? <Pill type="button" onClick={() => onOpen(entry)}>{isReviewStatus(entry.store, entry.task.status) ? 'Review card' : 'Open card'}</Pill>
      : <Pill type="button" disabled={busy} onClick={() => void finish(entry)}>Mark done</Pill>}
  </WorkRow>)
  const available = queue.available.filter(entry => `${entry.task.title} ${entry.board.name} ${entry.task.ownerName ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  return <Queue>
    <header><div><Kicker>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Kicker><PlaceTitle>Today</PlaceTitle></div><span style={{ flex: 1 }} /><Pill type="button" $accent aria-expanded={picking} onClick={() => setPicking(!picking)}>{picking ? 'Finish choosing' : 'Choose work'}</Pill></header>
    <Meta>Across all boards and owners. Choose a focus for today; due dates stay as they are.</Meta>
    {picking ? <section aria-label="Choose work"><SectionRow><h3>Available work</h3><span>{available.length}</span></SectionRow>
      <FieldInput aria-label="Find work to choose" placeholder="Find a card, board or owner…" value={query} onChange={event => setQuery(event.target.value)} style={{ marginBottom: 8 }} />
      {available.slice(0, 40).map(entry => <WorkRow key={taskRef(entry)} entry={entry} onOpen={onOpen}>{choice(entry)}</WorkRow>)}
      {!available.length ? <Meta>No matching work. Capture a task with + Task, or choose another board.</Meta> : null}
      {available.length > 40 ? <Meta>Showing 40 cards. Search to narrow the list.</Meta> : null}
    </section> : null}
    <SectionRow><h3>Chosen for today</h3><span>{queue.chosen.length}</span></SectionRow>
    {queue.chosen.length ? rows(queue.chosen) : <Meta style={{ padding: '8px 4px 16px' }}>A short list you choose. Undated, unassigned cards belong here too.</Meta>}
    <SectionRow><h3>Deadlines</h3><span>{queue.overdue.length} overdue · {queue.dueToday.length} due today</span></SectionRow>
    {rows([...queue.overdue, ...queue.dueToday])}
    {!queue.overdue.length && !queue.dueToday.length ? <Meta>No deadlines today.</Meta> : null}
    {queue.waiting.length ? <><SectionRow><h3>Waiting on work</h3><span>{queue.waiting.length}</span></SectionRow>{queue.waiting.map(entry => <WorkRow key={taskRef(entry)} entry={entry} onOpen={onOpen}><Pill type="button" onClick={() => onOpen(entry)}>See blockers</Pill></WorkRow>)}</> : null}
  </Queue>
}
export function ReviewView({ boards, openPath, onOpen }: { boards: BoardIndexEntry[]; openPath: string | null; onOpen: (entry: CrossTask) => void }): React.ReactElement {
  const entries = workQueue(crossBoardTasks(boards, openPath), new Set()).review
  return <Queue><header><div><Kicker>Across all boards</Kicker><PlaceTitle>Review</PlaceTitle></div><Meta>{entries.length} ready to review</Meta></header>
    <Meta>Check the result, then mark it done or send it back for changes. Choose which columns appear here from their column menus.</Meta>
    {entries.map(entry => <WorkRow key={taskRef(entry)} entry={entry} onOpen={onOpen}>
      <Meta>{entry.task.links.filter(link => link.type !== 'mission').length} links · {entry.task.comments.length} comments</Meta><Pill type="button" onClick={() => onOpen(entry)}>Review card</Pill>
    </WorkRow>)}
    {!entries.length ? <Meta style={{ paddingTop: 20 }}>Nothing waiting for review. Move a card to a review column whenever you want a second look.</Meta> : null}
  </Queue>
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
    <ListRowGlass style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <div style={{ minWidth: 0 }}><TaskTitle type="button" onClick={() => onOpen(entry)}>{entry.task.title}</TaskTitle><div className="m"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: `oklch(0.55 0.12 ${hueOf(entry.board.name)})`, display: 'inline-block' }} />{entry.board.name}</span>{entry.task.dueAt ? <Tag $tone={dueTone(entry.task.dueAt, false)}>{dueWords(entry.task.dueAt)}</Tag> : null}{entry.task.priority === 'high' ? <Tag $tone="pri">High</Tag> : null}</div></div>
      <Tag>{entry.store.columns?.find(column => column.id === entry.task.status)?.label ?? entry.task.status}</Tag>
    </ListRowGlass>
  )
}
