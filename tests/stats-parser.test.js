import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseStats } from '../src/parser/stats-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n\\w+:|$)`))
  return match ? match[1].trim() : ''
}

const rawStats = loadSection('jaruslaw.txt', 'stats')
const stats = parseStats(clean(rawStats))

describe('parseStats - name', () => {
  it('extracts the NPC name from the first line(s)', () => {
    expect(stats.name).toBe('Schitze Jaruslaw von Kirschhausen-Krabbwitzkoje')
  })
})

describe('parseStats - attributes', () => {
  it('extracts all 8 base attributes', () => {
    expect(stats.attributes).toEqual({
      MU: 13,
      KL: 10,
      IN: 12,
      CH: 11,
      FF: 14,
      GE: 15,
      KO: 13,
      KK: 12,
    })
  })
})

describe('parseStats - edge cases', () => {
  it('returns null for name when only category digit precedes attributes', () => {
    const text = clean('3\nMU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10')
    const result = parseStats(text)
    expect(result.name).toBe(null)
  })

  it('returns null for name when attributes are on first line', () => {
    const text = clean('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10')
    const result = parseStats(text)
    expect(result.name).toBe(null)
  })
})
