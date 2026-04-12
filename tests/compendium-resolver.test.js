import { describe, it, expect } from 'vitest'
import { splitCommaSpec, parseAdoption, applyAdoptionToItem, extractTier, levenshtein, normalize } from '../src/compendium-resolver.js'

// --- splitCommaSpec ---

describe('splitCommaSpec', () => {
  it('splits two personality flaw variants', () => {
    expect(splitCommaSpec('Persönlichkeitsschwäche (Arroganz, Eitelkeit)')).toEqual({
      base: 'Persönlichkeitsschwäche',
      parts: ['Arroganz', 'Eitelkeit'],
    })
  })

  it('splits two weapon types', () => {
    expect(splitCommaSpec('Wuchtschlag I+II (Haken, Säbel)')).toEqual({
      base: 'Wuchtschlag I+II',
      parts: ['Haken', 'Säbel'],
    })
  })

  it('splits three parts', () => {
    expect(splitCommaSpec('Herausragender Sinn (Gehör, Geruch, Sehen)')).toEqual({
      base: 'Herausragender Sinn',
      parts: ['Gehör', 'Geruch', 'Sehen'],
    })
  })

  it('returns null when no parens', () => {
    expect(splitCommaSpec('Gutaussehend I')).toBeNull()
  })

  it('returns null when spec has no comma', () => {
    expect(splitCommaSpec('Ortskenntnis (Festum)')).toBeNull()
  })

  it('returns null when comma is inside nested parens only', () => {
    // "Schriftstellerei (Sagen & Legenden (Märchen))" — no comma at outer level
    expect(splitCommaSpec('Schriftstellerei (Sagen & Legenden (Märchen))')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(splitCommaSpec('')).toBeNull()
  })

  it('returns null for unbalanced parens', () => {
    expect(splitCommaSpec('Foo (Bar, Baz')).toBeNull()
  })
})

// --- parseAdoption ---

const ADOPTION_REGISTRY = {
  'Fertigkeitsspezialisierung ()': { items: ['skill'], area: true, effect: 'FW2' },
  'Ortskenntnis ()': { items: 'text' },
  'Schlechte Angewohnheit ()': { items: 'text' },
  'Weg ()': { items: ['skill'], effect: 'FP1' },
  'Weg der Gelehrten ()': { items: ['skill'], effect: '1' },
}

describe('parseAdoption', () => {
  it('parses area=true item with skill and spec', () => {
    const result = parseAdoption('Fertigkeitsspezialisierung Reiten (Kampfmanöver)', ADOPTION_REGISTRY)
    expect(result).toEqual({
      baseName: 'Fertigkeitsspezialisierung',
      adoptionName: 'Reiten',
      customEntry: 'Kampfmanöver',
      rule: ADOPTION_REGISTRY['Fertigkeitsspezialisierung ()'],
    })
  })

  it('parses area=true item with skill but no spec', () => {
    const result = parseAdoption('Fertigkeitsspezialisierung Reiten', ADOPTION_REGISTRY)
    expect(result).toEqual({
      baseName: 'Fertigkeitsspezialisierung',
      adoptionName: 'Reiten',
      customEntry: null,
      rule: ADOPTION_REGISTRY['Fertigkeitsspezialisierung ()'],
    })
  })

  it('parses text item with spec', () => {
    const result = parseAdoption('Ortskenntnis (Festum)', ADOPTION_REGISTRY)
    expect(result).toEqual({
      baseName: 'Ortskenntnis',
      adoptionName: 'Festum',
      customEntry: null,
      rule: ADOPTION_REGISTRY['Ortskenntnis ()'],
    })
  })

  it('parses text item with colon inside spec', () => {
    const result = parseAdoption('Schlechte Angewohnheit (Belästigung: Frauen)', ADOPTION_REGISTRY)
    expect(result).toEqual({
      baseName: 'Schlechte Angewohnheit',
      adoptionName: 'Belästigung: Frauen',
      customEntry: null,
      rule: ADOPTION_REGISTRY['Schlechte Angewohnheit ()'],
    })
  })

  it('returns null for item not in registry', () => {
    expect(parseAdoption('Gutaussehend I', ADOPTION_REGISTRY)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseAdoption('', ADOPTION_REGISTRY)).toBeNull()
  })

  it('uses longest match when registry has prefix collision', () => {
    // "Weg der Gelehrten" should win over "Weg"
    const result = parseAdoption('Weg der Gelehrten (Anatomie)', ADOPTION_REGISTRY)
    expect(result?.baseName).toBe('Weg der Gelehrten')
    expect(result?.adoptionName).toBe('Anatomie')
  })

  it('matches shorter entry when longer does not match', () => {
    const result = parseAdoption('Weg (Kochen)', ADOPTION_REGISTRY)
    expect(result?.baseName).toBe('Weg')
    expect(result?.adoptionName).toBe('Kochen')
  })
})

// --- applyAdoptionToItem ---

describe('applyAdoptionToItem', () => {
  it('sets name with adoptionName and customEntry', () => {
    const item = { name: 'Fertigkeitsspezialisierung ()', system: { effect: { value: '' } } }
    const adoption = {
      baseName: 'Fertigkeitsspezialisierung',
      adoptionName: 'Reiten',
      customEntry: 'Kampfmanöver',
      rule: { effect: 'FW2' },
    }
    applyAdoptionToItem(item, adoption)
    expect(item.name).toBe('Fertigkeitsspezialisierung (Reiten, Kampfmanöver)')
  })

  it('sets effect.value to adoptionName + rule.effect', () => {
    const item = { name: 'Fertigkeitsspezialisierung ()', system: { effect: { value: '' } } }
    const adoption = {
      baseName: 'Fertigkeitsspezialisierung',
      adoptionName: 'Reiten',
      customEntry: 'Kampfmanöver',
      rule: { effect: 'FW2' },
    }
    applyAdoptionToItem(item, adoption)
    expect(item.system.effect.value).toBe('Reiten FW2')
  })

  it('sets name without customEntry', () => {
    const item = { name: 'Ortskenntnis ()', system: {} }
    const adoption = {
      baseName: 'Ortskenntnis',
      adoptionName: 'Festum',
      customEntry: null,
      rule: {},
    }
    applyAdoptionToItem(item, adoption)
    expect(item.name).toBe('Ortskenntnis (Festum)')
  })

  it('does not set effect.value when rule has no effect', () => {
    const item = { name: 'Ortskenntnis ()', system: { effect: { value: 'original' } } }
    const adoption = {
      baseName: 'Ortskenntnis',
      adoptionName: 'Festum',
      customEntry: null,
      rule: {},
    }
    applyAdoptionToItem(item, adoption)
    expect(item.system.effect.value).toBe('original')
  })

  it('handles item without effect field', () => {
    const item = { name: 'Ortskenntnis ()', system: {} }
    const adoption = {
      baseName: 'Ortskenntnis',
      adoptionName: 'Festum',
      customEntry: null,
      rule: {},
    }
    expect(() => applyAdoptionToItem(item, adoption)).not.toThrow()
    expect(item.name).toBe('Ortskenntnis (Festum)')
  })
})

// --- extractTier ---

describe('extractTier', () => {
  it('extracts Roman numeral tier II', () => {
    expect(extractTier('Gutaussehend II')).toEqual({ base: 'Gutaussehend', tier: 2 })
  })

  it('returns tier 1 when no suffix', () => {
    expect(extractTier('Klettern')).toEqual({ base: 'Klettern', tier: 1 })
  })

  it('extracts combined tier I+II', () => {
    expect(extractTier('Wuchtschlag I+II')).toEqual({ base: 'Wuchtschlag', tier: 2 })
  })

  it('extracts tier I', () => {
    expect(extractTier('Klettern I')).toEqual({ base: 'Klettern', tier: 1 })
  })
})

// --- levenshtein ---

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
  })

  it('returns 1 for single substitution', () => {
    expect(levenshtein('abc', 'abd')).toBe(1)
  })

  it('returns 1 for single insertion', () => {
    expect(levenshtein('abc', 'abcd')).toBe(1)
  })

  it('returns 1 for single deletion', () => {
    expect(levenshtein('abcd', 'abc')).toBe(1)
  })

  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })
})

// --- normalize ---

describe('normalize', () => {
  it('lowercases ASCII', () => {
    expect(normalize('Klettern')).toBe('klettern')
  })

  it('lowercases German umlaut characters', () => {
    expect(normalize('Ärger')).toBe('ärger')
  })

  it('lowercases Roman numeral suffixes (TIER_RE only matches uppercase, so suffix stays in output)', () => {
    // normalize lowercases before applying TIER_RE, so " II" → " ii" is not stripped by TIER_RE.
    // extractTier is used for actual tier stripping; normalize is for Levenshtein comparison normalization.
    expect(normalize('Gutaussehend II')).toBe('gutaussehend ii')
  })

  it('trims whitespace', () => {
    expect(normalize('  Foo  ')).toBe('foo')
  })
})
