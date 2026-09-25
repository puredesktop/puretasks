import type { TasksSessionState } from '../../hooks/useTasksSession'
import { checklistProgress, dueBucket } from '../../lib/taskModel'
import type { SuiteTask } from '../../types'
import { Avatar, Tag, Table } from './glassStyles'
import { dueTone, dueWords, hueOf, linkWord } from './cardBits'
import { ownerInitials } from '../puretasksFormat'
import type { GroupBy } from './FilterBar'

/** The list: every visible card as a row, grouped by what you chose, with the same chips as the board. */
export function GlassListView({ session, groupBy, onOpenTask }: { session: TasksSessionState; groupBy: GroupBy; onOpenTask: (taskId: string) => void }): React.ReactElement {
  const tasks = session.visibleTasks
  const groups: Array<{ id: string; label: string; note?: string; tasks: SuiteTask[] }> = (() => {
    if (groupBy === 'owner') {
      const names = Array.from(new Set(tasks.map(task => task.ownerName?.trim() || ''))).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      return names.map(name => ({ id: name || '__none', label: name || 'Nobody yet', note: name ? undefined : 'assign, or create a mission', tasks: tasks.filter(task => (task.ownerName?.trim() || '') === name) }))
    }
    if (groupBy === 'label') {
      const labels = Array.from(new Set(tasks.flatMap(task => (task.labels.length ? task.labels : ['']))))
      return labels.map(label => ({ id: label || '__none', label: label || 'No label', tasks: tasks.filter(task => (task.labels.length ? task.labels.includes(label) : label === '')) }))
    }
    if (groupBy === 'priority') return (['high', 'normal', 'low'] as const).map(priority => ({ id: priority, label: priority[0].toUpperCase() + priority.slice(1), tasks: tasks.filter(task => task.priority === priority) }))
    if (groupBy === 'due') return (['overdue', 'today', 'tomorrow', 'week', 'later', 'none'] as const).map(bucket => ({ id: bucket, label: { overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later', none: 'No date' }[bucket], tasks: tasks.filter(task => dueBucket(task) === bucket) }))
    return [{ id: '__all', label: '', tasks }]
  })().filter(group => group.tasks.length)
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 14, background: 'var(--tasks-panel)', border: '1px solid var(--tasks-edge)', padding: '0 4px' }}>
      <Table>
        <thead><tr><th style={{ width: '38%' }}>Task</th><th>Status</th><th>Priority</th><th>Due</th><th>Steps</th><th>Labels</th><th>Linked</th></tr></thead>
        <tbody>
          {groups.map(group => (
            <GroupRows key={group.id} group={group} session={session} onOpenTask={onOpenTask} />
          ))}
          {!tasks.length ? <tr><td colSpan={7} style={{ color: 'var(--tasks-muted)', padding: 24, textAlign: 'center' }}>Nothing matches. Clear the filters or add a task.</td></tr> : null}
        </tbody>
      </Table>
    </div>
  )
}

function GroupRows({ group, session, onOpenTask }: { group: { id: string; label: string; note?: string; tasks: SuiteTask[] }; session: TasksSessionState; onOpenTask: (taskId: string) => void }): React.ReactElement {
  const open = group.tasks.filter(task => !session.isDoneStatus(task.status)).length
  return (
    <>
      {group.label ? <tr className="group"><td colSpan={7}>{group.id !== '__none' && group.label && session.store.tasks.some(task => task.ownerName === group.label) ? <Avatar $hue={hueOf(group.label)} $size={22} style={{ marginRight: 8, verticalAlign: 'middle' }}>{ownerInitials(group.label)}</Avatar> : null}{group.label}<span>{open} open{group.note ? ` · ${group.note}` : ''}</span></td></tr> : null}
      {group.tasks.map(task => {
        const done = session.isDoneStatus(task.status)
        const progress = checklistProgress(task)
        return (
          <tr key={task.id} className="row" onClick={() => onOpenTask(task.id)}>
            <td className="t" style={done ? { textDecoration: 'line-through', color: 'var(--tasks-muted)' } : undefined}>{task.title}</td>
            <td><Tag $tone={done ? 'ok' : undefined}>{session.columns.find(column => column.id === task.status)?.label ?? task.status}</Tag></td>
            <td>{task.priority === 'high' ? <Tag $tone="pri">High</Tag> : task.priority === 'low' ? <Tag>Low</Tag> : <span style={{ color: 'var(--tasks-muted)' }}>Normal</span>}</td>
            <td>{task.dueAt ? <Tag $tone={dueTone(task.dueAt, done)}>{dueWords(task.dueAt)}</Tag> : <span style={{ color: 'var(--tasks-faint)' }}>—</span>}</td>
            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{progress.total ? `${progress.done} / ${progress.total}` : <span style={{ color: 'var(--tasks-faint)' }}>—</span>}</td>
            <td>{task.labels.slice(0, 3).map(label => <Tag key={label} style={{ marginRight: 4 }}>{label}</Tag>)}</td>
            <td>{task.links.filter(link => link.type !== 'mission').slice(0, 2).map(link => <Tag key={link.id} $tone="link" style={{ marginRight: 4 }} title={link.title}>{linkWord(link)}</Tag>)}</td>
          </tr>
        )
      })}
    </>
  )
}
