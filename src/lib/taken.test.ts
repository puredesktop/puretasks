import { describe, expect, it } from 'vitest'
import { titlesTaken } from './taken'

describe('titlesTaken', () => {
  it('a meeting’s actions keep who and by when', () => {
    expect(titlesTaken(JSON.stringify({ kind: 'actions', items: [{ title: 'Call Dana', owner: 'Sam', due: 'Fri' }, { title: 'Send pack' }, { title: ' ' }] }))).toEqual(['Call Dana (Sam by Fri)', 'Send pack'])
  })
  it('words make a task a line, without their bullets', () => {
    expect(titlesTaken(JSON.stringify({ kind: 'text', text: '- First\n\n2. Second\nThird' }))).toEqual(['First', 'Second', 'Third'])
  })
  it('anything else is nothing', () => {
    expect(titlesTaken('not json')).toEqual([])
    expect(titlesTaken(JSON.stringify({ kind: 'file', path: '/x' }))).toEqual([])
  })
})
