/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, it } from 'vitest'
import { parseSourceLibraryDiscovery } from '@/utils/sourceLibraryDiscovery'

const row = { id: 3, name: 'Music', mediaType: 'music', isPresent: true,
  firstSeenAt: '2026-09-24T10:00:00Z', lastSeenAt: '2026-09-24T11:00:00Z' }
const report = { version: 'source_library_discovery.v1', admission: 'read_only',
  truncated: false, libraries: [row] }

describe('source library discovery contract', () => {
  it('allowlists read-only section fields', () => {
    expect(parseSourceLibraryDiscovery({ ...report, libraries: [{ ...row, external_id: 'private' }] }))
      .toEqual(report)
  })

  it('rejects malformed or duplicated discovery rows', () => {
    expect(parseSourceLibraryDiscovery({ ...report, admission: 'routing_inventory' })).toBeNull()
    expect(parseSourceLibraryDiscovery({ ...report, libraries: [row, row] })).toBeNull()
    expect(parseSourceLibraryDiscovery({ ...report, libraries: [{ ...row, mediaType: 'movie' }] })).toBeNull()
    expect(parseSourceLibraryDiscovery({ ...report, libraries: [{ ...row, firstSeenAt: 'bad' }] })).toBeNull()
  })
})
