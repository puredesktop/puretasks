/**
 * Is this running copy of the app a second copy, held in a page?
 *
 * A mini app is a second live copy in an iframe, beside any normal tab of it. Work that must happen once, and sends for
 * an agent, belong to a normal tab, so they ask here first.
 *
 * Two ways of being held, and neither can be told from the other's signal:
 * - Inside the Executive room: the frame sits inside another app's frame, so it knows from its first line.
 * - On the Personal agent's page: the shell hosts the frame itself, exactly as it hosts a tab. Only the shell's answer
 *   says so, and it tells a copy that was opened before it was held.
 *
 * Once held, always held: growing to "Full app" is the same copy, and a normal tab may still be open.
 * A question not yet answered reads as held, so nothing goes on a guess.
 */
export interface AdjacentAnswer { heldInRoom?: boolean }

/** A shell that never answers must not leave a tab without its work for long. */
const ANSWER_WAIT_MS = 3_000

const nestedInAnotherApp = (): boolean => typeof window !== 'undefined' && window.parent !== window && window.parent !== window.top
const alone = (): boolean => typeof window === 'undefined' || window.parent === window

let held: boolean | null = alone() ? false : nestedInAnotherApp() ? true : null
let asking: Promise<boolean> | null = null

export const isHeldCopy = (): boolean => held !== false

/** The shell says so, whenever it does. */
export function heardHeld(): void { held = true }

/** Ask once, for the life of this copy. A shell too old to answer cannot hold apps, so no answer means a normal tab. */
export function findOutIfHeld(ask: () => Promise<AdjacentAnswer | null | undefined>, waitMs = ANSWER_WAIT_MS): Promise<boolean> {
  if (held !== null) return Promise.resolve(held)
  asking ??= new Promise<boolean>(resolve => {
    const settle = (answer: AdjacentAnswer | null | undefined): void => {
      window.clearTimeout(timer)
      held = held === true || answer?.heldInRoom === true
      resolve(held)
    }
    const timer = window.setTimeout(() => settle(null), waitMs)
    ask().then(settle, () => settle(null))
  })
  return asking
}

/** A message from the shell, from now on: a tab that is taken into a page. */
export function listenForHeld(): () => void {
  if (alone()) return () => undefined
  const receive = (event: MessageEvent): void => {
    if (event.source !== window.parent || event.data?.type !== 'pure:adjacent-app') return
    if ((event.data.app as { heldInRoom?: unknown } | null)?.heldInRoom === true) heardHeld()
  }
  window.addEventListener('message', receive)
  return () => window.removeEventListener('message', receive)
}

/** Tests only: each test is its own running copy. */
export function forgetHeldCopyForTest(): void {
  held = alone() ? false : null
  asking = null
}
/** Tests only: a copy still waiting for the shell's answer. */
export function heardNothingYet(): void { held = null }
