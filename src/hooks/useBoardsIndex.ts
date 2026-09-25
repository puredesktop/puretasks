import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listTaskBoards } from '../bridge/platformBridge'
import type { TaskBoardListEntry, TasksStore } from '../types'

export interface BoardIndexEntry extends TaskBoardListEntry {
  /** The board's content, once read; null while loading or unreadable. */
  store: TasksStore | null
  error?: string
}

/**
 * Every `.tasks` board the shell knows, with contents, for the rail and the
 * cross-board places (My day, Upcoming, Boards). The open board is served
 * from the live session, not from disk, so its counts are never stale.
 */
export function useBoardsIndex({
  readBoard,
  openPath,
  openStore,
  enabled,
}: {
  readBoard: (path: string) => Promise<TasksStore>
  openPath: string | null
  openStore: TasksStore
  enabled: boolean
}): { boards: BoardIndexEntry[]; loading: boolean; refresh: () => Promise<void> } {
  const [entries, setEntries] = useState<BoardIndexEntry[]>([])
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)

  const refresh = useCallback(async () => {
    if (!enabled) return
    const mine = ++generation.current
    setLoading(true)
    try {
      const list = await listTaskBoards()
      const read = await Promise.all(
        list.map(async entry => {
          const clean = entry.path.replace(/\/+$/, '')
          try {
            return { ...entry, path: clean, store: await readBoard(clean) } as BoardIndexEntry
          } catch (error) {
            return { ...entry, path: clean, store: null, error: error instanceof Error ? error.message : String(error) } as BoardIndexEntry
          }
        }),
      )
      if (mine === generation.current) setEntries(read)
    } finally {
      if (mine === generation.current) setLoading(false)
    }
  }, [enabled, readBoard])

  useEffect(() => { void refresh() }, [refresh])
  // Another app or a mission may write a board while this one is open: re-read every so often.
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => { void refresh() }, 60_000)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  const boards = useMemo(() => {
    const clean = openPath?.replace(/\/+$/, '') ?? null
    const merged = entries.map(entry => (entry.path === clean ? { ...entry, store: openStore, name: openStore.projects[0]?.name ?? entry.name } : entry))
    if (clean && !merged.some(entry => entry.path === clean)) {
      merged.unshift({ path: clean, name: openStore.projects[0]?.name ?? 'Untitled board', isDraft: false, store: openStore })
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, openPath, openStore])

  return { boards, loading, refresh }
}
