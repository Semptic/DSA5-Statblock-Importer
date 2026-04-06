/**
 * Splits a fixture file into its stats/fluff/gossip sections.
 * Section headers are lines containing exactly "stats:", "fluff:", or "gossip:".
 * Returns [stats, fluff, gossip] — sections absent from the file are undefined.
 */
export function splitFixtureSections(text) {
  const sections = { stats: undefined, fluff: undefined, gossip: undefined }
  // Split on section header lines; capturing group keeps the header in the parts array
  const parts = text.split(/^(stats|fluff|gossip):$/m)
  // parts = ['', 'stats', '\ncontent\n', 'fluff', '\ncontent\n', ...]
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i]
    const content = (parts[i + 1] ?? '').trim()
    if (content) sections[key] = content
  }
  return [sections.stats, sections.fluff, sections.gossip]
}

/**
 * Asserts that a Foundry actor object matches the expected shape.
 * Uses partial deep-equal: only keys present in `expected` are checked.
 * Items are matched by name+type; item order is not asserted.
 *
 * @param {object} actual - actor.toObject() result from Foundry
 * @param {object} expected - expected-e2e JSON fixture
 * @param {Function} expect - the `expect` function from @playwright/test
 */
export function assertActor(actual, expected, expect) {
  // Name
  expect(actual.name).toBe(expected.name)

  // Characteristics (advances)
  for (const [key, val] of Object.entries(expected.system?.characteristics ?? {})) {
    expect(
      actual.system.characteristics[key]?.advances,
      `characteristics.${key}.advances`
    ).toBe(val.advances)
  }

  // Status fields
  for (const [key, val] of Object.entries(expected.system?.status ?? {})) {
    for (const [field, fieldVal] of Object.entries(val)) {
      expect(
        actual.system.status[key]?.[field],
        `status.${key}.${field}`
      ).toBe(fieldVal)
    }
  }

  // Embedded items
  for (const expectedItem of expected.items ?? []) {
    const match = (actual.items ?? []).find(
      i => i.name === expectedItem.name && i.type === expectedItem.type
    )
    expect(match, `item "${expectedItem.name}" (${expectedItem.type}) missing`).toBeTruthy()
    if (match && expectedItem.system?.talentValue?.value !== undefined) {
      expect(
        match.system?.talentValue?.value,
        `"${expectedItem.name}" talentValue.value`
      ).toBe(expectedItem.system.talentValue.value)
    }
  }
}
