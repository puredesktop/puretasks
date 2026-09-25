import type { BoardIndexEntry } from '../../hooks/useBoardsIndex'
import type { TasksPlace } from '../../types'
import { hueOf } from './cardBits'
import { Rail, RailDot, RailGroup, RailRow } from './glassStyles'

export function TasksRail({
  place,
  boards,
  openPath,
  counts,
  onPlace,
  onOpenBoard,
}: {
  place: TasksPlace
  boards: BoardIndexEntry[]
  openPath: string | null
  counts: { myDay: number; upcoming: number; unfiled: number }
  onPlace: (place: TasksPlace) => void
  onOpenBoard: (path: string) => void
}): React.ReactElement {
  return (
    <Rail aria-label="Boards and places">
      <RailRow type="button" $on={place === 'myDay'} onClick={() => onPlace('myDay')}><RailDot /><span className="name">My day</span><small>{counts.myDay}</small></RailRow>
      <RailRow type="button" $on={place === 'upcoming'} onClick={() => onPlace('upcoming')}><RailDot $color="var(--pure-attention)" /><span className="name">Upcoming</span><small>{counts.upcoming}</small></RailRow>
      <RailGroup>Boards</RailGroup>
      {boards.map(board => {
        const open = board.store ? board.store.tasks.filter(task => !task.archivedAt && !board.store!.columns?.find(column => column.id === task.status)?.done).length : null
        return (
          <RailRow key={board.path} type="button" $on={place === 'board' && board.path === openPath} onClick={() => onOpenBoard(board.path)} title={board.path}>
            <RailDot $color={`oklch(0.55 0.12 ${hueOf(board.name)})`} /><span className="name">{board.name}{board.isDraft ? ' · draft' : ''}</span>{open !== null ? <small>{open}</small> : null}
          </RailRow>
        )
      })}
      <RailRow type="button" $on={place === 'boards'} onClick={() => onPlace('boards')} style={{ color: 'var(--tasks-muted)' }}><span className="name">All boards →</span></RailRow>
    </Rail>
  )
}
