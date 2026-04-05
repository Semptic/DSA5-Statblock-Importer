const ATTR_KEYS = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']

function parseDerived(lines) {
  const joined = lines.join(' ')

  // Simple numeric fields
  const simple = {}
  for (const key of ['LeP', 'AW', 'SK', 'ZK', 'GS', 'Schip']) {
    const m = joined.match(new RegExp(`\\b${key}\\s+(-?\\d+)`))
    simple[key] = m ? parseInt(m[1]) : null
  }

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

  return { name, attributes, derived: parseDerived(lines) }
}
