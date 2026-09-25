import type { SuiteTask, TaskResourceLink, TasksStore } from '../../types'
import { checklistProgress, dueBucket, isBlocked, openBlockers } from '../../lib/taskModel'
import { MISSION_PHASE_LABEL, missionLive } from '../../lib/missions'
import { ownerInitials } from '../puretasksFormat'
import { Avatar, Tag } from './glassStyles'

/** A stable hue for a person's name. */
export function hueOf(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

/** "Fri 25" / "Today" / "3 days ago" — the words a card uses for a due date. */
export function dueWords(dueAt: string | undefined, from = new Date()): string {
  if (!dueAt) return ''
  const bucket = dueBucket({ dueAt }, from)
  const date = new Date(`${dueAt.slice(0, 10)}T00:00:00`)
  const today = new Date(from); today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (bucket === 'today') return 'Today'
  if (bucket === 'tomorrow') return 'Tomorrow'
  if (bucket === 'overdue') return days === -1 ? 'Yesterday' : days > -7 ? `${-days} days ago` : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (bucket === 'week') return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function dueTone(dueAt: string | undefined, done: boolean): 'due' | 'soon' | 'over' {
  const bucket = dueBucket({ dueAt })
  if (done) return 'due'
  if (bucket === 'overdue') return 'over'
  if (bucket === 'today' || bucket === 'tomorrow') return 'soon'
  return 'due'
}

const LINK_WORD: Record<TaskResourceLink['type'], string> = {
  file: 'File', writer: 'Writer', book: 'Book', chapter: 'Chapter', 'chat-message': 'Chat', 'agent-run': 'Agent run',
  mail: 'Mail', video: 'Video', calendar: 'Calendar', issue: 'Issue', canvas: 'Canvas', sheets: 'Sheets', mission: 'Mission',
}
export const linkWord = (link: TaskResourceLink): string => LINK_WORD[link.type] ?? link.type

/** The chips a card shows; the same set on the board, in the peek and in lists. */
export function CardChips({ task, store, done, compact }: { task: SuiteTask; store: TasksStore; done: boolean; compact?: boolean }): React.ReactElement {
  const blocked = isBlocked(task, store)
  const blockers = blocked ? openBlockers(task, store) : []
  const links = task.links.filter(link => link.type !== 'mission').slice(0, compact ? 1 : 2)
  const live = task.missions.find(missionLive)
  const lastMission = live ?? task.missions[task.missions.length - 1]
  const progress = checklistProgress(task)
  return (
    <>
      {task.priority === 'high' ? <Tag $tone="pri">High</Tag> : task.priority === 'low' ? <Tag>Low</Tag> : null}
      {task.dueAt ? <Tag $tone={dueTone(task.dueAt, done)}>{dueWords(task.dueAt)}</Tag> : null}
      {links.map(link => <Tag key={link.id} $tone="link" title={link.title}>{linkWord(link)}{compact ? '' : ` · ${link.title}`}</Tag>)}
      {!compact && task.labels.slice(0, 2).map(label => <Tag key={label}>{label}</Tag>)}
      {blocked ? <Tag $tone="blocked" title={blockers.map(candidate => candidate.title).join(', ')}>Blocked by · {blockers[0]?.title ?? '?'}</Tag> : null}
      {lastMission && (missionLive(lastMission) || lastMission.phase === 'needsYou' || lastMission.phase === 'failed') ? (
        <Tag $tone={lastMission.phase === 'needsYou' || lastMission.phase === 'failed' ? 'over' : 'ai'}>Mission · {MISSION_PHASE_LABEL[lastMission.phase ?? 'planning']}</Tag>
      ) : null}
      {progress.total && !compact ? <Tag $tone={progress.done === progress.total ? 'ok' : undefined}>{progress.done} / {progress.total}</Tag> : null}
      {task.ownerName?.trim() ? <Avatar title={task.ownerName} $hue={hueOf(task.ownerName)} style={{ marginLeft: 'auto' }}>{ownerInitials(task.ownerName) || task.ownerName.slice(0, 1)}</Avatar> : null}
    </>
  )
}
