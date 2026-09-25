import { usePlatformThemeDocumentAttrs } from '@purescience/platform-ui/bridge/react/usePlatformThemeDocumentAttrs'
import { resolveAppearance, systemReducesTransparency } from '../lib/appearance'
import type { TasksAppearance } from '../types'

/**
 * The look the shell has chosen for this app, live: it changes when the
 * person flips the switch in the shared header, and when the system's
 * transparency setting changes.
 */
export function useAppearance(): TasksAppearance {
  const attrs = usePlatformThemeDocumentAttrs()
  return resolveAppearance(attrs.appearance, systemReducesTransparency())
}
