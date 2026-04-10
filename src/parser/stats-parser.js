const TALENT_CATEGORIES = ['Körper', 'Gesellschaft', 'Natur', 'Wissen', 'Handwerk']

function parseDash(val) {
  return val === '-' ? null : parseInt(val)
}

function parseWeapons(lines) {
  const weapons = []
  const weaponLineRe = /\b(?:AT|FK)\s+\d/
  for (const line of lines) {
    if (!weaponLineRe.test(line)) continue
    // Extract name: everything before the first AT/FK/PA keyword (strip trailing colon)
    const nameMatch = line.match(/^(.+?):?\s+(?:AT|FK|PA)\s+/)
    const name = nameMatch[1].replace(/:$/, '').trim()
    // Extract AT, PA, FK
    const atM = line.match(/\bAT\s+(\d+)/)
    const paM = line.match(/\bPA\s+([\d-]+)/)
    const fkM = line.match(/\bFK\s+([\d-]+)/)
    weapons.push({
      name,
      AT: atM ? parseInt(atM[1]) : null,
      PA: paM ? parseDash(paM[1]) : null,
      FK: fkM ? parseDash(fkM[1]) : null,
    })
  }
  return weapons
}

function parseArmor(lines) {
  const rsLine = lines.find(l => /^RS\/BE:?\s/.test(l))
  if (!rsLine) return []
  // Named armor: "RS/BE 5/1 (Schuppenrüstung)" or "RS/BE: 0/0 (Normale Kleidung)" or "RS/BE 5 / 1 (Schuppenrüstung)"
  const withName = rsLine.match(/RS\/BE:?\s+(\d+)\s*\/\s*(\d+)\s+\(([^)]+)\)/)
  if (withName) {
    return [{ name: withName[3].trim(), RS: parseInt(withName[1]), BE: parseInt(withName[2]) }]
  }
  // No name: "RS/BE 0/0"
  const noName = rsLine.match(/RS\/BE:?\s+(\d+)\s*\/\s*(\d+)/)
  return noName ? [{ name: 'Keine', RS: parseInt(noName[1]), BE: parseInt(noName[2]) }] : []
}

function parseDerived(lines) {
  const joined = lines.join(' ')

  // Simple numeric fields
  const simple = {}
  for (const key of ['LeP', 'AW', 'SK', 'ZK', 'GS']) {
    const m = joined.match(new RegExp(`\\b${key}\\s+(-?\\d+)`))
    simple[key] = m ? parseInt(m[1]) : null
  }

  // Schip with optional 's' (Schip or Schips)
  const schipM = joined.match(/\bSchips?\s+(-?\d+)/)
  simple.Schip = schipM ? parseInt(schipM[1]) : null

  // Nullable fields (Asp/AsP, KaP) — "–" or "-" means null
  for (const [outKey, pattern] of [['Asp', /\bAs[Pp]\s+([\d–-]+)/], ['KaP', /\bKaP\s+([\d–-]+)/]]) {
    const m = joined.match(pattern)
    if (!m) { simple[outKey] = null; continue }
    simple[outKey] = (m[1] === '–' || m[1] === '-') ? null : parseInt(m[1])
  }

  // INI: "14+1W6"
  const iniM = joined.match(/\bINI\s+(\d+)\+(\d+W\d+)/)
  simple.INI = iniM ? { base: parseInt(iniM[1]), dice: iniM[2] } : null

  return simple
}

function extractBlocks(text) {
  const blocks = {}
  const lines = text.split('\n')
  let current = null
  for (const line of lines) {
    const m = line.match(/^(RS\/BE|Sozialstatus|Sonderfertigkeiten|Sprachen|Schriften|Vorteile\/Nachteile|Vorteile|Nachteile|Kampftechniken|Talente|Kampfverhalten|Flucht):\s*(.*)$/)
    if (m) {
      current = m[1]
      blocks[current] = m[2]
    } else if (current) {
      blocks[current] += '\n' + line
    }
  }
  for (const k of Object.keys(blocks)) blocks[k] = blocks[k].trim()
  return blocks
}

function parseKampftechniken(block) {
  if (!block) return []
  // Some statbook formats omit the comma between the first two entries:
  // "Bogen 12 (13) Lanzen 14 (15/9), Raufen 11..." → insert missing commas
  const normalized = block.replace(/([)\d])\s+(?=[A-ZÄÖÜ])/g, '$1, ')
  return normalized.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const m = entry.match(/^(.+?)\s+(\d+)(?:\s*\((\d+)(?:\/(\d+))?\))?$/)
    if (!m) return null
    return { name: m[1].trim(), value: parseInt(m[2]), atBonus: m[3] ? parseInt(m[3]) : null, paBonus: m[4] ? parseInt(m[4]) : null }
  }).filter(Boolean)
}

function parseTalentEntry(entry) {
  entry = entry.trim()
  const withSpec = entry.match(/^(.+?)\s+\(([^)]+)\)\s+(-?\d+)$/)
  if (withSpec) return { name: withSpec[1].trim(), value: parseInt(withSpec[3]), spezialisierung: withSpec[2] }
  const simple = entry.match(/^(.+?)\s+(-?\d+)$/)
  if (simple) return { name: simple[1].trim(), value: parseInt(simple[2]), spezialisierung: null }
  return null
}

function parseTalentEntries(text) {
  return text.split(',').map(e => parseTalentEntry(e.trim())).filter(Boolean)
}

function parseTalente(block) {
  const result = { Körper: [], Gesellschaft: [], Natur: [], Wissen: [], Handwerk: [], Sonstige: [] }
  if (!block) return result
  const rawLines = block.split('\n').map(l => l.trim()).filter(Boolean)
  // Merge PDF line-wrap continuations: talent name and value may be split across lines.
  // A line starting with a digit is a wrapped value belonging to the previous line.
  const lines = []
  for (const line of rawLines) {
    if (lines.length > 0 && /^\d/.test(line)) {
      lines[lines.length - 1] += ' ' + line
    } else {
      lines.push(line)
    }
  }
  let currentCat = 'Sonstige'
  for (const line of lines) {
    const catMatch = line.match(/^([\w\u00C0-\u024F][\w\s\u00C0-\u024F]+?):\s*(.*)$/)
    if (catMatch) {
      const cat = catMatch[1].trim()
      currentCat = TALENT_CATEGORIES.includes(cat) ? cat : 'Sonstige'
      const entries = catMatch[2].trim()
      if (entries) parseTalentEntries(entries).forEach(e => result[currentCat].push(e))
    } else {
      parseTalentEntries(line).forEach(e => result[currentCat].push(e))
    }
  }
  return result
}

export function parseCommaList(block) {
  if (!block) return []
  // Collapse line wraps (PDF formatting artifact) within the block
  block = block.replace(/\n/g, ' ')
  // Split on commas that are NOT inside parentheses
  const result = []
  let depth = 0, current = ''
  for (const ch of block) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) result.push(trimmed)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) result.push(current.trim())
  return result
}

export function parseStats(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find the attribute line (contains MU, KL, IN, CH, etc.)
  const attrLinePattern = /\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+\d+/
  const firstAttrIdx = lines.findIndex(l => attrLinePattern.test(l))

  // Parse attributes from all lines containing attribute keywords
  const attributes = {}
  for (const line of lines.filter(l => attrLinePattern.test(l))) {
    for (const [, key, val] of line.matchAll(/\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+(\d+)/g)) {
      attributes[key] = parseInt(val)
    }
  }

  // Name: lines before first attribute line, strip leading category digit if present
  const nameRaw = lines.slice(0, firstAttrIdx).join(' ').trim()
  const name = nameRaw.replace(/^\d+\s*/, '').trim() || null

  const blocks = extractBlocks(text)
  const vnCombined = parseCommaList(blocks['Vorteile/Nachteile'])

  return {
    name,
    attributes,
    derived: parseDerived(lines),
    weapons: parseWeapons(lines),
    armor: parseArmor(lines),
    kampftechniken: parseKampftechniken(blocks['Kampftechniken']),
    talente: parseTalente(blocks['Talente']),
    sonderfertigkeiten: parseCommaList(blocks['Sonderfertigkeiten']),
    sozialstatus: blocks['Sozialstatus'] || null,
    sprachen: parseCommaList(blocks['Sprachen']),
    schriften: parseCommaList(blocks['Schriften']),
    vorteile: vnCombined.length ? [] : parseCommaList(blocks['Vorteile']),
    nachteile: vnCombined.length ? vnCombined : parseCommaList(blocks['Nachteile']),
    kampfverhalten: blocks['Kampfverhalten'] || null,
    flucht: blocks['Flucht'] || null,
  }
}
