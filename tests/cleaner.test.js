import { describe, it, expect } from 'vitest'
import { clean } from '../src/parser/cleaner.js'

describe('clean', () => {
  it('replaces ligatures', () => {
    expect(clean('\uFB00\uFB01\uFB02\uFB03\uFB04')).toBe('fffiflffiffl')
    expect(clean('Spezi\uFB01sierung')).toBe('Spezifisierung')
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

  it('normalizes decomposed Unicode (NFD) to NFC', () => {
    // PDFs often emit u + combining diaeresis instead of precomposed ü
    const nfd = 'Schuppenu\u0308stu\u0308ng'
    expect(clean(nfd)).toBe('Schuppenüstüng')
  })

  it('joins hyphenated line breaks', () => {
    expect(clean('Be-\nrittener Kampf')).toBe('Berittener Kampf')
    expect(clean('Persönlichkeits-\nschwäche')).toBe('Persönlichkeitsschwäche')
    expect(clean('Ortskennt-\nnis (Kirschhausen)')).toBe('Ortskenntnis (Kirschhausen)')
    expect(clean('Schiff-\nüberfahrt')).toBe('Schiffüberfahrt')
  })

  it('replaces FB05/FB06 ligatures', () => {
    expect(clean('\uFB05\uFB06')).toBe('stst')
  })

  it('normalizes non-breaking hyphen (U+2010) to plain hyphen', () => {
    expect(clean('A\u2010B')).toBe('A-B')
  })

  it('collapses multiple blank lines to one blank line', () => {
    expect(clean('a\n\n\nb')).toBe('a\n\nb')
  })
})
