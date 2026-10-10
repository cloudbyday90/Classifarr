/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS } from './sourceIdentityCrossReferenceDiagnosis.mjs';
import { compareSourceCatalogLayout } from './sourceCatalogLayoutComparison.mjs';
import { inspectSourceCatalogEpisodes } from './sourceEpisodeCatalogInspection.mjs';
import { CATALOG_EPISODE_LIMITS } from './catalogEpisodeEvidence.mjs';

const LIMITS = Object.freeze({ ...SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS, maximumCandidates: 4 });
const increment = (counts, id) => { counts[id] = (counts[id] ?? 0) + 1; };

function selectedRows(rows) {
  if (!Array.isArray(rows) || rows.length > LIMITS.maximumObservations) throw new Error('invalid_preview_window');
  const selected = rows.filter(row => row?.library_id !== null);
  const perLibrary = new Map(), keys = new Set();
  for (const row of selected) {
    if (!Number.isSafeInteger(row?.library_id) || row.library_id < 1 ||
        !Number.isSafeInteger(row.media_server_id) || row.media_server_id < 1 ||
        !['movie', 'tv'].includes(row.media_type) ||
        ['external_id', 'library_external_id', 'media_server_type', 'url', 'api_key'].some(field =>
          typeof row[field] !== 'string' || !row[field])) throw new Error('invalid_preview_window');
    const count = (perLibrary.get(row.library_id) ?? 0) + 1;
    const key = JSON.stringify([row.media_server_id, row.library_id, row.external_id]);
    if (count > LIMITS.maximumObservationsPerLibrary || keys.has(key)) throw new Error('invalid_preview_window');
    keys.add(key);
    perLibrary.set(row.library_id, count);
  }
  return selected;
}

async function inspectLayout(source, tmdbService, signal) {
  const candidates = source.identity.providerIds.tmdb_id;
  if (!candidates.length) return { outcome: 'no_tmdb_candidate' };
  if (candidates.length > LIMITS.maximumCandidates) return { outcome: 'candidate_limit' };
  const comparisons = {};
  for (const id of candidates) {
    signal.throwIfAborted();
    let details;
    try { details = await tmdbService.getIdentityDetails(id, source.identity.mediaType, { signal }); } catch {
      signal.throwIfAborted();
      return { outcome: 'catalog_unavailable' };
    }
    signal.throwIfAborted();
    increment(comparisons, compareSourceCatalogLayout(source, id, details));
  }
  return { outcome: 'layout_inspected', comparisons, candidates: candidates.length };
}

async function inspect(row, { getMediaServerService, tmdbService, signal, mode, budget }) {
  let adapter;
  try { adapter = getMediaServerService(row.media_server_type); } catch { /* fixed result below */ }
  if (typeof adapter?.getLibraryItemLayout !== 'function') return { outcome: 'source_adapter_unavailable' };
  const read = () => adapter.getLibraryItemLayout(row.url, row.api_key, row.library_external_id, row.external_id, { signal });
  let source;
  try { source = await read(); } catch (error) {
    signal.throwIfAborted();
    return { outcome: error?.message === 'source_layout_invalid' ? 'source_layout_invalid' : 'source_unavailable' };
  }
  if (source?.identity?.mediaType !== row.media_type) return { outcome: 'source_type_changed' };
  const inspection = mode === 'episodes'
    ? await inspectSourceCatalogEpisodes(source, tmdbService, { signal, budget })
    : await inspectLayout(source, tmdbService, signal);
  if (!inspection.comparisons) return inspection;
  let fresh;
  try { fresh = await read(); } catch {
    signal.throwIfAborted();
    return { outcome: 'source_recheck_unavailable' };
  }
  signal.throwIfAborted();
  if (fresh?.digest !== source.digest) return { outcome: 'source_changed' };
  return { ...inspection, seasons: source.seasons.length, episodes: source.episodeCount };
}

/** A diagnostic sample, not a persisted mapping preview or authorization receipt. */
export function createSourceCatalogPreview({ readRows, getMediaServerService, tmdbService, mode = 'layout' }) {
  if (typeof readRows !== 'function' || typeof getMediaServerService !== 'function' ||
      typeof tmdbService?.getIdentityDetails !== 'function' || !['layout', 'episodes'].includes(mode) ||
      (mode === 'episodes' && typeof tmdbService.getIdentitySeasonDetails !== 'function')) throw new TypeError('invalid_preview_dependencies');
  return Object.freeze({
    async replay({ signal: callerSignal } = {}) {
      const deadline = AbortSignal.timeout(LIMITS.timeoutMs);
      const signal = callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
      const result = { version: 'source_catalog_preview.v1', reference: randomUUID(),
        status: { id: 'failed' }, canApply: false, verification: 'layout_only', orderVerified: false, summary: null };
      if (mode === 'episodes') Object.assign(result, { version: 'source_episode_preview.v1',
        verification: 'episode_catalog_membership', crossProviderVerified: false });
      const budget = { remainingSeasons: CATALOG_EPISODE_LIMITS.seasonsPerRun };
      try {
        signal.throwIfAborted();
        const rows = await readRows(LIMITS);
        // Copy configuration evidence before provider awaits; never output it.
        const before = JSON.stringify(rows);
        const selected = selectedRows(JSON.parse(before));
        const summary = { selectedObservations: selected.length, inspectedObservations: 0,
          sourceSeasons: 0, sourceEpisodes: 0, catalogCandidates: 0, outcomes: {}, comparisons: {} };
        if (mode === 'episodes') summary.groupsSpanningCatalogSeries = 0;
        for (const row of selected) {
          signal.throwIfAborted();
          const finding = await inspect(row, { getMediaServerService, tmdbService, signal, mode, budget });
          increment(summary.outcomes, finding.outcome);
          summary.inspectedObservations++;
          if (finding.comparisons) {
            summary.sourceSeasons += finding.seasons;
            summary.sourceEpisodes += finding.episodes;
            summary.catalogCandidates += finding.candidates;
            if (mode === 'episodes') summary.groupsSpanningCatalogSeries += finding.groupsSpanningCatalogSeries;
            for (const [id, count] of Object.entries(finding.comparisons)) summary.comparisons[id] = (summary.comparisons[id] ?? 0) + count;
          }
        }
        signal.throwIfAborted();
        if (selected.length && JSON.stringify(await readRows(LIMITS)) !== before) {
          result.status.id = 'selection_changed';
        } else {
          signal.throwIfAborted();
          result.status.id = selected.length ? 'complete' : 'no_current_conflicts';
          result.summary = summary;
        }
      } catch {
        result.status.id = signal.aborted ? (callerSignal?.aborted ? 'cancelled' : 'timed_out') : 'failed';
      }
      return result;
    },
  });
}
