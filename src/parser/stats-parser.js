const ATTR_KEYS = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']

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

  return { name, attributes }
}
