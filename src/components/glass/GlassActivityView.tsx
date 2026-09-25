import { styled } from 'styled-components'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { taskStatusLabel } from '../../lib/taskModel'
import { activityDisplayText, activityMovedStatus, formatShortTime } from '../puretasksFormat'
import { Avatar, Kicker, Meta, Tag } from './glassStyles'
import { hueOf } from './cardBits'
import { ownerInitials } from '../puretasksFormat'

const Feed = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 6px 14px;
  border-radius: 14px;
  background: var(--tasks-panel);
  border: 1px solid var(--tasks-edge);
  backdrop-filter: var(--tasks-blur);
  -webkit-backdrop-filter: var(--tasks-blur);
`
const Item = styled.button`
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px 4px;
  border: 0;
  border-top: 1px solid var(--tasks-line);
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  &:first-of-type { border-top: 0; }
  &:hover { background: var(--tasks-well); }
  b { font-size: 13px; font-weight: 600; }
  .what { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; color: var(--tasks-muted); margin-top: 2px; }
  .when { font-family: var(--tasks-mono); font-size: 10.5px; color: var(--tasks-faint); white-space: nowrap; }
`

/** What happened on the visible cards, newest first, by day. */
export function GlassActivityView({ session, onOpenTask }: { session: TasksSessionState; onOpenTask: (taskId: string) => void }): React.ReactElement {
  const visible = new Set(session.visibleTasks.map(task => task.id))
  const activity = session.store.activity.filter(item => visible.has(item.taskId)).sort((a, b) => b.at.localeCompare(a.at))
  const days = Array.from(new Set(activity.map(item => item.at.slice(0, 10))))
  const dayLabel = (key: string): string => {
    const date = new Date(`${key}T00:00:00`)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000)
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Meta>Everything that happened on the cards you can see, newest first.</Meta><span style={{ flex: 1 }} /><Meta>{activity.length} entries</Meta></div>
      <Feed>
        {days.map(day => (
          <div key={day} style={{ display: 'contents' }}>
            <Kicker style={{ padding: '12px 4px 4px' }}>{dayLabel(day)}</Kicker>
            {activity.filter(item => item.at.slice(0, 10) === day).map(item => {
              const task = session.store.tasks.find(candidate => candidate.id === item.taskId)
              const moved = activityMovedStatus(item.text)
              const who = item.type === 'agent' || item.type === 'mission' ? 'AI' : task?.ownerName ? ownerInitials(task.ownerName) : 'PT'
              return (
                <Item key={item.id} type="button" onClick={() => onOpenTask(item.taskId)}>
                  <Avatar $size={26} $hue={who === 'AI' ? 318 : task?.ownerName ? hueOf(task.ownerName) : 230}>{who}</Avatar>
                  <span style={{ minWidth: 0 }}><b>{task?.title ?? 'Task'}</b><span className="what">{moved ? <>moved to <Tag>{taskStatusLabel(session.columns, moved)}</Tag></> : item.type === 'mission' ? <Tag $tone="ai">{item.text}</Tag> : activityDisplayText(item.text)}</span></span>
                  <span className="when">{formatShortTime(item.at)}</span>
                </Item>
              )
            })}
          </div>
        ))}
        {!activity.length ? <Meta style={{ padding: 12 }}>No activity on the visible cards yet.</Meta> : null}
      </Feed>
    </div>
  )
}
