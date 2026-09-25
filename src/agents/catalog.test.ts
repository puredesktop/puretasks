import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PURETASKS_AGENT_TOOL_NAMES } from './catalog'

describe('PureTasks agent catalog', () => {
  it('matches plugin.json tool declarations', () => {
    const manifest = JSON.parse(readFileSync('plugin.json', 'utf8')) as {
      app: { agents: { tools: Array<{ name: string }> } }
    }

    expect(manifest.app.agents.tools.map(tool => tool.name)).toEqual([
      ...PURETASKS_AGENT_TOOL_NAMES,
    ])
  })
})
