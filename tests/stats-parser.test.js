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

describe('parseStats - derived', () => {
  it('extracts LeP', () => expect(stats.derived.LeP).toBe(32))
  it('extracts INI as base + dice', () => {
    expect(stats.derived.INI).toEqual({ base: 14, dice: '1W6' })
  })
  it('sets Asp to null when "–"', () => expect(stats.derived.Asp).toBeNull())
  it('sets KaP to null when "–"', () => expect(stats.derived.KaP).toBeNull())
  it('extracts AW', () => expect(stats.derived.AW).toBe(6))
  it('extracts SK', () => expect(stats.derived.SK).toBe(1))
  it('extracts ZK', () => expect(stats.derived.ZK).toBe(0))
  it('extracts GS', () => expect(stats.derived.GS).toBe(8))
  it('extracts Schip', () => expect(stats.derived.Schip).toBe(3))
})

// Load a fixture with non-null Asp (nfk1-jaani has AsP 29)
const rawStatsJaani = loadSection('nfk1-jaani.txt', 'stats')
const statsJaani = parseStats(clean(rawStatsJaani))

describe('parseStats - derived (with Asp)', () => {
  it('extracts numeric Asp when present', () => {
    expect(statsJaani.derived.Asp).toBe(29)
  })
  it('sets KaP to null when "–" even with numeric Asp', () => {
    expect(statsJaani.derived.KaP).toBeNull()
  })
})
