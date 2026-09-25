import { describe, expect, it } from 'vitest'
import { resolveAppearance } from './appearance'

describe('resolveAppearance', () => {
  it("follows the shell's stamp, except that reduced transparency always means Solid", () => {
    expect(resolveAppearance('glass', false)).toBe('glass')
    expect(resolveAppearance('glass', true)).toBe('solid')
    expect(resolveAppearance('solid', false)).toBe('solid')
  })
  it('is Solid until the shell has spoken, and ignores junk', () => {
    expect(resolveAppearance(undefined, false)).toBe('solid')
    expect(resolveAppearance('', false)).toBe('solid')
    expect(resolveAppearance('frosted', false)).toBe('solid')
  })
})
