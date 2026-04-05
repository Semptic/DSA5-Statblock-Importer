export function parseGossip(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Header line: "Gerüchte über Name"
  const headerMatch = lines[0]?.match(/^Gerüchte über (.+)/)
  const subject = headerMatch?.[1]?.trim() ?? ''

  // Entries delimited by lines starting with »
  // Continuation lines (not starting with ») are merged into the previous entry
  const entries = []
  let current = null
  for (const line of lines.slice(headerMatch ? 1 : 0)) {
    if (line.startsWith('»')) {
      if (current !== null) entries.push({ text: current.trim() })
      // Remove the leading » and trim
      current = line.slice(1).trim()
    } else if (current !== null) {
      current += ' ' + line
    }
  }
  if (current !== null) entries.push({ text: current.trim() })

  return { subject, entries }
}
