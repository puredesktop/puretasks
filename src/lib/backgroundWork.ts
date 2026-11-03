import { leasePort } from '../bridge/platformBridge'
import { isHeldCopy } from './heldCopy'
import { createKeeper } from './keeperLease'

let keeper: ReturnType<typeof createKeeper> | null = null
/** Whether this copy of the app is the one keeping background work going: a tab, or a held copy when there is no tab. */
export const mayKeep = (): Promise<boolean> => (keeper ??= createKeeper(leasePort('tasks-keeper.json'), { isHeld: isHeldCopy }))()
