import type { BoardIndexEntry } from '../../hooks/useBoardsIndex'
import { dueBucket, isBlocked } from '../../lib/taskModel'
import { hueOf } from './cardBits'
import { Avatar, BoardCard, Kicker, Meta, Pill, PlaceTitle, Progress } from './glassStyles'
import { ownerInitials } from '../puretasksFormat'

export const BOARD_TEMPLATES: ReadonlyArray<{ id: string; label: string; detail: string; columns: Array<{ id: string; label: string; done?: boolean; wipLimit?: number }> }> = [
  { id: 'kanban', label: 'Kanban', detail: 'Inbox · Next · Doing (3) · Review · Done', columns: [{ id: 'inbox', label: 'Inbox' }, { id: 'next', label: 'Next' }, { id: 'doing', label: 'Doing', wipLimit: 3 }, { id: 'review', label: 'Review' }, { id: 'done', label: 'Done', done: true }] },
  { id: 'sprint', label: 'Sprint', detail: 'Backlog · This sprint · Doing (4) · Done', columns: [{ id: 'inbox', label: 'Backlog' }, { id: 'sprint', label: 'This sprint' }, { id: 'doing', label: 'Doing', wipLimit: 4 }, { id: 'done', label: 'Done', done: true }] },
  { id: 'editorial', label: 'Editorial', detail: 'Idea · Draft · Edit · Typeset · Published', columns: [{ id: 'inbox', label: 'Idea' }, { id: 'doing', label: 'Draft' }, { id: 'edit', label: 'Edit' }, { id: 'review', label: 'Typeset' }, { id: 'done', label: 'Published', done: true }] },
  { id: 'personal', label: 'Personal', detail: 'Today · This week · Someday · Done', columns: [{ id: 'doing', label: 'Today' }, { id: 'inbox', label: 'This week' }, { id: 'review', label: 'Someday' }, { id: 'done', label: 'Done', done: true }] },
]

/** Every board on this Mac as a glass card with its numbers, and the templates a new one starts from. */
export function BoardsHome({ boards, openPath, loading, onOpenBoard, onNewBoard }: {
  boards: BoardIndexEntry[]
  openPath: string | null
  loading: boolean
  onOpenBoard: (path: string) => void
  onNewBoard: (template: (typeof BOARD_TEMPLATES)[number]) => void
}): React.ReactElement {
  const totals = boards.reduce((acc, board) => {
    const store = board.store
    if (!store) return acc
    const doneIds = new Set((store.columns ?? []).filter(column => column.done).map(column => column.id))
    const open = store.tasks.filter(task => !task.archivedAt && !doneIds.has(task.status))
    return { open: acc.open + open.length, done: acc.done + store.tasks.filter(task => doneIds.has(task.status) && !task.archivedAt && Date.parse(task.completedAt ?? task.updatedAt) > Date.now() - 7 * 86_400_000).length }
  }, { open: 0, done: 0 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 8, paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}><div><Kicker>Every .tasks board on this Mac</Kicker><PlaceTitle>Boards</PlaceTitle></div><span style={{ flex: 1 }} /><Meta>{boards.length} board{boards.length === 1 ? '' : 's'} · {totals.open} open · {totals.done} done this week{loading ? ' · reading…' : ''}</Meta></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {boards.map(board => {
          const store = board.store
          const doneIds = new Set((store?.columns ?? []).filter(column => column.done).map(column => column.id))
          const live = (store?.tasks ?? []).filter(task => !task.archivedAt)
          const open = live.filter(task => !doneIds.has(task.status))
          const done = live.length - open.length
          const doing = open.filter(task => task.status === 'doing').length
          const review = open.filter(task => task.status === 'review').length
          const overdue = open.filter(task => dueBucket(task) === 'overdue').length
          const blocked = store ? open.filter(task => isBlocked(task, store)).length : 0
          const people = Array.from(new Set(live.map(task => task.ownerName?.trim()).filter((name): name is string => Boolean(name)))).slice(0, 5)
          const edited = store ? Math.max(...live.map(task => Date.parse(task.updatedAt)), Date.parse(store.projects[0]?.updatedAt ?? '')) : NaN
          return (
            <BoardCard key={board.path} type="button" onClick={() => onOpenBoard(board.path)} aria-current={board.path === openPath ? 'true' : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: `oklch(0.55 0.12 ${hueOf(board.name)})`, flexShrink: 0 }} /><h3 style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</h3><span style={{ marginLeft: 'auto', fontFamily: 'var(--tasks-mono)', fontSize: 10.5, color: 'var(--tasks-muted)', whiteSpace: 'nowrap' }}>{board.isDraft ? 'draft' : Number.isFinite(edited) ? `edited ${new Date(edited).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}</span></div>
              {store?.projects[0]?.description ? <Meta style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{store.projects[0].description}</Meta> : board.error ? <Meta style={{ color: 'var(--tasks-bad-ink)' }}>Could not read: {board.error}</Meta> : null}
              {store ? (
                <>
                  <div className="stat"><span><b>{doing}</b>doing</span><span><b>{review}</b>review</span><span><b style={overdue ? { color: 'var(--tasks-bad-ink)' } : undefined}>{overdue}</b>overdue</span><span><b>{blocked}</b>blocked</span><span style={{ marginLeft: 'auto' }}><b>{done}</b>done</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Progress $value={live.length ? (done / live.length) * 100 : 0} />
                    <div style={{ display: 'flex' }}>{people.map(name => <Avatar key={name} $hue={hueOf(name)} $size={22} title={name} style={{ marginLeft: -6, border: '2px solid var(--tasks-card)' }}>{ownerInitials(name)}</Avatar>)}</div>
                  </div>
                </>
              ) : null}
            </BoardCard>
          )
        })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 18px', borderRadius: 16, border: '1px dashed var(--tasks-edge-strong)' }}>
          <strong style={{ fontSize: 13 }}>New board from a template</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {BOARD_TEMPLATES.map(template => (
              <Pill key={template.id} type="button" onClick={() => onNewBoard(template)} style={{ height: 'auto', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px', borderRadius: 10, whiteSpace: 'normal', textAlign: 'left' }}><strong>{template.label}</strong><span style={{ fontSize: 11, fontWeight: 400, color: 'var(--tasks-muted)', lineHeight: 1.4 }}>{template.detail}</span></Pill>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
