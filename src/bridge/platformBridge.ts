import { bridge } from '@purescience/platform-ui/bridge/client'
import { PLATFORM_BRIDGE_METHODS } from '@purescience/platform-ui/bridge/methods'
import {
  listPlatformDocumentsByType,
  type PlatformDocumentListEntry,
} from '@purescience/platform-ui/bridge/documents'
import { TASK_PACKAGE_SUFFIX, TASKS_APP_SLUG } from '../constants'
import type {
  CatalogOpenRequest,
  PlatformAppSettingsUpdateRequest,
  PureTasksBootState,
  TaskBoardListEntry,
  TasksAppSettings,
} from '../types'

export { bridge }

export interface PersonSuggestion {
  name: string
  email?: string
  sourceAppSlug: string
  sourceLabel: string
  providerId: string
}

const STANDALONE_SETTINGS_KEY = 'purescience:puretasks:settings'

export function isStandaloneDevMode(): boolean {
  return import.meta.env.DEV && window.parent === window
}

function readStandaloneJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStandaloneJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export async function fetchTasksSettings(): Promise<TasksAppSettings> {
  if (isStandaloneDevMode()) {
    return readStandaloneJson<TasksAppSettings>(STANDALONE_SETTINGS_KEY, {})
  }

  return bridge.call<TasksAppSettings>(
    PLATFORM_BRIDGE_METHODS.SETTINGS_APP_GET,
    [TASKS_APP_SLUG],
  )
}

export async function updateTasksSettings(
  patch: Partial<TasksAppSettings>,
): Promise<TasksAppSettings> {
  if (isStandaloneDevMode()) {
    const nextSettings = {
      ...readStandaloneJson<TasksAppSettings>(STANDALONE_SETTINGS_KEY, {}),
      ...patch,
    }
    writeStandaloneJson(STANDALONE_SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  const request: PlatformAppSettingsUpdateRequest = {
    appSlug: TASKS_APP_SLUG,
    patch,
  }
  return bridge.call<TasksAppSettings>(
    PLATFORM_BRIDGE_METHODS.SETTINGS_APP_UPDATE,
    [request],
  )
}

export async function catalogOpen(request: CatalogOpenRequest): Promise<void> {
  if (isStandaloneDevMode()) {
    if (request.path) {
      window.open(request.path, '_blank', 'noopener,noreferrer')
    }
    return
  }

  await bridge.call(PLATFORM_BRIDGE_METHODS.CATALOG_OPEN, [request])
}

/** Find matching contacts in PurePeople through the shell bridge. */
export async function suggestPeople(
  query: string,
  limit = 6,
): Promise<PersonSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2 || isStandaloneDevMode()) return []
  try {
    const people = await bridge.call<PersonSuggestion[]>(
      PLATFORM_BRIDGE_METHODS.PEOPLE_SUGGEST,
      [{ query: trimmed, limit }],
    )
    return Array.isArray(people) ? people : []
  } catch {
    return []
  }
}

export async function readTextFile(path: string): Promise<string> {
  return bridge.call<string>(PLATFORM_BRIDGE_METHODS.FS_READ, [path])
}

/** Every `.tasks` board package the shell knows about (drafts included). */
export async function listTaskBoards(): Promise<TaskBoardListEntry[]> {
  if (isStandaloneDevMode()) return []
  const entries = await listPlatformDocumentsByType({
    suffixes: [TASK_PACKAGE_SUFFIX],
  })
  return entries.map((entry: PlatformDocumentListEntry) => ({
    path: entry.path,
    name: entry.name,
    isDraft: entry.isDraft,
  }))
}

/** Delete a `.tasks` board package — the same call the document switcher makes. */
export async function deleteTaskBoard(path: string): Promise<void> {
  await bridge.call(PLATFORM_BRIDGE_METHODS.FS_DELETE, [
    { path, recursive: true },
  ])
}

export async function fetchTasksBootState(): Promise<PureTasksBootState> {
  return { appSettings: await fetchTasksSettings() }
}

/* ── Missions: a card becomes a brief the shell runs ─────────────────────── */

/** Creates the mission in a project named after it; with autoStart it runs once planned. */
export async function createMission(request: { instructions: string; title: string; autoStart: boolean }): Promise<{ id: string }> {
  if (isStandaloneDevMode()) throw new Error('Missions run in PureDesktop, not the browser preview.')
  const mission = (await bridge.call(PLATFORM_BRIDGE_METHODS.MISSIONS_CREATE, [
    { instructions: request.instructions, title: request.title, autoStart: request.autoStart },
  ])) as { id?: unknown } | null
  if (!mission || typeof mission.id !== 'string') throw new Error('The shell did not return a mission.')
  return { id: mission.id }
}

export interface MissionStatusSummary {
  id: string
  title: string | null
  phase: 'planning' | 'planned' | 'running' | 'needsYou' | 'done' | 'failed' | 'stopped' | 'missing'
  stages: Array<{ title: string; state: string }>
}

export async function readMissionStatus(id: string): Promise<MissionStatusSummary> {
  return bridge.call<MissionStatusSummary>(PLATFORM_BRIDGE_METHODS.MISSIONS_STATUS, [id])
}

/** Opens the mission over the Desk; a finished mission opens on its report. */
export async function openMission(id: string): Promise<void> {
  await bridge.call(PLATFORM_BRIDGE_METHODS.MISSIONS_OPEN, [id])
}

/** Whether the shell offers missions to this app at all (older shells do not). */
export function missionsAvailable(methods: readonly string[]): boolean {
  return methods.includes(PLATFORM_BRIDGE_METHODS.MISSIONS_CREATE)
}
