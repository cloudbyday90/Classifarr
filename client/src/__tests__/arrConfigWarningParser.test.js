/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { parseArrConfigWarnings } from '../utils/arrConfigWarning'

const valid = { id: 1, type: 'Radarr', name: 'Movies', missingField: 'quality_profile_id' }
const parse = (...incompleteConfigs) => parseArrConfigWarnings({ incompleteConfigs })

describe('Arr warning response boundary', () => {
  it.each([undefined, null, false, 1, '', [], {}, { incompleteConfigs: null }, { incompleteConfigs: {} }])(
    'rejects malformed envelopes %j', value => expect(parseArrConfigWarnings(value)).toEqual([]),
  )

  it.each([
    null, [], 42, 'Radarr', {},
    { ...valid, type: 'Lidarr' }, { ...valid, type: 'radarr' },
    { ...valid, missingField: 'root_folder' }, { ...valid, missingField: undefined },
    ...[undefined, null, '1', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(id => ({ ...valid, id })),
    { ...valid, name: {} }, { ...valid, name: 12 },
  ])('rejects unsupported or malformed rows %j without dropping valid neighbors', value => {
    expect(parse(value, valid)).toEqual([{ id: 1, type: 'Radarr', name: 'Movies', route: '/settings/radarr' }])
  })

  it.each([undefined, null, '', '   '])('uses a deterministic fallback for absent names %j', name => {
    expect(parse({ ...valid, name })[0].name).toBe('Radarr 1')
  })

  it('ignores payload destinations, trims names and deduplicates only within a provider', () => {
    expect(parse(
      { ...valid, name: '  First  ', route: 'https://example.invalid/' },
      { ...valid, name: 'Duplicate' }, { ...valid, type: 'Sonarr' },
    )).toEqual([
      { id: 1, type: 'Radarr', name: 'First', route: '/settings/radarr' },
      { id: 1, type: 'Sonarr', name: 'Movies', route: '/settings/sonarr' },
    ])
  })
})
