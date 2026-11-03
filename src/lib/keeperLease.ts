/** A small file in the shell's conditional JSON store. */
export interface LeasePort {
  read(): Promise<{ value: unknown; version: string | null }>
  write(value: unknown, ifMatch: string | null): Promise<{ ok: boolean; version: string | null }>
}

/**
 * Who keeps the board's background work going (polling live assignments, which adds a line to the board when one finishes).
 * One copy holds this at a time, in the shell's conditional JSON store, and renews it as it works. A tab takes it from a
 * held copy, because a tab is the place for it; a held copy takes it only when no one has it, so the work still moves with
 * only the mini app open. A copy that goes away is replaced when its hold runs out.
 */
export interface KeeperOptions {
  id?: string
  holdMs?: number
  isHeld: () => boolean
  now?: () => number
}

interface Hold { holder: string; until: number; held: boolean }

export function createKeeper(port: LeasePort, options: KeeperOptions) {
  const id = options.id ?? crypto.randomUUID()
  const holdMs = options.holdMs ?? 90_000
  const now = options.now ?? (() => Date.now())
  /** Until when this copy already knows the answer, so a look after each change costs nothing. */
  let known: { yes: boolean; until: number } = { yes: false, until: 0 }

  return async function mayKeep(): Promise<boolean> {
    const at = now()
    if (known.until > at) return known.yes
    const remember = (yes: boolean, forMs: number): boolean => { known = { yes, until: at + forMs }; return yes }
    try {
      const { value, version } = await port.read()
      const hold = value as Partial<Hold> | null
      const live = typeof hold?.until === 'number' && hold.until > at && typeof hold.holder === 'string'
      // someone else is at it: look again in a while, sooner than their hold ends in case they went away
      if (live && hold.holder !== id && !(hold.held === true && !options.isHeld())) return remember(false, Math.min(holdMs / 3, (hold.until as number) - at))
      const written = await port.write({ holder: id, until: at + holdMs, held: options.isHeld() } satisfies Hold, version)
      return written.ok ? remember(true, holdMs / 3) : remember(false, holdMs / 3)
    } catch {
      // the store cannot be reached: a tab carries on as it always has; a held copy leaves it
      return remember(!options.isHeld(), holdMs / 3)
    }
  }
}

