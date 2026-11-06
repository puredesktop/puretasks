import { Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { styled } from 'styled-components'
import type { TasksSessionState } from '../../hooks/useTasksSession'
import { dueBucket, isBlocked } from '../../lib/taskModel'

/**
 * PureTasks held in a page, beside a conversation: which board and how it stands, a line to put a card on it without
 * leaving the talk, and the board or today's work below. Nothing here is its own path: a card added here is the board's
 * own new card.
 */
export type MiniPlace = 'board' | 'myDay'

const Bar = styled.header`
  flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; padding: 10px 16px 8px; border-bottom: 1px solid var(--tasks-edge);
  h1 { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -0.005em; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
  .stand { font-size: 12px; color: var(--tasks-muted); font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }
  .stand b { font-weight: 650; color: var(--tasks-bad-ink); }
`
const Places = styled.nav`margin-left: auto; display: flex; gap: 2px;`
const Place = styled.button<{ $on: boolean }>`
  all: unset; cursor: pointer; padding: 3px 8px; font-size: 12.5px; font-weight: ${p => (p.$on ? 650 : 500)}; color: ${p => (p.$on ? 'var(--tasks-ink)' : 'var(--tasks-muted)')};
  background: ${p => (p.$on ? 'var(--p-chosen)' : 'transparent')}; box-shadow: ${p => (p.$on ? 'var(--p-chosen-edge)' : 'none')}; font-variant-numeric: tabular-nums lining-nums;
  &:hover { color: var(--tasks-ink); } &:focus-visible { outline: 2px solid var(--tasks-acc); outline-offset: 1px; }
`
const Capture = styled.form`
  flex-basis: 100%; display: flex; align-items: center; gap: 8px; padding-top: 6px;
  svg { width: 15px; height: 15px; color: var(--tasks-faint); flex: none; }
  input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 13.5px; color: var(--tasks-ink); padding: 3px 0; outline: none; }
  input::placeholder { color: var(--tasks-faint); }
  button { all: unset; cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--tasks-acc-ink); padding: 3px 8px; }
  button:disabled { opacity: 0.4; cursor: default; } button:focus-visible { outline: 2px solid var(--tasks-acc); }
  .said { font-size: 12px; color: var(--tasks-bad-ink); }
`

export function MiniBar({ session, boardName, place, onPlace, todayCount }: { session: TasksSessionState; boardName: string; place: MiniPlace; onPlace: (place: MiniPlace) => void; todayCount: number }): React.ReactElement {
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const pending = useRef(false)
  const column = session.columns.find(c => c.id === 'inbox') ?? session.columns.find(c => !c.done)
  const stand = useMemo(() => {
    const open = session.visibleTasks.filter(task => !session.isDoneStatus(task.status))
    return { open: open.length, overdue: open.filter(task => dueBucket(task) === 'overdue').length, blocked: open.filter(task => isBlocked(task, session.store)).length }
  }, [session])
  const add = async (): Promise<void> => {
    const words = title.trim()
    if (!words || !column || pending.current) return
    pending.current = true
    setProblem(null)
    try {
      await session.createTask(words, column.id)
      setTitle('')
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure))
    } finally {
      pending.current = false
    }
  }
  return (
    <Bar>
      <h1>{boardName}</h1>
      <span className="stand">
        {stand.open} open{stand.overdue ? <> · <b>{stand.overdue} overdue</b></> : null}{stand.blocked ? ` · ${stand.blocked} blocked` : ''}
      </span>
      <Places aria-label="What to show">
        <Place type="button" $on={place === 'board'} aria-pressed={place === 'board'} onClick={() => onPlace('board')}>Board</Place>
        <Place type="button" $on={place === 'myDay'} aria-pressed={place === 'myDay'} onClick={() => onPlace('myDay')}>Today{todayCount ? ` ${todayCount}` : ''}</Place>
      </Places>
      <Capture onSubmit={event => { event.preventDefault(); void add() }} aria-label="Add a card">
        <Plus aria-hidden />
        <input aria-label={`Add a card to ${column?.label ?? 'the board'}`} placeholder={`Add a card to ${column?.label ?? 'the board'}, and press Enter`} value={title} onChange={event => setTitle(event.target.value)} />
        {problem ? <span className="said" role="alert">{problem}</span> : null}
        <button type="submit" disabled={!title.trim()}>Add</button>
      </Capture>
    </Bar>
  )
}
