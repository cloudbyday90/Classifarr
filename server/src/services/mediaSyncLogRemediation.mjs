/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { createPlexLogItemLinks } from './plexLogItemLinks.mjs';

const MAX_ITEMS = 50;
const CATALOGS = { tmdb_id: 'TMDb', tvdb_id: 'TVDB', imdb_id: 'IMDb' };
const ISSUES = ['conflicting_provider_ids', 'invalid_provider_ids', 'invalid_media_type'];
const STEPS = Object.freeze([
  'Open the affected item in Plex using its link below, and sign in with the account that manages that server. Without a link, search for the title in the listed library.',
  'Check the title and year. If the match is wrong, choose More (the three dots) > Fix Match and select the correct result. For TV, do this on the show, not a season or episode.',
  'If the match is already correct, choose More > Refresh Metadata and wait for Plex to finish.',
  'Let the next scheduled Classifarr library sync run. It retries recovery when due and imports the item once its identity is unambiguous. Rebuilding Classifarr is not needed.',
  'If the conflict remains, leave the item excluded while scheduled retries continue. A Plex or upstream catalog correction may still be needed; do not delete your media or guess which ID to keep.',
]);

function label(value, fallback) {
  return typeof value === 'string' && value.trim()
    ? value.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 500) || fallback : fallback;
}

function explain(row) {
  const providers = Array.isArray(row.provider_fields)
    ? [...new Set(row.provider_fields.filter(field => Object.hasOwn(CATALOGS, field)).map(field => CATALOGS[field]))] : [];
  const catalog = providers.length ? ` (${providers.join(', ')})` : '';
  if (row.identity_issue === 'conflicting_provider_ids') {
    return `Plex returned more than one ID for the same catalog${catalog}. Classifarr cannot safely tell which metadata belongs to this item.`;
  }
  if (row.identity_issue === 'invalid_media_type') return 'Plex did not identify this item as a supported movie or TV show.';
  return `Plex returned an invalid catalog ID${catalog}. Classifarr cannot safely identify this item.`;
}

function projection(status, items = [], truncated = false) {
  return {
    status, items, truncated, steps: [...STEPS],
    explanation: 'Plex supplied conflicting or invalid item metadata. Classifarr skipped these items to avoid importing them under the wrong identity. Your media files have not been deleted.',
    scope: 'Current unresolved items associated with this warning; this is not a saved snapshot of the original event.',
    linkStatus: items.length && items.some(item => !item.plexUrl) ? 'pending' : 'complete',
    recovery: 'Missing Plex links are checked again when this report refreshes. A restored link does not mean the metadata conflict is fixed.',
    privacy: 'This report includes media titles and Plex item links. Review it before sharing publicly.',
  };
}

/** Enrich old and new events at read time; never mutate logs or source metadata. */
export function createMediaSyncLogRemediation({ query, resolveLinks = createPlexLogItemLinks() }) {
  return async function enrich(log) {
    const metadata = log.metadata;
    const issues = ISSUES.filter(issue => Number.isSafeInteger(metadata?.identityIssueCounts?.[issue]) && metadata.identityIssueCounts[issue] > 0);
    if (log.module !== 'mediaSync' || log.message !== 'Library sync skipped source items' ||
        !positiveDatabaseInteger(metadata?.libraryId) || !issues.length) return log;
    let remediation;
    try {
      const { rows } = await query(`SELECT o.external_id,o.title,o.year,o.media_type,o.identity_issue,o.provider_fields,
          l.name AS library_name,ms.id AS server_id,ms.url,ms.api_key
        FROM media_source_observations o
        JOIN libraries l ON l.id=o.library_id AND l.media_server_id=o.media_server_id
        JOIN media_server ms ON ms.id=o.media_server_id
        JOIN error_log e ON e.error_id=$1
        WHERE o.library_id=$2 AND ms.type='plex' AND ms.is_active=true AND l.is_active=true
          AND ($3::integer IS NULL OR ms.id=$3) AND o.identity_issue=ANY($4::text[])
          AND o.first_seen_at<=e.created_at AND l.created_at<=e.created_at
          AND o.last_seen_at>=statement_timestamp()-INTERVAL '30 days'
        ORDER BY o.external_id LIMIT 51`,
      [log.error_id, metadata.libraryId, positiveDatabaseInteger(metadata.mediaServerId) ? metadata.mediaServerId : null, issues]);
      const retained = rows.slice(0, MAX_ITEMS);
      let links = [];
      if (retained.length) {
        const { server_id: id, url, api_key } = retained[0];
        try { links = await resolveLinks({ id, url, api_key }, retained.map(row => row.external_id)); } catch { /* Retry on the next read. */ }
      }
      const items = retained.map((row, index) => ({
        sourceId: String(row.external_id),
        title: label(row.title, 'Untitled Plex item'),
        year: Number.isInteger(row.year) && row.year > 0 && row.year <= 9999 ? row.year : null,
        mediaType: row.media_type === 'movie' ? 'Movie' : row.media_type === 'tv' ? 'TV show' : 'Unknown type',
        library: label(row.library_name, 'Plex library'),
        issue: explain(row), plexUrl: links[index] ?? null,
      }));
      remediation = projection(items.length ? 'unresolved' : 'no_current_records', items, rows.length > MAX_ITEMS);
    } catch {
      remediation = projection('unavailable');
    }
    // Supersede the old forum pointer in the read projection, not stored history.
    const { reference: _reference, ...currentMetadata } = metadata;
    return { ...log, metadata: currentMetadata, remediation };
  };
}
