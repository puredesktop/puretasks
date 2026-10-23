import { useRef, useState } from 'react'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { isReviewColumn } from '../../lib/taskModel'
import type { SuiteTask } from '../../types'
import { Meta, Pill, Prose, SectionHead, SectionTitle } from './glassStyles'

/** Human review works identically for manual work and assignment results. */
export function ReviewDecision({ session, task, onToast }: { session: TasksSessionState; task: SuiteTask; onToast: (text: string) => void }) {
  const [requesting, setRequesting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const latest = [...task.comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  async function decide(accept: boolean) {
    if (pending.current || (!accept && !note.trim())) return
    pending.current = true; setBusy(true)
    try {
      const workColumns = session.columns.filter(column => !column.done && !isReviewColumn(column))
      const target = accept ? session.columns.find(column => column.done)?.id : workColumns.find(column => column.id === 'doing')?.id ?? workColumns[0]?.id
      if (!target) { onToast(accept ? 'Choose a done column on this board first.' : 'Choose a work column outside the review queue first.'); return }
      const ok = await session.moveTask(task.id, target, { comment: accept ? 'Review accepted.' : `Changes requested: ${note.trim()}` })
      if (!ok) onToast(`${session.columns.find(column => column.id === target)?.label ?? target} is at its limit. Your review has not been submitted.`)
      else onToast(accept ? 'Review accepted · marked done' : 'Changes requested · returned to work')
    } catch (error) { onToast(error instanceof Error ? error.message : String(error)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <section aria-label="Review decision" style={{ border: '1px solid var(--tasks-line)', borderRadius: 12, padding: 16, background: 'var(--tasks-well)' }}>
    <SectionHead><SectionTitle>Ready for review</SectionTitle></SectionHead>
    <Meta>Check the description, checklist and linked work before deciding.</Meta>
    {latest ? <blockquote style={{ margin: '12px 0', paddingLeft: 12, borderLeft: '2px solid var(--tasks-line)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{latest.text}<Meta style={{ display: 'block', marginTop: 5 }}>{latest.authorName} · latest comment</Meta></blockquote> : null}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
      {task.links.filter(link => link.type !== 'mission').map(link => <Pill key={link.id} type="button" onClick={() => void session.openLink(link).catch(error => onToast(String(error)))}>{link.title}</Pill>)}
      {task.missions.map(record => <Pill key={record.id} type="button" onClick={() => void session.openMission(record.id).catch(error => onToast(String(error)))}>Open assignment · {record.title}</Pill>)}
    </div>
    {requesting ? <Prose aria-label="Requested changes" placeholder="What needs changing?" value={note} onChange={event => setNote(event.target.value)} disabled={busy} autoFocus style={{ minHeight: 80, marginBottom: 10 }} /> : null}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {requesting ? <><Pill type="button" $accent disabled={busy || !note.trim()} onClick={() => void decide(false)}>Send back with feedback</Pill><Pill type="button" disabled={busy} onClick={() => setRequesting(false)}>Cancel</Pill></> : <><Pill type="button" $accent disabled={busy} onClick={() => void decide(true)}>Accept as done</Pill><Pill type="button" disabled={busy} onClick={() => setRequesting(true)}>Request changes</Pill></>}
    </div>
  </section>
}
