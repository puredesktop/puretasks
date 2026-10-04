import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listTaskBoards } from '../bridge/platformBridge'
import { mapConcurrent } from '../lib/mapConcurrent'
import type { TaskBoardListEntry, TasksStore } from '../types'

export interface BoardIndexEntry extends TaskBoardListEntry {
  /** The board's content, once read; null while loading or unreadable. */
  store: TasksStore | null
  error?: string
}

/** Other boards come from storage; the open board always comes from its live session. */
export function useBoardsIndex({ readBoard, openPath, openStore, enabled }: {
  readBoard: (path: string) => Promise<TasksStore>
  openPath: string | null
  openStore: TasksStore
  enabled: boolean
}): { boards: BoardIndexEntry[]; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const [entries, setEntries] = useState<BoardIndexEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const active = useRef(enabled)
  const pending = useRef<{ generation: number; promise: Promise<void> } | null>(null)
  const live = useRef({ openPath, openStore })
  live.current = { openPath, openStore }

  const refresh = useCallback((): Promise<void> => {
    if (!enabled || !active.current) return Promise.resolve()
    const mine = generation.current
    if (pending.current?.generation === mine) return pending.current.promise
    const isCurrent = () => mine === generation.current
    setLoading(true)
    const promise = (async () => {
      try {
        const list = await listTaskBoards()
        if (!isCurrent()) return
        const read = await mapConcurrent(list, async entry => {
          const clean = entry.path.replace(/\/+$/, '')
          if (clean === live.current.openPath?.replace(/\/+$/, '')) {
            return { ...entry, path: clean, store: live.current.openStore }
          }
          try {
            return { ...entry, path: clean, store: await readBoard(clean) }
          } catch (failure) {
            return { ...entry, path: clean, store: null, error: failure instanceof Error ? failure.message : String(failure) }
          }
        }, isCurrent)
        if (isCurrent()) { setEntries(read); setError(null) }
      } catch (failure) {
        // Keep the previous usable index and offer retry; background scans never reject.
        if (isCurrent()) setError(failure instanceof Error ? failure.message : String(failure))
      } finally {
        if (isCurrent()) { setLoading(false); pending.current = null }
      }
    })()
    pending.current = { generation: mine, promise }
    return promise
  }, [enabled, readBoard])

  useEffect(() => {
    active.current = enabled
    if (!enabled) { setLoading(false); setError(null); return }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    return () => { clearInterval(timer); active.current = false; generation.current += 1 }
  }, [enabled, openPath, refresh])

  const boards = useMemo(() => {
    const clean = openPath?.replace(/\/+$/, '') ?? null
    const merged = (enabled ? entries : []).map(entry => (entry.path === clean
      ? { ...entry, store: openStore, error: undefined, name: openStore.projects[0]?.name ?? entry.name }
      : entry))
    if (clean && !merged.some(entry => entry.path === clean)) {
      merged.unshift({ path: clean, name: openStore.projects[0]?.name ?? 'Untitled board', isDraft: false, store: openStore })
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name))
  }, [enabled, entries, openPath, openStore])

  return { boards, loading, error, refresh }
}
