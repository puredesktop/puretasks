import type { SuiteTask, TaskChecklist, TasksStore } from '../types'

/**
 * Two live copies of the app (a tab and a mini app) work on one board's file, each with the whole board in memory. A save
 * merges this copy's work with what is on disk now, against what the two last agreed on: only what changed on a side is
 * that side's to say, so a stale copy never undoes the other's work, and a card is gone only if the side that dropped it
 * had seen it. Card by card, then field by field; comments, steps and links item by item. When both changed one field,
 * the later edit stands.
 */

export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return (a ?? null) === (b ?? null)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as unknown[]
    return a.length === other.length && a.every((x, i) => same(x, other[i]))
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) if (!same(left[key], right[key])) return false
  return true
}

function mergeFields<T extends object>(base: T | undefined, mine: T, theirs: T, conflict: (key: keyof T, m: T[keyof T], t: T[keyof T], b: T[keyof T] | undefined) => T[keyof T]): T {
  const out = {} as Record<keyof T, unknown>
  for (const key of new Set([...Object.keys(mine), ...Object.keys(theirs)]) as Set<keyof T>) {
    const m = mine[key], t = theirs[key], b = base?.[key]
    const value = same(m, t) || same(t, b) ? m : same(m, b) ? t : conflict(key, m, t, b)
    if (value !== undefined) out[key] = value
  }
  return out as T
}

/** A list by id, in their order with what is new here after: each record whichever side changed it, added by either, removed by whichever removed what it had seen. */
function mergeById<T>(base: readonly T[], mine: readonly T[], theirs: readonly T[], idOf: (x: T) => string, mergeOne: (b: T | undefined, m: T, t: T) => T): T[] {
  const baseBy = new Map(base.map(x => [idOf(x), x]))
  const mineBy = new Map(mine.map(x => [idOf(x), x]))
  const theirsBy = new Map(theirs.map(x => [idOf(x), x]))
  const out: T[] = []
  for (const t of theirs) {
    const id = idOf(t), m = mineBy.get(id), b = baseBy.get(id)
    if (m) out.push(same(m, t) || same(t, b) ? m : same(m, b) ? t : mergeOne(b, m, t))
    else if (!b) out.push(t)
  }
  for (const m of mine) if (!theirsBy.has(idOf(m)) && !baseBy.has(idOf(m))) out.push(m)
  return out
}

/** A whole list whichever side changed it; both changed it, item by item (a reordering on one side is kept that way). */
function mergeList<T>(base: readonly T[] | undefined, mine: readonly T[] | undefined, theirs: readonly T[] | undefined, idOf: (x: T) => string, mergeOne: (b: T | undefined, m: T, t: T) => T): T[] {
  const b = base ?? [], m = mine ?? [], t = theirs ?? []
  if (same(m, t) || same(t, b)) return [...m]
  if (same(m, b)) return [...t]
  return mergeById(b, m, t, idOf, mergeOne)
}

const byId = (x: { id: string }): string => x.id
const newer = (a: string | undefined, b: string | undefined): boolean => (a ?? '') >= (b ?? '')
const stamped = <T extends { updatedAt?: string }>(b: T | undefined, m: T, t: T): T => mergeFields(b, m, t, (_k, x, y) => (newer(m.updatedAt, t.updatedAt) ? x : y))
const setMerge = (b: readonly string[] = [], m: readonly string[] = [], t: readonly string[] = []): string[] => {
  const gone = new Set(b.filter(x => !m.includes(x) || !t.includes(x)))
  return [...new Set([...t, ...m])].filter(x => !gone.has(x))
}

export function mergeTask(b: SuiteTask | undefined, m: SuiteTask, t: SuiteTask): SuiteTask {
  const mineIsNewer = newer(m.updatedAt, t.updatedAt)
  return {
    ...mergeFields(b, m, t, (_key, mv, tv) => (mineIsNewer ? mv : tv)),
    updatedAt: mineIsNewer ? m.updatedAt : t.updatedAt,
    labels: setMerge(b?.labels, m.labels, t.labels),
    blockedBy: setMerge(b?.blockedBy, m.blockedBy, t.blockedBy),
    links: mergeList(b?.links, m.links, t.links, byId, (bl, x, y) => mergeFields(bl, x, y, (_k, mv) => mv)),
    comments: mergeList(b?.comments, m.comments, t.comments, byId, stamped),
    missions: mergeList(b?.missions, m.missions, t.missions, byId, (bm, x, y) => mergeFields(bm, x, y, (_k, mv, tv) => (newer(x.checkedAt, y.checkedAt) ? mv : tv))),
    checklists: mergeList(b?.checklists, m.checklists, t.checklists, byId, (bc, x, y): TaskChecklist => ({
      ...stamped(bc, x, y),
      items: mergeList(bc?.items, x.items, y.items, byId, stamped),
    })),
  }
}

/** This copy's board and the one on disk, against what they last agreed on. The same object back when nothing here differs from `mine`. */
export function mergeBoard(base: TasksStore, mine: TasksStore, theirs: TasksStore): TasksStore {
  if (same(mine, theirs) || same(theirs, base)) return mine
  if (same(mine, base)) return theirs
  const project = stamped(base.projects[0], mine.projects[0]!, theirs.projects[0]!)
  return {
    ...theirs,
    projects: [project],
    columns: mergeList(base.columns, mine.columns, theirs.columns, byId, (b, m, t) => mergeFields(b, m, t, (_k, x) => x)),
    tasks: mergeById(base.tasks, mine.tasks, theirs.tasks, byId, mergeTask),
    activity: [...new Map([...theirs.activity, ...mine.activity].map(a => [a.id, a])).values()].sort((a, b) => b.at.localeCompare(a.at)),
    filterViews: mergeList(base.filterViews, mine.filterViews, theirs.filterViews, byId, stamped),
  }
}
