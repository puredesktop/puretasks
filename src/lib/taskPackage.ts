import {
  TASK_PACKAGE_CONTENT_FILE,
  TASK_PACKAGE_MANIFEST_FILE,
  TASK_PACKAGE_SUFFIX,
} from '../constants'
import { normalizeTasksStore, taskColumnsForStore } from './taskModel'
import type { TaskProject, TasksStore } from '../types'

/** A `.tasks` package holds exactly one board (one project + its data). */

export function taskPackageManifest(
  project: TaskProject,
  savedAt: string,
): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'purescience.tasks.board',
      appSlug: 'tasks',
      title: project.name,
      contentFile: TASK_PACKAGE_CONTENT_FILE,
      packageSuffix: TASK_PACKAGE_SUFFIX,
      savedAt,
    },
    null,
    2,
  )}\n`
}

export function taskPackageContent(
  store: TasksStore,
  project: TaskProject,
): string {
  const taskIds = new Set(
    store.tasks
      .filter(task => task.projectId === project.id)
      .map(task => task.id),
  )
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      currentProjectId: project.id,
      projects: [project],
      columns: taskColumnsForStore(store),
      tasks: store.tasks.filter(task => task.projectId === project.id),
      activity: store.activity.filter(item => taskIds.has(item.taskId)),
    },
    null,
    2,
  )}\n`
}

/** Package payload for the document lifecycle: manifest + board content. */
export function taskPackageFiles(
  store: TasksStore,
  project: TaskProject,
  savedAt: string,
): Array<{ name: string; content: string }> {
  return [
    { name: TASK_PACKAGE_MANIFEST_FILE, content: taskPackageManifest(project, savedAt) },
    { name: TASK_PACKAGE_CONTENT_FILE, content: taskPackageContent(store, project) },
  ]
}

/** Parse a `.tasks` package's content file into a single-board store. */
export function parseTaskPackageStore(
  raw: string,
  now = new Date().toISOString(),
): TasksStore {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      !Array.isArray(parsed.projects) || parsed.projects.length !== 1 ||
      !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid task board: expected exactly one project and a tasks array.')
  }
  if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported task board schema version: ${String(parsed.schemaVersion)}`)
  }
  const project = parsed.projects[0]
  if (!project || typeof project.id !== 'string' || typeof project.name !== 'string') {
    throw new Error('Invalid task board project.')
  }
  return normalizeTasksStore(parsed, now)
}
