const LIGATURES = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
}

export function clean(text) {
  let result = text.normalize('NFC')

  // Ligatures
  for (const [lig, rep] of Object.entries(LIGATURES)) {
    result = result.replaceAll(lig, rep)
  }

  // Soft hyphens
  result = result.replaceAll('\u00AD', '')

  // Hyphenated line breaks (PDF word-wrap): "Wort-\nfortsetzung" → "Wortfortsetzung"
  result = result.replace(/(\p{L})-\n(\p{L})/gu, '$1$2')

  // Dashes → hyphen (but not inside »...« quotes — preserved as-is)
  result = result.replace(/[\u2013\u2014\u2010]/g, '-')

  // Collapse multiple spaces/tabs to single space (within lines)
  result = result.replace(/[^\S\n]+/g, ' ')

  // Remove lone numeric lines (stray page numbers) and their trailing newline
  result = result.replace(/^\s*\d+\s*$(?:\n|$)/gm, '')

  // Collapse multiple consecutive blank lines to one
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}
