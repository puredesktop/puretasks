import { useState } from 'react'
import { styled } from 'styled-components'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { dueBucket } from '../../lib/taskModel'
import type { SuiteTask } from '../../types'
import { todayKey } from './MyDayView'
import { Kicker, Meta, Pill, Tag } from './glassStyles'

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  flex: 1 1 auto;
  min-height: 0;
  grid-auto-rows: minmax(96px, 1fr);
`
const Day = styled.div<{ $muted?: boolean; $today?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  min-height: 0;
  padding: 6px;
  border-radius: 12px;
  background: ${({ $today }) => ($today ? 'color-mix(in srgb, var(--tasks-acc) 10%, var(--tasks-panel))' : 'var(--tasks-panel)')};
  border: 1px solid ${({ $today }) => ($today ? 'var(--tasks-acc)' : 'var(--tasks-edge)')};
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
  opacity: ${({ $muted }) => ($muted ? 0.55 : 1)};
  overflow: hidden;
  > b { font-family: var(--tasks-mono); font-size: 11px; font-weight: 500; color: var(--tasks-muted); }
`
const Chip = styled.button<{ $done?: boolean; $over?: boolean }>`
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 3px 7px;
  border: 1px solid var(--tasks-edge);
  border-radius: 7px;
  background: var(--tasks-card);
  font: 500 11.5px var(--platform-typography-font-family);
  color: ${({ $done, $over }) => ($done ? 'var(--tasks-muted)' : $over ? 'var(--tasks-bad-ink)' : 'var(--tasks-ink)')};
  text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  &:hover { border-color: var(--tasks-edge-strong); }
`

/** A month of due dates: every card on its day, the undated ones listed beneath. */
export function GlassCalendarView({ session, onOpenTask }: { session: TasksSessionState; onOpenTask: (taskId: string) => void }): React.ReactElement {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })
  const first = new Date(cursor)
  const startOffset = (first.getDay() + 6) % 7 // Monday first
  const start = new Date(first); start.setDate(first.getDate() - startOffset)
  const cells: Date[] = Array.from({ length: 42 }, (_, index) => { const d = new Date(start); d.setDate(start.getDate() + index); return d })
  const byDay = new Map<string, SuiteTask[]>()
  for (const task of session.visibleTasks) { if (!task.dueAt) continue; const key = task.dueAt.slice(0, 10); byDay.set(key, [...(byDay.get(key) ?? []), task]) }
  const undated = session.visibleTasks.filter(task => !task.dueAt)
  const today = todayKey()
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const dated = session.visibleTasks.filter(task => task.dueAt && task.dueAt.slice(0, 7) === todayKey(cursor).slice(0, 7)).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Pill type="button" onClick={() => setCursor(current => { const d = new Date(current); d.setMonth(d.getMonth() - 1); return d })} aria-label="Previous month">‹</Pill>
        <strong style={{ fontSize: 14, minWidth: 150 }}>{monthLabel}</strong>
        <Pill type="button" onClick={() => setCursor(current => { const d = new Date(current); d.setMonth(d.getMonth() + 1); return d })} aria-label="Next month">›</Pill>
        <Pill type="button" $quiet onClick={() => setCursor(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d })}>Today</Pill>
        <span style={{ flex: 1 }} />
        <Meta>{dated} due this month · {undated.length} without a date</Meta>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <Kicker key={day} style={{ padding: '0 6px' }}>{day}</Kicker>)}</div>
      <Grid>
        {cells.map(date => {
          const key = todayKey(date)
          const tasks = byDay.get(key) ?? []
          return (
            <Day key={key} $muted={date.getMonth() !== cursor.getMonth()} $today={key === today}>
              <b>{date.getDate()}</b>
              {tasks.slice(0, 4).map(task => <Chip key={task.id} type="button" title={task.title} $done={session.isDoneStatus(task.status)} $over={dueBucket(task) === 'overdue' && !session.isDoneStatus(task.status)} onClick={() => onOpenTask(task.id)}>{task.title}</Chip>)}
              {tasks.length > 4 ? <Meta style={{ fontSize: 11 }}>+{tasks.length - 4} more</Meta> : null}
            </Day>
          )
        })}
      </Grid>
      {undated.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '6px 0 4px' }}>
          <Kicker>No date</Kicker>
          {undated.slice(0, 12).map(task => <Tag key={task.id} style={{ cursor: 'pointer', height: 22 }} onClick={() => onOpenTask(task.id)}>{task.title}</Tag>)}
          {undated.length > 12 ? <Meta>+{undated.length - 12} more</Meta> : null}
        </div>
      ) : null}
    </div>
  )
}
