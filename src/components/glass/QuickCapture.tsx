import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { styled } from 'styled-components'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { FieldInput, IconBtn, Meta, Pill } from './glassStyles'

const Capture = styled.form`
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 12px 16px; border-bottom: 1px solid var(--tasks-line); background: var(--tasks-panel-strong);
  label { width: 100%; font-size: 12px; font-weight: 600; }
  input { flex: 1; min-width: 160px; }
`
/** A draft stays local until submitted; a named card uses the normal board write path. */
export function QuickCapture({ session, boardName, onClose, onCreated }: {
  session: TasksSessionState; boardName: string; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const column = session.columns.find(column => column.id === 'inbox') ?? session.columns.find(column => !column.done)
  async function submit() {
    if (!title.trim() || !column || pending.current) return
    pending.current = true; setBusy(true); setError(null)
    try {
      const id = await session.createTask(title.trim(), column.id)
      if (id && session.readStore().tasks.some(task => task.id === id)) onCreated(id)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { pending.current = false; setBusy(false) }
  }
  return <Capture aria-label="Quick capture" onSubmit={event => { event.preventDefault(); void submit() }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <label htmlFor="quick-task-title">Add to {boardName} · {column?.label ?? 'Inbox'}</label>
    <FieldInput id="quick-task-title" autoFocus placeholder="What needs doing?" value={title} disabled={busy} onChange={event => setTitle(event.target.value)} />
    <Pill type="submit" $accent disabled={busy || !title.trim()}>{busy ? 'Adding…' : 'Add task'}</Pill>
    <IconBtn type="button" aria-label="Cancel capture" onClick={onClose}><X size={16} /></IconBtn>
    {error ? <Meta role="alert" style={{ width: '100%', color: 'var(--tasks-bad-ink)' }}>{error}</Meta> : null}
  </Capture>
}
