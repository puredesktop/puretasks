import type { TasksAppearance } from '../types'

/**
 * The two looks, Glass and Solid, belong to the shell: it keeps the choice
 * per app, applies the system's reduced-transparency setting, and stamps
 * `data-platform-appearance` on this frame's document. The switch lives in
 * the shared header of every app, so PureTasks keeps no setting of its own.
 *
 * Until the shell has spoken (an older shell, or the first paint before the
 * theme arrives) the board is Solid: it is mostly chrome, and frosted chrome
 * over the desk reads as noise.
 */
export function resolveAppearance(
  shellAppearance: string | undefined,
  reducedTransparency: boolean,
): TasksAppearance {
  if (reducedTransparency) return 'solid'
  if (shellAppearance === 'glass' || shellAppearance === 'solid') return shellAppearance
  return 'solid'
}

/** Whether the system currently asks for reduced transparency. */
export function systemReducesTransparency(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  } catch {
    return false
  }
}
