import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseStats, parseCommaList } from '../src/parser/stats-parser.js'
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

describe('parseStats - armor with spaces around slash', () => {
  it('parses RS/BE with spaces around the slash', () => {
    const result = parseStats(clean(
      'MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 30 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 1\n' +
      'RS/BE 5 / 1 (Schuppenrüstung)'
    ))
    expect(result.armor).toEqual([{ name: 'Schuppenrüstung', RS: 5, BE: 1 }])
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

describe('parseStats - kampftechniken', () => {
  it('extracts Bögen with AT bonus only', () => {
    expect(stats.kampftechniken).toContainEqual({ name: 'Bögen', value: 14, atBonus: 15, paBonus: null })
  })
  it('extracts Schwerter with AT and PA bonus', () => {
    expect(stats.kampftechniken).toContainEqual({ name: 'Schwerter', value: 12, atBonus: 13, paBonus: 9 })
  })
  it('extracts Dolche with no bonus', () => {
    expect(stats.kampftechniken).toContainEqual({ name: 'Dolche', value: 10, atBonus: null, paBonus: null })
  })
  it('returns empty array when no Kampftechniken block present', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10')
    expect(result.kampftechniken).toEqual([])
  })
  it('skips malformed kampftechnik entries', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\nKampftechniken: Schwerter 10, MalformedEntry\n')
    expect(result.kampftechniken).toHaveLength(1)
    expect(result.kampftechniken[0].name).toBe('Schwerter')
  })
  it('inserts missing commas between entries that lack them', () => {
    const result = parseStats(
      'MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 25 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 1\n' +
      'Kampftechniken: Bogen 12 (13) Lanzen 14 (15/9), Raufen 11 (12/8)\n'
    )
    expect(result.kampftechniken).toHaveLength(3)
    expect(result.kampftechniken).toContainEqual({ name: 'Bogen', value: 12, atBonus: 13, paBonus: null })
    expect(result.kampftechniken).toContainEqual({ name: 'Lanzen', value: 14, atBonus: 15, paBonus: 9 })
    expect(result.kampftechniken).toContainEqual({ name: 'Raufen', value: 11, atBonus: 12, paBonus: 8 })
  })
})

describe('parseStats - talente', () => {
  it('extracts Körper talents', () => {
    expect(stats.talente.Körper).toContainEqual({ name: 'Klettern', value: 3, spezialisierung: null })
    expect(stats.talente.Körper).toContainEqual({ name: 'Reiten', value: 6, spezialisierung: null })
  })
  it('extracts Gesellschaft talents', () => {
    expect(stats.talente.Gesellschaft).toContainEqual({ name: 'Menschenkenntnis', value: 4, spezialisierung: null })
  })
  it('initializes all 6 talent categories', () => {
    expect(stats.talente.Körper).toBeInstanceOf(Array)
    expect(stats.talente.Gesellschaft).toBeInstanceOf(Array)
    expect(stats.talente.Natur).toBeInstanceOf(Array)
    expect(stats.talente.Wissen).toBeInstanceOf(Array)
    expect(stats.talente.Handwerk).toBeInstanceOf(Array)
    expect(stats.talente.Sonstige).toBeInstanceOf(Array)
  })
  it('puts unknown talent categories in Sonstige', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\nLeP 25 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 3\nKampftechniken: Schwerter 10\nTalente:\nUnbekannteKategorie: Testtalent 5\n')
    expect(result.talente.Sonstige).toContainEqual({ name: 'Testtalent', value: 5, spezialisierung: null })
  })
  it('parses continuation lines without a category header', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\nLeP 25 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 3\nTalente:\nKörper: Klettern 3\nReiten 6\n')
    expect(result.talente.Körper).toContainEqual({ name: 'Reiten', value: 6, spezialisierung: null })
  })
  it('returns empty talente when no Talente block present', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10')
    expect(result.talente.Körper).toEqual([])
    expect(result.talente.Sonstige).toEqual([])
  })
  it('ignores malformed talent entries', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\nLeP 25 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 3\nTalente:\nKörper: Klettern 3, NurText\n')
    expect(result.talente.Körper).toContainEqual({ name: 'Klettern', value: 3, spezialisierung: null })
    expect(result.talente.Körper).toHaveLength(1)
  })
  it('parses talent entry with specialization', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\nLeP 25 AsP - KaP - INI 10+1W6 AW 5 SK 0 ZK 0 GS 8 Schip 3\nTalente:\nHandwerk: Heilkunde (Wunden) 5\n')
    expect(result.talente.Handwerk).toContainEqual({ name: 'Heilkunde', value: 5, spezialisierung: 'Wunden' })
  })
})

describe('parseStats - comma lists', () => {
  it('extracts Sonderfertigkeiten', () => {
    expect(stats.sonderfertigkeiten).toContain('Präziser Schuss I')
    expect(stats.sonderfertigkeiten).toContain('Schnellladen (Bögen)')
  })
  it('extracts Sozialstatus', () => {
    expect(stats.sozialstatus).toBe('Freier')
  })
  it('extracts Sprachen as raw strings', () => {
    expect(stats.sprachen).toContain('Garethi 4 (Muttersprache)')
    expect(stats.sprachen).toContain('Alaani 2')
  })
  it('extracts Schriften', () => {
    expect(stats.schriften).toContain('Kusliker Zeichen 1')
  })
  it('extracts Vorteile', () => {
    expect(stats.vorteile).toContain('Gut Aussehend I')
  })
  it('extracts Nachteile', () => {
    expect(stats.nachteile).toContain('Vorurteil (Elfen)')
  })
})

describe('parseStats - prose', () => {
  it('extracts Kampfverhalten as string', () => {
    expect(stats.kampfverhalten).toContain('Bogensalven')
  })
  it('extracts Flucht as string', () => {
    expect(stats.flucht).toBe('Unter 10 LeP')
  })
})

describe('parseCommaList', () => {
  it('splits on top-level commas only, preserving parenthesized commas', () => {
    expect(parseCommaList('Wuchtschlag I+II (Haken, Säbel), Klingensturm')).toEqual([
      'Wuchtschlag I+II (Haken, Säbel)',
      'Klingensturm',
    ])
  })
  it('returns empty array for empty/null input', () => {
    expect(parseCommaList('')).toEqual([])
    expect(parseCommaList(null)).toEqual([])
  })
  it('handles a single entry without commas', () => {
    expect(parseCommaList('Gutaussehend')).toEqual(['Gutaussehend'])
  })
  it('trims whitespace from entries', () => {
    expect(parseCommaList('  Foo , Bar  ')).toEqual(['Foo', 'Bar'])
  })
  it('collapses line-wrapped entries (PDF line break within a list)', () => {
    expect(parseCommaList('Fertigkeitsspezialisierung\nReiten (Kampfmanöver), Wuchtschlag I+II')).toEqual([
      'Fertigkeitsspezialisierung Reiten (Kampfmanöver)',
      'Wuchtschlag I+II',
    ])
  })
  it('keeps Fertigkeitsspezialisierung as a single entry alongside other SF', () => {
    expect(parseCommaList('Fertigkeitsspezialisierung Reiten (Kampfmanöver), Ortskenntnis (Festum)')).toEqual([
      'Fertigkeitsspezialisierung Reiten (Kampfmanöver)',
      'Ortskenntnis (Festum)',
    ])
  })
})
