import type { TasksStore } from '../types'
import { mergeBoard, same } from './boardMerge'
import { parseTaskPackageStore, taskPackageContent } from './taskPackage'

/**
 * What this copy of the app does with its board's file, given that another copy may be working on it too (a tab and a
 * mini app, each with the whole board in memory).
 *
 * A save reads the file, merges this copy's work with it against what the two last agreed on (boardMerge.ts), shows the
 * result and writes it only if the file is still what it read: the document service checks the revision at the write, so
 * of two copies saving at once one is refused and goes round again with the other's work in it. A save with nothing to
 * say writes nothing. A look takes in what is new and keeps what this copy has not saved yet.
 */
export interface BoardFilePort {
  read(): Promise<string | null>
  /** Replaces the file, unless its revision is no longer `expected`: then it throws, and nothing is written. */
  write(store: TasksStore, revision: string, expected: string | null): Promise<void>
}

const isSaveConflict = (e: unknown): boolean => /save conflict/i.test(e instanceof Error ? e.message : String(e))
const revisionOf = (text: string | null): string | null => (text ? ((JSON.parse(text) as { revision?: string | null }).revision ?? null) : null)
/** A board as it comes back from its file, so a saved board and a read one compare alike. */
const asSaved = (store: TasksStore): TasksStore => (store.projects[0] ? parseTaskPackageStore(taskPackageContent(store, store.projects[0]), store.projects[0].updatedAt) : store)
const TRIES = 6

export class BoardFile {
  /** What this copy and the file last agreed on. */
  private agreed: TasksStore | null = null
  /** The file's revision then. */
  revision: string | null = null
  private lastText: string | null = null
  private turn: Promise<unknown> = Promise.resolve()

  constructor(private readonly board: { readStore(): TasksStore; takeIn(next: TasksStore): void }, private readonly port: BoardFilePort) {}

  /** The board as opened from this text; null for a new board with no file yet. */
  opened(text: string | null): void {
    this.lastText = text
    this.agreed = text ? parseTaskPackageStore(text) : null
    this.revision = revisionOf(text)
  }

  /** A write that did not come through save(): a new draft, or the app's last-chance save as a tab closes. */
  wrote(store: TasksStore, revision: string | null): void {
    this.agreed = asSaved(store)
    this.revision = revision
    this.lastText = null
  }

  get unsaved(): boolean { return !this.agreed || !same(asSaved(this.board.readStore()), this.agreed) }

  private takeIn(text: string): TasksStore {
    const theirs = parseTaskPackageStore(text)
    const mine = this.board.readStore()
    const merged = mergeBoard(this.agreed ?? theirs, mine, theirs)
    this.agreed = theirs
    this.revision = revisionOf(text)
    this.lastText = text
    if (merged !== mine) this.board.takeIn(merged)
    return merged
  }

  save(): Promise<void> {
    return this.inTurn(async () => {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const text = await this.port.read()
        // an unreadable file is not written over: this throws, and what is here waits for the next save
        const merged = text ? this.takeIn(text) : this.board.readStore()
        if (this.agreed && same(asSaved(merged), this.agreed)) return
        const revision = crypto.randomUUID()
        try {
          await this.port.write(merged, revision, this.revision)
          this.agreed = asSaved(merged)
          this.revision = revision
          this.lastText = null
          return
        } catch (e) {
          if (!isSaveConflict(e)) throw e
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30 * (attempt + 1)))
        }
      }
      throw new Error('Another window kept saving, so this change is not saved yet. It is still here and will save next time.')
    })
  }

  pickUp(): Promise<void> {
    return this.inTurn(async () => {
      const text = await this.port.read()
      if (!text || text === this.lastText) return
      try { this.takeIn(text) } catch { /* half written or not a board: keep what we have, look again next time */ }
    })
  }

  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const run = this.turn.then(work, work)
    this.turn = run.catch(() => undefined)
    return run
  }
}
