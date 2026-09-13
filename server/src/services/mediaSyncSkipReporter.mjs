/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';

export const PLEX_IDENTITY_ISSUE_REFERENCE = Object.freeze({
  title: 'Plex: duplicate provider IDs in metadata',
  url: 'https://forums.plex.tv/t/double-plex-guids-validation-for-movies-series-and-episodes/882863',
});
const REASONS = ['invalid_source_identity', 'concurrent_source_change'];
const ISSUES = ['conflicting_provider_ids', 'invalid_provider_ids', 'invalid_media_type', 'invalid_external_id', 'invalid_media_server_id'];
const WARN_AFTER = `state.summary IS DISTINCT FROM EXCLUDED.summary
  OR state.media_server_id<>EXCLUDED.media_server_id OR state.last_warned_at IS NULL
  OR state.last_warned_at<=statement_timestamp()-INTERVAL '1 day'`;

function counts(input, keys) {
  const result = {};
  for (const key of keys) {
    const count = input?.[key];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count < 1 || count > 2147483647) throw new TypeError('Invalid skip count');
    result[key] = count;
  }
  return result;
}

/** Operational notification policy only; never changes source identity authority. */
export function createMediaSyncSkipReporter({ query, logger }) {
  return Object.freeze({
    async report({ libraryId, mediaServerId, syncStatusId, incremental, sourceType }, input) {
      if (![libraryId, mediaServerId, syncStatusId].every(positiveDatabaseInteger)) return;
      let summary = null;
      if (input !== null) {
        try {
          summary = { skippedItemCount: input.skippedItemCount,
            reasonCounts: counts(input.reasonCounts, REASONS), identityIssueCounts: counts(input.identityIssueCounts, ISSUES) };
          if (!Number.isSafeInteger(summary.skippedItemCount) || summary.skippedItemCount < 1 ||
              Object.values(summary.reasonCounts).reduce((sum, count) => sum + count, 0) !== summary.skippedItemCount ||
              Object.values(summary.identityIssueCounts).reduce((sum, count) => sum + count, 0) >
                (summary.reasonCounts.invalid_source_identity ?? 0)) return;
        } catch { return; }
      }
      let notify = false, fallback = false;
      try {
        const result = await query(`INSERT INTO media_sync_warning_state AS state
          (library_id,media_server_id,sync_type,last_sync_id,summary,last_warned_at,last_warning_sync_id)
          VALUES ($1,$2,$3,$4,$5::jsonb,CASE WHEN $5 IS NOT NULL THEN statement_timestamp() END,
            CASE WHEN $5 IS NOT NULL THEN $4::integer END)
          ON CONFLICT (library_id,sync_type) DO UPDATE SET
            media_server_id=EXCLUDED.media_server_id,last_sync_id=EXCLUDED.last_sync_id,summary=EXCLUDED.summary,
            last_warned_at=CASE WHEN EXCLUDED.summary IS NULL THEN NULL WHEN ${WARN_AFTER}
              THEN statement_timestamp() ELSE state.last_warned_at END,
            last_warning_sync_id=CASE WHEN EXCLUDED.summary IS NULL THEN NULL WHEN ${WARN_AFTER}
              THEN EXCLUDED.last_sync_id ELSE state.last_warning_sync_id END
          WHERE state.last_sync_id<EXCLUDED.last_sync_id
          RETURNING summary IS NOT NULL AND last_warning_sync_id=last_sync_id AS should_warn`,
        [libraryId, mediaServerId, incremental ? 'incremental' : 'full', syncStatusId, summary ? JSON.stringify(summary) : null]);
        notify = result.rows[0]?.should_warn === true;
      } catch { notify = Boolean(summary); fallback = true; }
      if (!notify) return;
      const data = { libraryId, ...summary,
        recovery: 'Unresolved items remain excluded; scheduled syncs retry recovery when due.',
        ...(sourceType === 'plex' && summary.identityIssueCounts.conflicting_provider_ids
          ? { reference: PLEX_IDENTITY_ISSUE_REFERENCE } : {}),
      };
      try {
        await logger.warn('Library sync skipped source items', data, fallback
          ? { dedupeKey: `sync-skips:${libraryId}:${JSON.stringify(summary)}`, dedupeWindowMs: 86400000 } : {});
      } catch { /* Logging must not turn a completed sync into a failed import. */ }
    },
  });
}
