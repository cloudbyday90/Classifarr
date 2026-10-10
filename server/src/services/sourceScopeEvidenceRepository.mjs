/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { COMPLETE_SOURCE_CAPTURES_CTE, CURRENT_SOURCE_ISSUE_JOIN } from './sourceIdentityIssueScope.mjs';

/** Private, bounded page in precisely the same order as the public issue list. */
export async function readScopeEvidenceTarget(db, key, offset) {
  const { rows } = await db.query( // sql-interpolation: imported constant SQL fragments only; caller values use parameters.
    `WITH ${COMPLETE_SOURCE_CAPTURES_CTE}
    SELECT o.library_id, o.media_server_id, o.external_id, o.media_type, o.source_digest, o.provider_fields,
      o.xmin::text AS observation_revision, c.capture_revision, l.xmin::text AS library_revision,
      l.external_id AS library_external_id, s.xmin::text AS server_revision,
      s.type AS server_type, s.url, s.api_key, s.is_active,
      (SELECT jsonb_build_object('id',t.id,'revision',t.xmin::text,'active',t.is_active,'key',t.api_key)
       FROM tmdb_config t ORDER BY (t.is_active IS TRUE) DESC,t.id DESC LIMIT 1) AS catalog_config
    ${CURRENT_SOURCE_ISSUE_JOIN}
    JOIN libraries l ON l.id=o.library_id JOIN media_server s ON s.id=o.media_server_id
    ORDER BY o.library_id,o.media_server_id,o.external_id LIMIT 50 OFFSET $1`, [offset]);
  return rows.find(row => createHash('sha256').update(JSON.stringify([
    row.library_id, row.media_server_id, row.external_id,
  ])).digest('hex') === key) ?? null;
}
