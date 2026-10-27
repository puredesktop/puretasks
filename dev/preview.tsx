/** Development-only storage adapter. Runs the real App and document lifecycle in an iframe. */
import { createRoot } from 'react-dom/client'
import { bridge as modernBridge } from '@purescience/platform-bridge/client'
import { bridge } from '@purescience/platform-ui/bridge/client'
import { applyThemeFromHost } from '@purescience/platform-ui/bridge/applyThemeFromHost'
import { lightTheme } from '@purescience/platform-ui/theme/themes/light'
import { themeToRootCssBlock } from '@purescience/platform-ui/theme/utils/cssVariables'
import { App } from '../src/App'
import { createTask, starterBoardStore } from '../src/lib/taskModel'
import { taskPackageFiles } from '../src/lib/taskPackage'
import { todayKey } from '../src/lib/workQueue'
import manifest from '../plugin.json'

const key = 'puretasks-experience-preview'
const disk = new Map<string, string>(), entries = new Map<string, any>()
function put(path: string, files: { name: string; content: string }[]) {
  for (const file of files) disk.set(`${path}/${file.name}`, file.content)
  const info = JSON.parse(disk.get(`${path}/manifest.json`)!)
  entries.set(path, { path, name: info.title, mtimeMs: Date.now(), isDraft: false })
}
function seed(name: string, tasks: Array<{ title: string; status: string; notes?: string; dueAt?: string; ownerName?: string; labels?: string[]; comment?: string }>) {
  const store = starterBoardStore(name)
  store.tasks = tasks.map(({ comment, ...details }) => {
    const task = { ...createTask(store.projects[0].id, details.title, details.status), ...details }
    if (comment) task.comments = [{ id: crypto.randomUUID(), authorName: 'Alex', text: comment, createdAt: task.createdAt, updatedAt: task.updatedAt }]
    return task
  })
  put(`/preview/${name}.tasks`, taskPackageFiles(store, store.projects[0], new Date().toISOString()))
  return store
}
const today = todayKey(), tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
const project = seed('Community workshop', [
  { title: 'Find a local print shop', status: 'inbox', labels: ['Supplies'] },
  { title: 'Ask the library about extra tables', status: 'inbox' },
  { title: 'Prepare the materials list', status: 'doing', ownerName: 'Alex', dueAt: today, notes: 'Enough materials for twelve people. Keep the total under £150.', labels: ['Supplies'] },
  { title: 'Check the workshop poster', status: 'review', notes: 'A4 poster with the date, venue and booking details. It should be readable from across the room.', comment: 'Poster is ready. I checked the date and contact details; please check the accessibility wording before we print.', labels: ['Promotion'] },
  { title: 'Confirm the room booking', status: 'done' },
])
seed('Home & garden', [
  { title: 'Buy paint for the hallway', status: 'inbox' },
  { title: 'Repair the garden gate', status: 'doing', notes: 'Replace the loose hinge and check the latch.' },
  { title: 'Check the planting plan', status: 'review', notes: 'Leave enough space for a wheelbarrow between the beds.', comment: 'The plan leaves a one-metre path. All plants are labelled with their mature size.' },
  { title: 'Book the annual boiler service', status: 'inbox', dueAt: todayKey(tomorrow) },
])
let settings: any = { place: 'board', railOpen: true, lastBoardPath: '/preview/Community workshop.tasks', myDay: { [today]: [`/preview/Community workshop.tasks#${project.tasks[2].id}`] } }
try { const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (saved) { disk.clear(); entries.clear(); for (const item of saved.disk) disk.set(...item as [string, string]); for (const item of saved.entries) entries.set(...item as [string, any]); settings = saved.settings } } catch { /* Start with examples. */ }
const persist = () => sessionStorage.setItem(key, JSON.stringify({ disk: [...disk], entries: [...entries], settings }))
const listeners = new Map<string, Set<(payload: any) => void>>()
const emit = (name: string, payload: any) => listeners.get(name)?.forEach(fn => fn(payload))
const meta: any = { version: 1, pluginId: 'tasks', appSlug: 'tasks', methods: [], app: { root: '/preview', manifest, settings, config: { enabled: true } }, viewport: { tabId: 'preview', sessionId: null, resource: null } }
function notice(message: string) { alert(`${message}\nThis preview uses fictional data. No external app is connected.`) }
async function call(method: string, args: any[] = []) {
  const a = args[0]
  switch (method) {
    case 'fs.read': if (!disk.has(a)) throw new Error('Example not found'); return disk.get(a)
    case 'documents.list': return [...entries.values()]
    case 'documents.recents.list': return []
    case 'documents.recents.touch': return undefined
    case 'documents.autosave': put(a.path, a.files); persist(); return { savedAt: new Date().toISOString() }
    case 'documents.createDraft': {
      const path = `/preview/${a.title || 'New board'}-${crypto.randomUUID().slice(0, 5)}${a.suffix}`
      put(path, a.files); persist(); emit('documents.changed', { kind: 'create', path }); return { path }
    }
    case 'workspace.updateCurrentTab': meta.viewport = { ...meta.viewport, resource: a.resource }; emit('viewport.changed', meta.viewport); return { ok: true }
    case 'settings.app.get': return settings
    case 'settings.app.update': settings = { ...settings, ...a.patch }; meta.app.settings = settings; persist(); return settings
    case 'agents.tools.register': return { ok: true, tools: a.tools }
    case 'agents.tools.unregister': return { ok: true }
    case 'people.suggest': return []
    case 'apps.list': case 'apps.data.list': return []
    case 'catalog.open': notice(`Open linked work: ${a.name ?? a.path}`); return { ok: true }
    default: throw new Error(`Not connected in preview: ${method}`)
  }
}
for (const client of [bridge, modernBridge]) {
  client.waitForReady = async () => meta
  client.call = call as typeof client.call
  client.onEvent = ((name: string, fn: (payload: any) => void) => { const set = listeners.get(name) ?? new Set(); listeners.set(name, set); set.add(fn); return () => set.delete(fn) }) as typeof client.onEvent
}
modernBridge.getMeta = () => meta
bridge.getMethods = () => []
applyThemeFromHost({ mode: 'light', css: themeToRootCssBlock(lightTheme) })
document.documentElement.dataset.platformAppearance = 'solid'
createRoot(document.getElementById('root')!).render(<App />)
