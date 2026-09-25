import { readAgentToolStringArg } from '@purescience/platform-ui/bridge/agentToolHelpers'
import { AgentTasksToolError } from '../../lib/agentReadTools'
import type { AgentMutationResult } from '../../lib/agentWriteTools'
import type { TasksStore } from '../../types'
import type { TasksAgentToolContext } from '../context'

export function requiredString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = readAgentToolStringArg(args, key)
  if (!value) throw new AgentTasksToolError(`${key} is required.`)
  return value
}

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  return readAgentToolStringArg(args, key) ?? undefined
}

export function optionalBoolean(
  args: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = args[key]
  return typeof value === 'boolean' ? value : undefined
}

export function optionalNumber(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AgentTasksToolError(`${key} must be a number.`)
  }
  return value
}

/** A field that may be cleared: absent → undefined (preserve), null → null (clear). */
export function optionalNumberOrNull(
  args: Record<string, unknown>,
  key: string,
): number | null | undefined {
  if (args[key] === null) return null
  return optionalNumber(args, key)
}

export function optionalStringOrNull(
  args: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (args[key] === null) return null
  return optionalString(args, key)
}

export function requiredObject<T extends Record<string, unknown>>(
  args: Record<string, unknown>,
  key: string,
): T {
  const value = args[key]
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentTasksToolError(`${key} must be an object.`)
  }
  return value as T
}

export function optionalStringArray(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new AgentTasksToolError(`${key} must be an array of strings.`)
  }
  return value.map(item => item.trim()).filter(Boolean)
}

export function optionalObjectArray<T extends Record<string, unknown>>(
  args: Record<string, unknown>,
  key: string,
): T[] | undefined {
  const value = args[key]
  if (value === undefined) return undefined
  if (
    !Array.isArray(value) ||
    !value.every(item => item && typeof item === 'object')
  ) {
    throw new AgentTasksToolError(`${key} must be an array of objects.`)
  }
  return value as T[]
}

/**
 * Run a pure mutation against the live store and persist its result in one
 * step. The mutation executes inside the session's producer, so argument
 * errors surface before anything changes and concurrent tool calls compose.
 */
export async function persistAgentMutation<T>(
  context: TasksAgentToolContext,
  mutate: (store: TasksStore) => AgentMutationResult<T>,
): Promise<T> {
  let result: T | undefined
  await context.applyStoreUpdate(store => {
    const mutation = mutate(store)
    result = mutation.result
    return mutation.store
  })
  return result as T
}
