/** What another app gave for `/send-to tasks`, as task titles: a meeting's actions with who and by when, or words, a line each. */
export function titlesTaken(text: string): string[] {
  let given: { kind?: unknown; text?: unknown; items?: unknown }
  try {
    given = JSON.parse(text) as typeof given
  } catch {
    return []
  }
  if (Array.isArray(given.items)) {
    return given.items.flatMap(item => {
      const { title, owner, due } = (item ?? {}) as { title?: unknown; owner?: unknown; due?: unknown }
      if (typeof title !== 'string' || !title.trim()) return []
      const by = [typeof owner === 'string' ? owner.trim() : '', typeof due === 'string' && due.trim() ? `by ${due.trim()}` : ''].filter(Boolean).join(' ')
      return [by ? `${title.trim()} (${by})` : title.trim()]
    })
  }
  return typeof given.text === 'string' ? given.text.split(/\n+/).map(line => line.replace(/^\s*[-*•\d.]+\s+/, '').trim()).filter(Boolean) : []
}
