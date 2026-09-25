import { styled } from 'styled-components'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { dueBucket, isBlocked } from '../../lib/taskModel'
import { todayKey } from './MyDayView'
import { Kicker, Meta, Tag } from './glassStyles'

const DAY = 86_400_000
const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  border-radius: 14px;
  background: var(--tasks-panel);
  border: 1px solid var(--tasks-edge);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
`
const Row = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-height: 30px;
  font-size: 13px;
  > span.t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; cursor: pointer; }
`
const Track = styled.div`
  position: relative;
  height: 22px;
  border-radius: 6px;
  background: var(--tasks-well);
  overflow: hidden;
`
const Bar = styled.button<{ $tone: 'open' | 'done' | 'over' | 'blocked' }>`
  position: absolute;
  top: 3px;
  height: 16px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  background: ${({ $tone }) => ($tone === 'done' ? 'var(--tasks-ok-bg)' : $tone === 'over' ? 'var(--tasks-bad-bg)' : $tone === 'blocked' ? 'var(--tasks-warn-bg)' : 'var(--tasks-ai-bg)')};
  color: ${({ $tone }) => ($tone === 'done' ? 'var(--tasks-ok-ink)' : $tone === 'over' ? 'var(--tasks-bad-ink)' : $tone === 'blocked' ? 'var(--tasks-warn-ink)' : 'var(--tasks-acc-ink)')};
  font: 600 11px var(--platform-typography-font-family);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  text-align: left;
`
const TodayLine = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--tasks-acc);
  opacity: 0.8;
`

/** Cards as bars from when they were made to when they are due, on one axis, today marked. */
export function GlassTimelineView({ session, onOpenTask }: { session: TasksSessionState; onOpenTask: (taskId: string) => void }): React.ReactElement {
  const tasks = session.visibleTasks
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const starts = tasks.map(task => Date.parse(task.createdAt.slice(0, 10)))
  const ends = tasks.map(task => Date.parse((task.dueAt ?? task.updatedAt).slice(0, 10)))
  const min = Math.min(now.getTime() - 7 * DAY, ...starts)
  const max = Math.max(now.getTime() + 14 * DAY, ...ends)
  const span = Math.max(DAY, max - min)
  const pct = (time: number): number => ((time - min) / span) * 100
  const groups = session.columns.filter(column => !column.hidden).map(column => ({ column, tasks: tasks.filter(task => task.status === column.id) })).filter(group => group.tasks.length)
  const ticks: Array<{ at: number; label: string }> = []
  for (let time = min; time <= max; time += 7 * DAY) ticks.push({ at: time, label: new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Meta>From when a card was made to when it is due; the line is today.</Meta><span style={{ flex: 1 }} /><Meta>{tasks.length} cards</Meta></div>
      <Rows>
        <Row style={{ minHeight: 18 }}><span /><div style={{ position: 'relative', height: 16 }}>{ticks.map(tick => <span key={tick.at} style={{ position: 'absolute', left: `${pct(tick.at)}%`, transform: 'translateX(-50%)', fontFamily: 'var(--tasks-mono)', fontSize: 10, color: 'var(--tasks-faint)', whiteSpace: 'nowrap' }}>{tick.label}</span>)}</div></Row>
        {groups.map(group => (
          <div key={group.column.id} style={{ display: 'contents' }}>
            <Row style={{ minHeight: 24 }}><Kicker>{group.column.label} · {group.tasks.length}</Kicker><span /></Row>
            {group.tasks.map(task => {
              const done = session.isDoneStatus(task.status)
              const start = Date.parse(task.createdAt.slice(0, 10))
              const end = Math.max(start + DAY, Date.parse((task.dueAt ?? task.updatedAt).slice(0, 10)) + DAY)
              const tone = done ? 'done' : dueBucket(task) === 'overdue' ? 'over' : isBlocked(task, session.store) ? 'blocked' : 'open'
              return (
                <Row key={task.id}>
                  <span className="t" title={task.title} onClick={() => onOpenTask(task.id)}>{task.title}</span>
                  <Track>
                    <TodayLine style={{ left: `${pct(now.getTime())}%` }} />
                    <Bar type="button" $tone={tone} style={{ left: `${pct(start)}%`, width: `${Math.max(2, pct(end) - pct(start))}%` }} title={`${task.title}${task.dueAt ? ` · due ${task.dueAt.slice(0, 10)}` : ''}`} onClick={() => onOpenTask(task.id)}>{task.dueAt ? (task.dueAt.slice(0, 10) === todayKey() ? 'today' : task.dueAt.slice(5, 10)) : 'no date'}</Bar>
                  </Track>
                </Row>
              )
            })}
          </div>
        ))}
        {!tasks.length ? <Meta style={{ padding: 12 }}>Nothing to place yet.</Meta> : null}
      </Rows>
      <div style={{ display: 'flex', gap: 6 }}><Tag $tone="ok">done</Tag><Tag $tone="over">overdue</Tag><Tag $tone="pri">blocked</Tag><Tag $tone="ai">open</Tag></div>
    </div>
  )
}
