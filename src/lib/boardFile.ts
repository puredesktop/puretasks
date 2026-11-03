import type { TasksStore } from '../types'
import { parseTaskPackageStore } from './taskPackage'

/**
 * What a copy of the app does with its board's file. This is how a copy has always saved: the whole file from its own
 * memory. Two-copy tests run against it.
 */
export interface BoardFilePort {
  read(): Promise<string | null>
  /** Replaces the file, unless its revision is no longer `expected`: then it throws, and nothing is written. */
  write(store: TasksStore, revision: string, expected: string | null): Promise<void>
}

export class BoardFile {
  private text: string | null = null
  constructor(private readonly board: { readStore(): TasksStore; takeIn(next: TasksStore): void }, private readonly port: BoardFilePort) {}

  opened(text: string | null): void { this.text = text }

  async save(): Promise<void> {
    // unconditional, as it is today: whatever revision is there is written over
    const now = await this.port.read()
    await this.port.write(this.board.readStore(), crypto.randomUUID(), now ? ((JSON.parse(now) as { revision?: string }).revision ?? null) : null)
  }

  async pickUp(): Promise<void> {
    const text = await this.port.read()
    if (!text || text === this.text) return
    this.text = text
    this.board.takeIn(parseTaskPackageStore(text))
  }
}
