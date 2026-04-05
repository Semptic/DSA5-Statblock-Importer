import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseFluff } from '../src/parser/fluff-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n(?:stats|fluff|gossip):|$)`))
  return match ? match[1].trim() : ''
}

const fluff = parseFluff(clean(loadSection('jaruslaw.txt', 'fluff')))

describe('parseFluff - header', () => {
  it('extracts npcCategory Turm from digit 3', () => {
    expect(fluff.npcCategory).toBe('Turm')
  })
  it('extracts titel', () => {
    expect(fluff.titel).toBe('Schitze')
  })
  it('extracts name without digit or titel', () => {
    expect(fluff.name).toBe('Jaruslaw von Kirschhausen-Krabbwitzkoje')
  })
  it('returns null npcCategory for unknown digit', () => {
    const result = parseFluff('9 Titel Name\nKurzcharakteristik: test')
    expect(result.npcCategory).toBeNull()
  })
  it('returns null npcCategory when no digit', () => {
    const result = parseFluff('Kein Digit Name\nKurzcharakteristik: test')
    expect(result.npcCategory).toBeNull()
  })
})

describe('parseFluff - blocks', () => {
  it('extracts kurzcharakteristik', () => {
    expect(fluff.kurzcharakteristik).toContain('mittelgroßer')
  })
  it('extracts motivation', () => {
    expect(fluff.motivation).toBe('Er will sich eine bessere Zukunft erkaufen.')
  })
  it('extracts funktion', () => {
    expect(fluff.funktion).toBe('Kämpfer der Klaue')
  })
  it('extracts hintergrund', () => {
    expect(fluff.hintergrund).toContain('Bornland')
  })
  it('returns empty string for missing blocks', () => {
    expect(fluff.agenda).toBe('')
    expect(fluff.darstellung).toBe('')
    expect(fluff.schicksal).toBe('')
    expect(fluff.besonderheiten).toBe('')
  })
  it('returns empty arrays for feindbilder and zitate when absent', () => {
    expect(fluff.feindbilder).toEqual([])
    expect(fluff.zitate).toEqual([])
  })
})

describe('parseFluff - feindbilder and zitate', () => {
  it('parses feindbilder as comma list', () => {
    const result = parseFluff('1 Name\nFeindbilder: Goblins, Orks, Elfen')
    expect(result.feindbilder).toEqual(['Goblins', 'Orks', 'Elfen'])
  })
  it('collects zitate (lines starting with »)', () => {
    const result = parseFluff('2 Name\nKurzcharakteristik: test\n»Das ist ein Zitat.«\n»Noch eines.«')
    expect(result.zitate).toHaveLength(2)
    expect(result.zitate[0]).toBe('»Das ist ein Zitat.«')
  })
  it('handles single-word name (no titel)', () => {
    const result = parseFluff('1 SingleName\nKurzcharakteristik: test')
    expect(result.titel).toBeNull()
    expect(result.name).toBe('SingleName')
  })
  it('handles name without digit prefix', () => {
    const result = parseFluff('NoDashName\nKurzcharakteristik: test')
    expect(result.npcCategory).toBeNull()
    expect(result.titel).toBeNull()
    expect(result.name).toBe('NoDashName')
  })
  it('handles empty lines array', () => {
    const result = parseFluff('')
    expect(result.name).toBe('')
    expect(result.titel).toBeNull()
    expect(result.npcCategory).toBeNull()
  })
  it('handles feindbilder with empty entries after split', () => {
    const result = parseFluff('1 Name\nFeindbilder: Goblins,,Orks')
    expect(result.feindbilder).toEqual(['Goblins', 'Orks'])
  })
  it('handles digit followed by nothing (only whitespace on first line)', () => {
    const result = parseFluff('1\nKurzcharakteristik: test')
    expect(result.npcCategory).toBeNull()
    expect(result.titel).toBeNull()
    expect(result.name).toBe('1')
  })
})
