import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseGossip } from '../src/parser/gossip-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n(?:stats|fluff|gossip):|$)`))
  return match ? match[1].trim() : ''
}

const gossip = parseGossip(clean(loadSection('jaruslaw.txt', 'gossip')))

describe('parseGossip - subject', () => {
  it('extracts subject from "Gerüchte über ..." header', () => {
    expect(gossip.subject).toBe('Jaruslaw von Kirschhausen-Krabbwitzkoje')
  })
  it('returns empty subject when no header', () => {
    const result = parseGossip('» Nur ein Gerücht.')
    expect(result.subject).toBe('')
  })
})

describe('parseGossip - entries', () => {
  it('returns 3 entries for Jaruslaw', () => {
    expect(gossip.entries).toHaveLength(3)
  })
  it('preserves (+) marker in entry text', () => {
    expect(gossip.entries[0].text).toContain('(+)')
  })
  it('preserves (möglich) marker in entry text', () => {
    expect(gossip.entries[1].text).toContain('(möglich)')
  })
  it('preserves (-) marker in entry text', () => {
    expect(gossip.entries[2].text).toContain('(-)')
  })
  it('entry text includes leading »', () => {
    for (const e of gossip.entries) expect(e.text.startsWith('»')).toBe(true)
  })
  it('handles multi-line entries (continuation lines merged)', () => {
    const input = 'Gerüchte über Test\n» Erste Zeile\nFortsetzung hier.\n» Zweites Gerücht.'
    const result = parseGossip(input)
    expect(result.entries[0].text).toContain('Fortsetzung')
    expect(result.entries).toHaveLength(2)
  })
  it('returns empty entries array when no entries', () => {
    const result = parseGossip('Gerüchte über Jemand')
    expect(result.entries).toEqual([])
  })
})
