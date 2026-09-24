/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isReadOnlyDiscoveryLibrary } from './mediaLibraryCapabilityRegistry.mjs';

export const SOURCE_DISCOVERY_LIBRARY_LIMIT = 64;
export const SOURCE_DISCOVERY_MISSING_RETENTION_DAYS = 90;

/** Reject a partial or ambiguous source snapshot before changing stored evidence. */
export function validateReadOnlySourceLibraries(libraries) {
  if (!Array.isArray(libraries) || libraries.length > SOURCE_DISCOVERY_LIBRARY_LIMIT) {
    throw new TypeError('Invalid bounded source library discovery snapshot');
  }
  const seen = new Set();
  return libraries.map(library => {
    const externalId = library?.external_id;
    const name = library?.name;
    if (!isReadOnlyDiscoveryLibrary(library) || typeof externalId !== 'string' ||
        !externalId.trim() || externalId.includes('\0') || [...externalId].length > 100 ||
        typeof name !== 'string' || !name.trim() || [...name].length > 255 ||
        /[\p{Cc}\p{Cf}]/u.test(name) || seen.has(externalId)) {
      throw new TypeError('Invalid source library discovery entry');
    }
    seen.add(externalId);
    return { external_id: externalId, name, media_type: 'music' };
  });
}

/** An unsuccessful source request leaves the last known snapshot intact. */
export async function refreshReadOnlySourceLibraries({ db, service, server }) {
  if (typeof service?.getDiscoveryLibraries !== 'function') return null;
  const rows = validateReadOnlySourceLibraries(
    await service.getDiscoveryLibraries(server.url, server.api_key));
  await db.withTransaction(async client => {
    await client.query(`INSERT INTO media_source_discovery_libraries
      (media_server_id, external_id, name, media_type, is_present, last_seen_at)
      SELECT $1::integer, entry.external_id, entry.name, 'music', TRUE, now()
      FROM jsonb_to_recordset($2::jsonb) AS entry(external_id text, name text, media_type text)
      ON CONFLICT (media_server_id, external_id) DO UPDATE SET
        name=EXCLUDED.name, is_present=TRUE, last_seen_at=now()`,
    [server.id, JSON.stringify(rows)]);
    await client.query(`UPDATE media_source_discovery_libraries
      SET is_present=FALSE WHERE media_server_id=$1::integer
        AND is_present=TRUE AND NOT (external_id=ANY($2::text[]))`,
    [server.id, rows.map(row => row.external_id)]);
    await client.query(`DELETE FROM media_source_discovery_libraries
      WHERE media_server_id=$1::integer AND is_present=FALSE
        AND last_seen_at < now()-$2::integer*INTERVAL '1 day'`,
    [server.id, SOURCE_DISCOVERY_MISSING_RETENTION_DAYS]);
  });
  return rows.length;
}

/** Administrator-only, count-bounded read model; never returns source IDs or credentials. */
export async function readReadOnlySourceLibraries(db) {
  const { rows } = await db.query(`SELECT discovery.id, discovery.name, discovery.media_type,
      discovery.is_present, discovery.first_seen_at, discovery.last_seen_at
    FROM media_source_discovery_libraries discovery
    JOIN media_server source ON source.id=discovery.media_server_id AND source.is_active=TRUE
    ORDER BY discovery.is_present DESC, discovery.name, discovery.id
    LIMIT $1`, [SOURCE_DISCOVERY_LIBRARY_LIMIT + 1]);
  return { version: 'source_library_discovery.v1', admission: 'read_only',
    truncated: rows.length > SOURCE_DISCOVERY_LIBRARY_LIMIT,
    libraries: rows.slice(0, SOURCE_DISCOVERY_LIBRARY_LIMIT).map(row => ({ id: Number(row.id),
      name: row.name, mediaType: row.media_type, isPresent: row.is_present,
      firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at })) };
}
