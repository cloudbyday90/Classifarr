/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { tmdbService as defaultTmdbService } from './tmdb.mjs';
import { resolveTmdbExternalIdentity } from './tmdbExternalIdentityResolution.mjs';
import { buildTmdbTitleRequest, decideTmdbTitleMatch } from './tmdbTitleMatch.mjs';
import { sourceIdentityRecoveryEvidence } from './sourceIdentityRecoveryEvidence.mjs';
import { recoveredIdentity, reusableIdentityRecoveryReceipt } from './sourceIdentityRecoveryReceipt.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { randomUUID } from 'node:crypto';
import { SOURCE_RECOVERY_ATTEMPT_LIMIT } from './mediaSyncRecoveryPlan.mjs';

/** @type {(item: object, attemptId: string) => Promise<boolean>} */
const allowAttempt = async () => true;
/** @type {(item: object) => Promise<any>} */
const noReceipt = async () => null;
const noOutcome = async (_item, _outcome) => {};

/** One bounded recovery session per library sync; all provider IO precedes writes. */
export function createMediaSyncIdentityRecovery({ tmdbService = defaultTmdbService, maximumAttempts = SOURCE_RECOVERY_ATTEMPT_LIMIT } = {}) {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 32) {
    throw new TypeError('Invalid source identity recovery attempt bound');
  }
  let attempts = 0;
  return Object.freeze({
    async recover(item, { service, url, apiKey, libraryKey, claimAttempt = allowAttempt, readReceipt = noReceipt,
      recordOutcome = noOutcome, signal = null }) {
      signal?.throwIfAborted();
      if (item?.provider_identity_invalid !== true || item.provider_identity_issue !== 'conflicting_provider_ids') return null;
      item = structuredClone(item);
      const evidence = sourceIdentityRecoveryEvidence(item, libraryKey, item.source_identity_evidence?.providerIds);
      if (!evidence || evidence.snapshotDigest !== item.source_identity_evidence?.snapshotDigest) return null;
      let attemptId = null;
      const defer = async reason => {
        signal?.throwIfAborted();
        // The production recorder emits a deduplicated warning on storage errors.
        // An observer must never approve recovery or disrupt sync.
        try { await recordOutcome(item, { reason, attemptId }); } catch { /* diagnostic only */ }
        signal?.throwIfAborted();
        return null;
      };
      if (typeof service?.getLibraryItemIdentityEvidence !== 'function') return defer('adapter_unsupported');
      const ids = evidence.providerIds;
      // TVDB is not a supported movie lookup source. Keep a disputed movie TVDB
      // value unset, never choose one; establish its canonical identity via IMDb.
      if (!ids.tmdb_id.length || ids.imdb_id.length !== 1 ||
          (item.media_type === 'tv' && ids.tvdb_id.length > 1)) return defer('insufficient_evidence');
      let failureReason = 'internal_error';
      try {
        const receipt = await readReceipt(item);
        signal?.throwIfAborted();
        if (reusableIdentityRecoveryReceipt(receipt, evidence)) {
          failureReason = 'source_unavailable';
          const current = await service.getLibraryItemIdentityEvidence(url, apiKey, libraryKey, item.external_id, { signal });
          signal?.throwIfAborted();
          return current?.mediaType === item.media_type && current?.snapshotDigest === evidence.snapshotDigest
            ? recoveredIdentity(item, evidence, receipt.tmdb_id, receipt.verified_at)
            : defer(current ? 'source_changed' : 'source_unavailable');
        }
        if (attempts >= maximumAttempts) return null;
        const token = randomUUID();
        const claimed = await claimAttempt(item, token);
        signal?.throwIfAborted();
        if (!claimed) return null;
        attemptId = token;
        attempts++;
        failureReason = 'provider_unavailable';
        const resolution = await resolveTmdbExternalIdentity({ media_type: item.media_type,
          imdb_id: ids.imdb_id[0],
          ...(item.media_type === 'tv' && ids.tvdb_id.length ? { tvdb_id: ids.tvdb_id[0] } : {}),
        }, {}, tmdbService, { signal });
        signal?.throwIfAborted();
        if (resolution.status !== 'resolved') {
          const reason = resolution.reason === 'provider_unavailable' ? 'provider_unavailable'
            : resolution.reason === 'invalid_response' ? 'provider_response_invalid'
              : resolution.reason === 'conflicting_external_ids' ? 'external_ids_disagree' : 'external_evidence_inconclusive';
          return defer(reason);
        }
        if (!ids.tmdb_id.includes(resolution.tmdbId)) return defer('candidate_not_supported');
        const details = await tmdbService.getIdentityDetails(resolution.tmdbId, item.media_type, { signal });
        signal?.throwIfAborted();
        if (positiveDatabaseInteger(details?.id) !== resolution.tmdbId) return defer('provider_response_invalid');
        const match = decideTmdbTitleMatch(buildTmdbTitleRequest(item.title, item.media_type, item.year),
          { page: 1, total_pages: 1, total_results: 1, results: [details] });
        if (match.tmdbId !== resolution.tmdbId) return defer(match.reason === 'invalid_response'
          ? 'provider_response_invalid' : 'title_year_mismatch');
        failureReason = 'source_unavailable';
        const current = await service.getLibraryItemIdentityEvidence(url, apiKey, libraryKey, item.external_id, { signal });
        signal?.throwIfAborted();
        if (current?.mediaType !== item.media_type || current?.snapshotDigest !== evidence.snapshotDigest) {
          return defer(current ? 'source_changed' : 'source_unavailable');
        }
        return { ...recoveredIdentity(item, evidence, resolution.tmdbId), attemptId };
      } catch { signal?.throwIfAborted(); return defer(failureReason); }
    },
  });
}
