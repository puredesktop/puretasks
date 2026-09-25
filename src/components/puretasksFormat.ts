import { TASK_STATUSES, TASK_STATUS_LABELS } from '../lib/taskModel'
import type { PlatformChipTone } from '@purescience/platform-ui/components/common/feedback/PlatformChip'
import type { TaskPriority, TaskStatus } from '../types'

export type SemanticChipTone = Extract<
  PlatformChipTone,
  'blue' | 'orange' | 'green' | 'red' | 'neutral'
>

export function parseLabels(value: string): string[] {
  return value
    .split(',')
    .map(label => label.trim())
    .filter(Boolean)
}

export function formatDate(value: string | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function formatShortDate(value: string | undefined): string {
  if (!value) return '–'
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric', year: 'numeric' },
  )
}

export function formatShortTime(value: string | undefined): string {
  if (!value) return ''
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function relativeDueHint(value: string | undefined): string {
  if (!value) return ''
  const today = new Date()
  const due = new Date(`${value.slice(0, 10)}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 1) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

export function activityDisplayText(value: string): string {
  const movedMatch = value.match(/^Moved to (.+)$/i)
  if (movedMatch) return `moved → ${movedMatch[1]}`
  return value.charAt(0).toLowerCase() + value.slice(1)
}

export function activityMovedStatus(value: string): TaskStatus | null {
  const movedMatch = value.match(/^Moved to (.+)$/i)
  if (!movedMatch) return null
  const label = movedMatch[1]?.toLowerCase()
  return (
    TASK_STATUSES.find(
      status => TASK_STATUS_LABELS[status].toLowerCase() === label,
    ) ?? null
  )
}

export function ownerInitials(value: string | undefined): string {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return ''
  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function priorityTone(priority: TaskPriority): SemanticChipTone {
  if (priority === 'high') return 'red'
  return 'neutral'
}

export function nextStatus(
  status: TaskStatus,
  statuses: TaskStatus[] = TASK_STATUSES,
): TaskStatus {
  const index = Math.max(0, statuses.indexOf(status))
  return statuses[Math.min(statuses.length - 1, index + 1)] ?? status
}

export function previousStatus(
  status: TaskStatus,
  statuses: TaskStatus[] = TASK_STATUSES,
): TaskStatus {
  const index = Math.max(0, statuses.indexOf(status))
  return statuses[Math.max(0, index - 1)] ?? status
}
