import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

describe('fixtures', () => {
  it('jaruslaw.txt is readable', () => {
    const text = readFileSync('tests/fixtures/jaruslaw.txt', 'utf8')
    expect(text).toContain('Jaruslaw')
    expect(text).toContain('MU 13')
    expect(text).toContain('Gerüchte')
  })
})
