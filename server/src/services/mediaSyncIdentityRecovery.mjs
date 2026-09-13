/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { tmdbService as defaultTmdbService } from './tmdb.mjs';
import { resolveTmdbExternalIdentity } from './tmdbExternalIdentityResolution.mjs';
import { buildTmdbTitleRequest, decideTmdbTitleMatch } from './tmdbTitleMatch.mjs';
import { sourceIdentityRecoveryEvidence } from './sourceIdentityRecoveryEvidence.mjs';
import { recoveredIdentity, reusableIdentityRecoveryReceipt } from './sourceIdentityRecoveryReceipt.mjs';

/** @type {(item: object) => Promise<boolean>} */
const allowAttempt = async () => true;
/** @type {(item: object) => Promise<any>} */
const noReceipt = async () => null;

/** One bounded recovery session per library sync; all provider IO precedes writes. */
export function createMediaSyncIdentityRecovery({ tmdbService = defaultTmdbService, maximumAttempts = 8 } = {}) {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 32) {
    throw new TypeError('Invalid source identity recovery attempt bound');
  }
  let attempts = 0;
  return Object.freeze({
    async recover(item, { service, url, apiKey, libraryKey, claimAttempt = allowAttempt, readReceipt = noReceipt }) {
      if (item?.provider_identity_invalid !== true || item.provider_identity_issue !== 'conflicting_provider_ids' ||
          typeof service?.getLibraryItemIdentityEvidence !== 'function') return null;
      item = structuredClone(item);
      const evidence = sourceIdentityRecoveryEvidence(item, libraryKey, item.source_identity_evidence?.providerIds);
      if (!evidence || evidence.snapshotDigest !== item.source_identity_evidence?.snapshotDigest) return null;
      const ids = evidence.providerIds;
      // TVDB is not a supported movie lookup source. Keep a disputed movie TVDB
      // value unset, never choose one; establish its canonical identity via IMDb.
      if (!ids.tmdb_id.length || ids.imdb_id.length !== 1 ||
          (item.media_type === 'tv' && ids.tvdb_id.length > 1)) return null;
      try {
        const receipt = await readReceipt(item);
        if (reusableIdentityRecoveryReceipt(receipt, evidence)) {
          const current = await service.getLibraryItemIdentityEvidence(url, apiKey, libraryKey, item.external_id);
          return current?.mediaType === item.media_type && current?.snapshotDigest === evidence.snapshotDigest
            ? recoveredIdentity(item, evidence, receipt.tmdb_id, receipt.verified_at) : null;
        }
        if (attempts >= maximumAttempts) return null;
        if (!await claimAttempt(item)) return null;
        attempts++;
        const resolution = await resolveTmdbExternalIdentity({ media_type: item.media_type,
          imdb_id: ids.imdb_id[0],
          ...(item.media_type === 'tv' && ids.tvdb_id.length ? { tvdb_id: ids.tvdb_id[0] } : {}),
        }, {}, tmdbService);
        if (resolution.status !== 'resolved' || !ids.tmdb_id.includes(resolution.tmdbId)) return null;
        const details = await tmdbService.getIdentityDetails(resolution.tmdbId, item.media_type);
        const match = decideTmdbTitleMatch(buildTmdbTitleRequest(item.title, item.media_type, item.year),
          { page: 1, total_pages: 1, total_results: 1, results: [details] });
        if (match.tmdbId !== resolution.tmdbId) return null;
        const current = await service.getLibraryItemIdentityEvidence(url, apiKey, libraryKey, item.external_id);
        if (current?.mediaType !== item.media_type || current?.snapshotDigest !== evidence.snapshotDigest) return null;
        return recoveredIdentity(item, evidence, resolution.tmdbId);
      } catch { return null; }
    },
  });
}
