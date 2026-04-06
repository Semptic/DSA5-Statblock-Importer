import { describe, it, expect } from 'vitest'
import { splitFixtureSections } from './e2e/helpers.js'

describe('splitFixtureSections', () => {
  it('splits all three sections', () => {
    const text = 'stats:\nline1\nfluff:\nline2\ngossip:\nline3'
    const [stats, fluff, gossip] = splitFixtureSections(text)
    expect(stats).toBe('line1')
    expect(fluff).toBe('line2')
    expect(gossip).toBe('line3')
  })

  it('returns undefined for missing sections', () => {
    const text = 'stats:\nonly stats here'
    const [stats, fluff, gossip] = splitFixtureSections(text)
    expect(stats).toBe('only stats here')
    expect(fluff).toBeUndefined()
    expect(gossip).toBeUndefined()
  })

  it('handles multi-line section content', () => {
    const text = 'stats:\nMU 13 KL 11\nLeP 27\nfluff:\nKurzcharakteristik: text'
    const [stats] = splitFixtureSections(text)
    expect(stats).toBe('MU 13 KL 11\nLeP 27')
  })

  it('trims trailing whitespace from each section', () => {
    const text = 'stats:\ncontent\n\nfluff:\ntext\n'
    const [stats, fluff] = splitFixtureSections(text)
    expect(stats).toBe('content')
    expect(fluff).toBe('text')
  })
})
