/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { getMediaServerService as defaultGetMediaServerService } from './mediaServers/index.mjs';
import { resolveTmdbExternalIdentity } from './tmdbExternalIdentityResolution.mjs';
import { tmdbService as defaultTmdbService } from './tmdb.mjs';

export const SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION = 'source_identity_external_evidence_replay.v1';
export const SOURCE_IDENTITY_EVIDENCE_REPLAY_LIMITS = Object.freeze({
  maximumObservations: 32,
  maximumObservationsPerLibrary: 8,
  retentionDays: 30,
});

const OUTCOME_IDS = Object.freeze([
  'exact_candidate_agreement',
  'external_evidence_absent',
  'external_evidence_conflicting',
  'no_tmdb_candidate',
  'not_found',
  'resolved_not_current_candidate',
  'review_required',
  'source_conflict_no_longer_present',
  'source_evidence_invalid',
  'source_item_unavailable',
  'source_media_type_changed',
  'source_read_unavailable',
  'source_service_unavailable',
]);

const RESOLUTION_REASONS = Object.freeze([
  'ambiguous_external_id',
  'conflicting_external_ids',
  'duplicate_external_results',
  'external_id_not_found',
  'external_id_match',
  'external_ids_agree',
  'external_result_limit',
  'incomplete_external_evidence',
  'invalid_external_id',
  'invalid_media_identity',
  'invalid_response',
  'provider_unavailable',
]);
const MAXIMUM_CANDIDATES_PER_PROVIDER = 20;

const SELECT_CURRENT_CONFLICTS = `WITH current_conflicts AS MATERIALIZED (
  SELECT o.library_id, o.media_server_id, o.external_id, o.media_type, o.provider_fields,
    l.external_id AS library_external_id, server.type AS media_server_type, server.url, server.api_key,
    row_number() OVER (PARTITION BY o.library_id ORDER BY o.last_seen_at DESC, o.external_id) AS library_rank
  FROM media_source_observations AS o
  JOIN libraries AS l ON l.id=o.library_id AND l.media_server_id=o.media_server_id AND l.is_active=true
  JOIN media_source_capture_state AS capture ON capture.library_id=o.library_id
    AND capture.media_server_id=o.media_server_id AND capture.generation=o.generation
  JOIN media_server AS server ON server.id=o.media_server_id AND server.is_active=true
  WHERE o.identity_issue='conflicting_provider_ids'
    AND o.last_seen_at >= statement_timestamp()-$3::integer*INTERVAL '1 day'
    AND capture.phase='complete' AND capture.mode='full'
    AND capture.omitted_count=0 AND capture.uncapturable_count=0
)
SELECT library_id, media_server_id, external_id, media_type, provider_fields, library_external_id,
  media_server_type, url, api_key
FROM current_conflicts
WHERE library_rank <= $1::integer
ORDER BY library_id, media_server_id, external_id
LIMIT $2::integer`;

function fixedCounts(ids) {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function orderedNonzero(counts) {
  return Object.freeze(Object.fromEntries(Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))));
}

function increment(counts, id) {
  if (!Object.hasOwn(counts, id)) throw new Error('invalid_source_identity_evidence_replay_outcome');
  counts[id] += 1;
}

function normalizedProviderFields(providerFields) {
  if (!Array.isArray(providerFields)) return null;
  const allowed = new Set(['tmdb_id', 'imdb_id', 'tvdb_id']);
  const fields = [...new Set(providerFields)];
  return fields.length > 0 && fields.every((field) => allowed.has(field)) ? fields : null;
}

function candidateArray(providerIds, field) {
  const candidates = providerIds?.[field];
  const validCandidate = field === 'imdb_id'
    ? (candidate) => typeof candidate === 'string' && /^tt[0-9]{1,12}$/u.test(candidate)
    : (candidate) => Number.isSafeInteger(candidate) && candidate > 0;
  return Array.isArray(candidates) && candidates.length <= MAXIMUM_CANDIDATES_PER_PROVIDER &&
    new Set(candidates).size === candidates.length && candidates.every(validCandidate) ? candidates : null;
}

function currentConflictStillPresent(providerIds, providerFields) {
  return providerFields.some((field) => candidateArray(providerIds, field)?.length > 1);
}

function buildResolutionPayload(mediaType, providerIds) {
  const tmdbIds = candidateArray(providerIds, 'tmdb_id');
  const imdbIds = candidateArray(providerIds, 'imdb_id');
  const tvdbIds = candidateArray(providerIds, 'tvdb_id');
  if (!tmdbIds || !imdbIds || !tvdbIds) return null;
  if (!tmdbIds.length) return Object.freeze({ outcome: 'no_tmdb_candidate' });
  if (imdbIds.length > 1 || tvdbIds.length > 1) return Object.freeze({ outcome: 'external_evidence_conflicting' });
  const payload = Object.freeze({
    media_type: mediaType,
    ...(imdbIds.length ? { imdb_id: imdbIds[0] } : {}),
    ...(tvdbIds.length ? { tvdb_id: tvdbIds[0] } : {}),
  });
  if (!Object.hasOwn(payload, 'imdb_id') && !Object.hasOwn(payload, 'tvdb_id')) {
    return Object.freeze({ outcome: 'external_evidence_absent' });
  }
  return Object.freeze({ payload, tmdbIds: Object.freeze([...new Set(tmdbIds)]) });
}

async function replayOne(row, { getMediaServerService, tmdbService }) {
  const providerFields = normalizedProviderFields(row?.provider_fields);
  if (!providerFields || typeof row?.external_id !== 'string' || typeof row?.library_external_id !== 'string' ||
      typeof row?.media_type !== 'string' || typeof row?.media_server_type !== 'string' ||
      typeof row?.url !== 'string' || typeof row?.api_key !== 'string') return { outcome: 'source_evidence_invalid' };

  let service;
  try {
    service = getMediaServerService(row.media_server_type);
  } catch {
    return { outcome: 'source_service_unavailable' };
  }
  if (!service || typeof service.getLibraryItemIdentityEvidence !== 'function') {
    return { outcome: 'source_service_unavailable' };
  }

  let evidence;
  try {
    evidence = await service.getLibraryItemIdentityEvidence(row.url, row.api_key, row.library_external_id, row.external_id);
  } catch {
    return { outcome: 'source_read_unavailable' };
  }
  if (!evidence) return { outcome: 'source_item_unavailable' };
  if (evidence.mediaType !== row.media_type) return { outcome: 'source_media_type_changed' };
  if (!currentConflictStillPresent(evidence.providerIds, providerFields)) {
    return { outcome: 'source_conflict_no_longer_present' };
  }

  const input = buildResolutionPayload(evidence.mediaType, evidence.providerIds);
  if (!input) return { outcome: 'source_evidence_invalid' };
  if (input.outcome) return input;
  const resolution = await resolveTmdbExternalIdentity(input.payload, {}, tmdbService);
  if (resolution.status === 'resolved') {
    return Object.freeze({
      outcome: input.tmdbIds.includes(resolution.tmdbId)
        ? 'exact_candidate_agreement'
        : 'resolved_not_current_candidate',
      resolutionReason: resolution.reason,
    });
  }
  return Object.freeze({
    outcome: resolution.status === 'not_found' ? 'not_found' : 'review_required',
    resolutionReason: resolution.reason,
  });
}

/**
 * Re-evaluates a small, fair sample of current source conflicts. It reads the
 * source and TMDb only; it never persists evidence, changes source metadata,
 * updates a media item, selects AI work, or routes media.
 */
export function createSourceIdentityExternalEvidenceReplay({
  query = db.query,
  getMediaServerService = defaultGetMediaServerService,
  tmdbService = defaultTmdbService,
  limits = SOURCE_IDENTITY_EVIDENCE_REPLAY_LIMITS,
} = {}) {
  if (typeof query !== 'function' || typeof getMediaServerService !== 'function' || !tmdbService ||
      !Number.isInteger(limits.maximumObservations) || limits.maximumObservations < 1 ||
      !Number.isInteger(limits.maximumObservationsPerLibrary) || limits.maximumObservationsPerLibrary < 1 ||
      !Number.isInteger(limits.retentionDays) || limits.retentionDays < 1) {
    throw new Error('invalid_source_identity_evidence_replay_dependencies');
  }

  return Object.freeze({
    async replay() {
      try {
        const { rows } = await query(SELECT_CURRENT_CONFLICTS, [
          limits.maximumObservationsPerLibrary,
          limits.maximumObservations,
          limits.retentionDays,
        ]);
        if (!Array.isArray(rows)) throw new Error('invalid_source_identity_evidence_replay_rows');
        const outcomes = fixedCounts(OUTCOME_IDS);
        const resolutionReasons = fixedCounts(RESOLUTION_REASONS);
        for (const row of rows) {
          const result = await replayOne(row, { getMediaServerService, tmdbService });
          increment(outcomes, result.outcome);
          if (result.resolutionReason) increment(resolutionReasons, result.resolutionReason);
        }
        return Object.freeze({
          version: SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
          status: Object.freeze({ id: rows.length ? 'complete' : 'no_current_conflicts' }),
          summary: Object.freeze({
            selectedObservationCount: rows.length,
            maximumObservations: limits.maximumObservations,
            maximumObservationsPerLibrary: limits.maximumObservationsPerLibrary,
            outcomes: orderedNonzero(outcomes),
            resolutionReasons: orderedNonzero(resolutionReasons),
          }),
        });
      } catch {
        return Object.freeze({
          version: SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
          status: Object.freeze({ id: 'failed' }),
          summary: null,
        });
      }
    },
  });
}
