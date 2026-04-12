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

describe('parseStats - talente multi-line wrapping', () => {
  const ATTRS = 'MU 12 KL 11 IN 12 CH 11\nFF 11 GE 12 KO 11 KK 10\nLeP 27 AsP– KaP– INI 12+1W6\nSK1 ZK 0 AW6 GS8'
  it('merges a name-only line with a digit-only continuation line', () => {
    const result = parseStats(`${ATTRS}\nTalente: Körperbeherrschung\n4, Kraftakt 2\n`)
    const sonstige = result.talente.Sonstige
    expect(sonstige).toContainEqual({ name: 'Körperbeherrschung', value: 4, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Kraftakt', value: 2, spezialisierung: null })
  })
  it('parses the full Swafrieda Talente block (all 9 talents with correct values)', () => {
    const swafrieda = [
      'Swafrieda Eldridsdottir',
      ATTRS,
      'Waffenlos: AT 10 PA6 TP 1W6 RW kurz',
      'RS/BE 0/0',
      'Sonderfertigkeiten: keine',
      'Vorteile/Nachteile: Schlechte Eigenschaft (Rachsucht)',
      'Talente: Einschüchtern 0, Körperbeherrschung',
      '4, Kraftakt 2, Menschenkenntnis',
      '2, Selbstbeherrschung 2, Sinnesschärfe',
      '4, Überreden 4, Verbergen 3,',
      'Willenskraft 4',
    ].join('\n')
    const result = parseStats(swafrieda)
    const sonstige = result.talente.Sonstige
    expect(sonstige).toContainEqual({ name: 'Einschüchtern', value: 0, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Körperbeherrschung', value: 4, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Kraftakt', value: 2, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Menschenkenntnis', value: 2, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Selbstbeherrschung', value: 2, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Sinnesschärfe', value: 4, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Überreden', value: 4, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Verbergen', value: 3, spezialisierung: null })
    expect(sonstige).toContainEqual({ name: 'Willenskraft', value: 4, spezialisierung: null })
    expect(sonstige).toHaveLength(9)
  })
})

describe('parseStats - Vorteile/Nachteile combined header', () => {
  const ATTRS = 'MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10'
  it('puts items from combined Vorteile/Nachteile header into nachteile only', () => {
    const result = parseStats(`${ATTRS}\nVorteile/Nachteile: Schlechte Eigenschaft (Rachsucht)\n`)
    expect(result.nachteile).toContain('Schlechte Eigenschaft (Rachsucht)')
    expect(result.vorteile).toEqual([])
  })
  it('separate Vorteile: and Nachteile: headers still work independently', () => {
    const result = parseStats(`${ATTRS}\nVorteile: Gut Aussehend I\nNachteile: Vorurteil (Elfen)\n`)
    expect(result.vorteile).toContain('Gut Aussehend I')
    expect(result.nachteile).toContain('Vorurteil (Elfen)')
    expect(result.vorteile).not.toContain('Vorurteil (Elfen)')
    expect(result.nachteile).not.toContain('Gut Aussehend I')
  })
  it('combined header does not bleed into Sonderfertigkeiten block', () => {
    const result = parseStats(`${ATTRS}\nSonderfertigkeiten: keine\nVorteile/Nachteile: Schlechte Eigenschaft (Rachsucht)\n`)
    expect(result.sonderfertigkeiten).toEqual(['keine'])
    expect(result.nachteile).toContain('Schlechte Eigenschaft (Rachsucht)')
  })
})

describe('parseWeapons - null guard for lines without name prefix', () => {
  it('skips weapon lines that have no parseable name prefix', () => {
    // A line that matches the weaponLineRe (has AT/FK + digit) but has no leading name token
    const result = parseStats(
      'Name\nMU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 20 AsP – KaP – INI 10+1W6 SK 0 ZK 0 AW 6 GS 8\n' +
      'AT 12 PA 7 TP 1W6 RW kurz'
    )
    // Line starts with AT — no name before AT, nameMatch is null, should be skipped
    expect(result.weapons).toHaveLength(0)
  })
})

describe('parseTalentEntries - uses parseCommaList (comma inside specialization parens)', () => {
  it('treats comma inside parens as part of the specialization name, not a split point', () => {
    const result = parseStats(
      'Name\nMU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 20 AsP – KaP – INI 10+1W6 SK 0 ZK 0 AW 6 GS 8\n' +
      'Talente:\nKörper: Heilkunde (Wunden, Vergiftung) 5'
    )
    // parseCommaList keeps the entry intact; parseTalentEntry then splits name/spezialisierung
    expect(result.talente.Körper).toContainEqual({ name: 'Heilkunde', value: 5, spezialisierung: 'Wunden, Vergiftung' })
  })
})

describe('parseDash / weapon regex - en-dash support', () => {
  it('parses FK-only weapon line (baseline)', () => {
    const result = parseStats(
      'Name\nMU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 20 AsP – KaP – INI 10+1W6 SK 0 ZK 0 AW 6 GS 8\n' +
      'Kurzbogen FK 10 TP 1W6 RW 5'
    )
    const weapon = result.weapons.find(w => w.name === 'Kurzbogen')
    expect(weapon).toBeDefined()
    expect(weapon.FK).toBe(10)
  })
})

describe('parseStats - ausrüstung block', () => {
  it('parses Ausrüstung as a list of item names', () => {
    const result = parseStats(
      'Name\nMU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10\n' +
      'LeP 20 AsP – KaP – INI 10+1W6 SK 0 ZK 0 AW 6 GS 8\n' +
      'Ausrüstung: Schwerer Dolch, Rucksack'
    )
    expect(result.ausrüstung).toEqual(['Schwerer Dolch', 'Rucksack'])
  })
  it('returns empty array when no Ausrüstung block present', () => {
    const result = parseStats('MU 10 KL 10 IN 10 CH 10 FF 10 GE 10 KO 10 KK 10')
    expect(result.ausrüstung).toEqual([])
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
