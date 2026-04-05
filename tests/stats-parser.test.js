import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseStats } from '../src/parser/stats-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  // Only stop at known top-level section boundaries, not at colon-suffixed weapon names
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n(?:stats|fluff|gossip):|$)`))
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
  it('extracts Schips (with trailing s)', () => expect(syntheticBruutsch.derived.Schip).toBe(2))
})

describe('parseStats - weapons', () => {
  it('extracts Kurzbogen with AT, PA, and FK', () => {
    const kb = stats.weapons.find(w => w.name === 'Kurzbogen')
    expect(kb).toBeDefined()
    expect(kb.AT).toBe(13)
    expect(kb.PA).toBe(0)    // 0 is valid, not null
    expect(kb.FK).toBe(14)
  })
  it('sets FK to null when "–"', () => {
    const lm = stats.weapons.find(w => w.name === 'Langmesser')
    expect(lm).toBeDefined()
    expect(lm.AT).toBe(12)
    expect(lm.PA).toBe(8)
    expect(lm.FK).toBeNull()
  })
})

describe('parseStats - armor', () => {
  it('returns Keine with RS 0 BE 0 when no armor', () => {
    expect(stats.armor).toEqual([{ name: 'Keine', RS: 0, BE: 0 }])
  })
})

// Synthetic stats block covering named armor and FK-only weapon
const syntheticBruutsch = parseStats(clean(
  'Bruutsch Smuddelvlies\n' +
  'MU 13 KL 10 IN 14 CH 13 FF 12 GE 14 KO 12 KK 12\n' +
  'LeP 29 AsP - KaP - INI 15+1W6 AW 7 SK -1 ZK -1 GS 9\n' +
  'Schips 2\n' +
  'Zwei Schwere Dolche: AT 13 PA 7 TP 1W6+2 RW kurz\n' +
  'Wurfspeer: FK 13 LZ 2 TP 2W6+2 RW 5/25/40\n' +
  'RS/BE: 0/0 (Normale Kleidung)\n' +
  'Sozialstatus: frei'
))

describe('parseStats - weapons (named weapon lines with colons)', () => {
  it('extracts Zwei Schwere Dolche with AT and PA, no FK', () => {
    const w = syntheticBruutsch.weapons.find(w => w.name === 'Zwei Schwere Dolche')
    expect(w).toBeDefined()
    expect(w.AT).toBe(13)
    expect(w.PA).toBe(7)
    expect(w.FK).toBeNull()
  })
  it('extracts Wurfspeer with FK only', () => {
    const w = syntheticBruutsch.weapons.find(w => w.name === 'Wurfspeer')
    expect(w).toBeDefined()
    expect(w.AT).toBeNull()
    expect(w.PA).toBeNull()
    expect(w.FK).toBe(13)
  })
})

describe('parseStats - armor (named armor in parentheses)', () => {
  it('returns named armor when armor name is present', () => {
    expect(syntheticBruutsch.armor).toEqual([{ name: 'Normale Kleidung', RS: 0, BE: 0 }])
  })
})

describe('parseStats - armor edge cases', () => {
  it('returns empty array when no RS/BE line present', () => {
    const result = parseStats(clean('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10'))
    expect(result.armor).toEqual([])
  })
})

describe('parseStats - armor malformed RS/BE line', () => {
  it('returns empty array when RS/BE line has no numeric values', () => {
    const result = parseStats(clean(
      'MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 10 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 1\n' +
      'RS/BE: siehe Ausrüstung'
    ))
    expect(result.armor).toEqual([])
  })
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
