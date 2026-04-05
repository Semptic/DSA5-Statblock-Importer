const CATEGORY_MAP = { '1': 'Bauer', '2': 'Springer', '3': 'Turm', '4': 'Läufer' }

const FLUFF_ANCHORS = [
  'Kurzcharakteristik', 'Motivation', 'Agenda', 'Funktion', 'Hintergrund',
  'Feindbilder', 'Darstellung', 'Schicksal', 'Besonderheiten',
]

export function parseFluff(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // First line: [digit] [titel] name
  const firstLine = lines[0] ?? ''
  const digitMatch = firstLine.match(/^(\d)\s+(.+)$/)
  const digit = digitMatch?.[1] ?? null
  const npcCategory = digit ? (CATEGORY_MAP[digit] ?? null) : null
  const remainder = digitMatch?.[2] ?? firstLine

  // Heuristic: first word is titel, rest is name
  // (both words could also be part of the name — ReviewDialog allows correction)
  const remainderParts = remainder.match(/^(\S+)\s+(.+)$/)
  const titel = remainderParts ? remainderParts[1] : null
  const name = remainderParts ? remainderParts[2] : remainder

  // Zitate: lines starting with »
  const zitate = lines.filter(l => l.startsWith('»'))

  // Extract anchor blocks
  const blocks = extractFluffBlocks(lines.slice(1))

  // Feindbilder: comma-separated
  const feindbilder = blocks.Feindbilder
    ? blocks.Feindbilder.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return {
    npcCategory, titel, name,
    kurzcharakteristik: blocks.Kurzcharakteristik ?? '',
    motivation: blocks.Motivation ?? '',
    agenda: blocks.Agenda ?? '',
    funktion: blocks.Funktion ?? '',
    hintergrund: blocks.Hintergrund ?? '',
    feindbilder,
    darstellung: blocks.Darstellung ?? '',
    schicksal: blocks.Schicksal ?? '',
    besonderheiten: blocks.Besonderheiten ?? '',
    zitate,
  }
}

function extractFluffBlocks(lines) {
  const anchorRe = new RegExp(`^(${FLUFF_ANCHORS.join('|')}):(.*)$`)
  const blocks = {}
  let current = null
  for (const line of lines) {
    const m = line.match(anchorRe)
    if (m) {
      current = m[1]
      blocks[current] = m[2].trim()
    } else if (current) {
      blocks[current] += ' ' + line
    }
  }
  // Trim all blocks
  for (const k of Object.keys(blocks)) blocks[k] = blocks[k].trim()
  return blocks
}
