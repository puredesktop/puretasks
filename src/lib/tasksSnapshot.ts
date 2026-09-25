import { TASK_STATUS_LABELS, TASK_STATUSES } from './taskModel'
import type { SuiteTask, TaskStatus } from '../types'

/**
 * A distilled snapshot of the board for the document switcher: real
 * columns with the real cards, drawn as one self-contained SVG.
 */

const WIDTH = 900
const HEIGHT = 620
const PAD = 24
const COL_GAP = 18
const CARD_H = 54
const CARD_GAP = 10
const MAX_CARDS = 7

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function tasksSnapshotHtml(tasks: SuiteTask[]): string | null {
  if (!tasks.length) return null
  const statuses: TaskStatus[] = [
    ...TASK_STATUSES.filter(status =>
      tasks.some(task => task.status === status),
    ),
    ...[...new Set(tasks.map(task => task.status))].filter(
      status => !(TASK_STATUSES as string[]).includes(status),
    ),
  ].slice(0, 5)
  if (!statuses.length) return null

  const colWidth =
    (WIDTH - PAD * 2 - COL_GAP * (statuses.length - 1)) / statuses.length
  const parts: string[] = []
  statuses.forEach((status, index) => {
    const x = PAD + index * (colWidth + COL_GAP)
    const columnTasks = tasks
      .filter(task => task.status === status)
      .sort((a, b) => a.order - b.order)
    const label =
      (TASK_STATUS_LABELS as Record<string, string>)[status] ?? status
    parts.push(
      `<text x="${x + 4}" y="${PAD + 16}" font-family="Archivo, system-ui, sans-serif" font-size="16" font-weight="700" fill="#57545f" letter-spacing="1">${escapeXml(label.toUpperCase().slice(0, 14))} · ${columnTasks.length}</text>`,
    )
    columnTasks.slice(0, MAX_CARDS).forEach((task, row) => {
      const y = PAD + 34 + row * (CARD_H + CARD_GAP)
      if (y + CARD_H > HEIGHT - PAD) return
      const accent =
        task.priority === 'high'
          ? '#c05b5b'
          : task.priority === 'low'
          ? '#9aa2ad'
          : '#7a7f8a'
      parts.push(
        `<rect x="${x}" y="${y}" width="${colWidth}" height="${CARD_H}" rx="7" fill="#ffffff" stroke="#e4e1ea" stroke-width="2"/>` +
          `<rect x="${x}" y="${y}" width="5" height="${CARD_H}" rx="2.5" fill="${accent}"/>` +
          `<text x="${x + 14}" y="${y + CARD_H / 2 + 5}" font-family="Archivo, system-ui, sans-serif" font-size="15" fill="#2b2933">${escapeXml(task.title.slice(0, Math.floor(colWidth / 9)))}</text>`,
      )
    })
  })
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#f7f6f9}</style></head>
<body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${parts.join('')}</svg></body></html>`
}
