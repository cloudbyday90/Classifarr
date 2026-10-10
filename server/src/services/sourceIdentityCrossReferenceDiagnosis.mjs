/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import {
  copyCrossReferenceEvidence, crossReferenceRequests, inspectCrossReferenceResponse, summarizeCrossReferences,
} from './sourceIdentityCrossReferenceEvidence.mjs';

export const SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS = Object.freeze({
  maximumObservations: 12, maximumObservationsPerLibrary: 4, libraryLimit: 12, retentionDays: 30,
  maximumLookupsPerObservation: 4, timeoutMs: 120000,
});
const VERSION = 'source_identity_cross_reference_diagnosis.v1';
const PROVIDER_FIELDS = new Set(['tmdb_id', 'imdb_id', 'tvdb_id']);

async function inspectOne(row, { getMediaServerService, tmdbService, signal }) {
  const fields = row?.provider_fields;
  if (!Array.isArray(fields) || !fields.length || fields.some(field => !PROVIDER_FIELDS.has(field)) ||
      !['tv', 'movie'].includes(row.media_type) ||
      ['external_id', 'library_external_id', 'media_server_type', 'url', 'api_key'].some(key =>
        typeof row[key] !== 'string' || !row[key])) return { outcome: 'source_evidence_invalid' };
  let service;
  try { service = getMediaServerService(row.media_server_type); } catch { /* fixed result below */ }
  if (typeof service?.getLibraryItemIdentityEvidence !== 'function') return { outcome: 'source_service_unavailable' };
  const readSource = async () => {
    signal.throwIfAborted();
    const result = await service.getLibraryItemIdentityEvidence(
      row.url, row.api_key, row.library_external_id, row.external_id, { signal },
    );
    signal.throwIfAborted();
    return copyCrossReferenceEvidence(result);
  };
  let evidence;
  try { evidence = await readSource(); } catch {
    signal.throwIfAborted();
    return { outcome: 'source_read_unavailable' };
  }
  if (!evidence) return { outcome: 'source_evidence_invalid' };
  if (evidence.mediaType !== row.media_type) return { outcome: 'source_media_type_changed' };
  if (!fields.some(field => evidence.providerIds[field].length > 1)) return { outcome: 'source_conflict_no_longer_present' };
  if (!evidence.providerIds.tmdb_id.length) return { outcome: 'no_tmdb_candidate' };
  const requests = crossReferenceRequests(evidence);
  if (!requests.length) return { outcome: 'external_evidence_absent' };
  if (requests.length > SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS.maximumLookupsPerObservation) {
    return { outcome: 'lookup_budget_exceeded' };
  }
  const findings = [];
  for (const request of requests) {
    signal.throwIfAborted();
    let response;
    try {
      response = await tmdbService.findIdentityByExternalId(request.externalId, request.source, { signal });
    } catch {
      signal.throwIfAborted();
      return { outcome: 'provider_unavailable' };
    }
    signal.throwIfAborted();
    findings.push(inspectCrossReferenceResponse(evidence.mediaType, response));
  }
  let fresh;
  try { fresh = await readSource(); } catch {
    signal.throwIfAborted();
    return { outcome: 'source_read_unavailable' };
  }
  if (JSON.stringify(fresh) !== JSON.stringify(evidence)) return { outcome: 'source_changed' };
  return summarizeCrossReferences(evidence, findings);
}

/** Diagnostic reads only. This deliberately has no write, claim or recovery dependencies. */
export function createSourceIdentityCrossReferenceDiagnosis({ readRows, getMediaServerService, tmdbService }) {
  if (typeof readRows !== 'function' || typeof getMediaServerService !== 'function' ||
      typeof tmdbService?.findIdentityByExternalId !== 'function') throw new TypeError('invalid_cross_reference_dependencies');
  return Object.freeze({
    async replay({ signal: callerSignal } = {}) {
      const deadline = AbortSignal.timeout(SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS.timeoutMs);
      const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
      const result = { version: VERSION, reference: randomUUID(), status: { id: 'failed' }, summary: null };
      let summary;
      try {
        signal.throwIfAborted();
        const rows = await readRows(SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS);
        signal.throwIfAborted();
        if (!Array.isArray(rows) || rows.length > SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS.maximumObservations) {
          throw new Error('invalid_cross_reference_window');
        }
        // The existing query returns a null-library anchor when the window is empty.
        const selected = rows.filter(row => row?.library_id !== null);
        const perLibrary = new Map();
        for (const row of selected) {
          if (!Number.isSafeInteger(row?.library_id) || row.library_id < 1) throw new Error('invalid_cross_reference_window');
          const count = (perLibrary.get(row.library_id) ?? 0) + 1;
          if (count > SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS.maximumObservationsPerLibrary) throw new Error('invalid_cross_reference_window');
          perLibrary.set(row.library_id, count);
        }
        summary = { selectedObservations: selected.length, inspectedObservations: 0,
          limits: SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS, outcomes: {},
          stableEvidenceLookups: { lookups: 0, matched: 0, notFound: 0, reviewRequired: 0, lookupsWithOtherMediaResults: 0 } };
        for (const row of selected) {
          signal.throwIfAborted();
          const finding = await inspectOne(row, { getMediaServerService, tmdbService, signal });
          summary.outcomes[finding.outcome] = (summary.outcomes[finding.outcome] ?? 0) + 1;
          summary.inspectedObservations += 1;
          for (const key of Object.keys(summary.stableEvidenceLookups)) summary.stableEvidenceLookups[key] += finding[key] ?? 0;
        }
        result.status.id = selected.length ? 'complete' : 'no_current_conflicts';
      } catch {
        result.status.id = signal.aborted ? (callerSignal?.aborted ? 'cancelled' : 'timed_out') : 'failed';
      }
      result.summary = summary ?? null;
      return result;
    },
  });
}
