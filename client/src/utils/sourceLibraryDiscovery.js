/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function parseSourceLibraryDiscovery(value) {
  if (value?.version !== 'source_library_discovery.v1' || value.admission !== 'read_only' ||
      typeof value.truncated !== 'boolean' ||
      !Array.isArray(value.libraries) || value.libraries.length > 64) return null
  const ids = new Set()
  const libraries = []
  for (const row of value.libraries) {
    if (!Number.isSafeInteger(row?.id) || row.id < 1 || ids.has(row.id) ||
        typeof row.name !== 'string' || !row.name.trim() || [...row.name].length > 255 ||
        row.mediaType !== 'music' || typeof row.isPresent !== 'boolean' ||
        typeof row.firstSeenAt !== 'string' || !Number.isFinite(Date.parse(row.firstSeenAt)) ||
        typeof row.lastSeenAt !== 'string' || !Number.isFinite(Date.parse(row.lastSeenAt))) return null
    ids.add(row.id)
    libraries.push({ id: row.id, name: row.name, mediaType: 'music', isPresent: row.isPresent,
      firstSeenAt: row.firstSeenAt, lastSeenAt: row.lastSeenAt })
  }
  return { version: 'source_library_discovery.v1', admission: 'read_only',
    truncated: value.truncated, libraries }
}
