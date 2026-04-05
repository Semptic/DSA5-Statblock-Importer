import { describe, it, expect } from 'vitest'
import { clean } from '../src/parser/cleaner.js'

describe('clean', () => {
  it('replaces fi ligature', () => {
    expect(clean('Sonderfertigkeiten')).toBe('Sonderfertigkeiten')
    // ﬁ → fi
    expect(clean('Spezi\uFB01sierung')).toBe('Speziﬁsierung'.replace('\uFB01', 'fi'))
  })

  it('normalizes en-dash and em-dash to hyphen', () => {
    expect(clean('AT\u201311')).toBe('AT-11')
    expect(clean('RW\u2014mittel')).toBe('RW-mittel')
  })

  it('removes soft hyphens', () => {
    expect(clean('Sonder\u00ADfertigkeiten')).toBe('Sonderfertigkeiten')
  })

  it('collapses multiple spaces to one', () => {
    expect(clean('MU  13   KL  10')).toBe('MU 13 KL 10')
  })

  it('removes lone numeric lines (stray page numbers)', () => {
    expect(clean('line one\n42\nline two')).toBe('line one\nline two')
  })

  it('preserves guillemets', () => {
    expect(clean('»Hallo«')).toBe('»Hallo«')
  })

  it('preserves paragraph breaks', () => {
    expect(clean('para one\n\npara two')).toBe('para one\n\npara two')
  })
})
