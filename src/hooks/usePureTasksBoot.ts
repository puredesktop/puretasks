import { useCallback, useEffect, useState } from 'react'
import { fetchTasksBootState } from '../bridge/platformBridge'
import type { PureTasksBootState } from '../types'

interface UsePureTasksBootResult {
  boot: PureTasksBootState | null
  bootError: Error | null
  booting: boolean
  reloadBoot: () => void
}

export function usePureTasksBoot(ready: boolean): UsePureTasksBootResult {
  const [boot, setBoot] = useState<PureTasksBootState | null>(null)
  const [bootError, setBootError] = useState<Error | null>(null)
  const [booting, setBooting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reloadBoot = useCallback(() => {
    setReloadToken(current => current + 1)
  }, [])

  useEffect(() => {
    if (!ready) return

    let cancelled = false

    async function load(): Promise<void> {
      setBooting(true)
      setBootError(null)
      try {
        const nextBoot = await fetchTasksBootState()
        if (cancelled) return
        setBoot(nextBoot)
      } catch (error) {
        if (cancelled) return
        setBoot(null)
        setBootError(error instanceof Error ? error : new Error(String(error)))
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [ready, reloadToken])

  return { boot, bootError, booting, reloadBoot }
}
