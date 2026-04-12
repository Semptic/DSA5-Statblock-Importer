import { readFileSync } from 'fs'

export function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n(?:stats|fluff|gossip):|$)`))
  return match ? match[1].trim() : ''
}
