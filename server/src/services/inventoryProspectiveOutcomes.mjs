/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validInventoryRankingShadow, INVENTORY_RANKING_SHADOW_VERSION } from './inventoryRankingShadow.mjs';

const empty = () => ({ sampled: 0, confirmations: 0, corrections: 0, companyObserved: 0,
  baselineDecisions: 0, baselineMatches: 0, combinedDecisions: 0, combinedMatches: 0, gains: 0, regressions: 0 });
// pg returns timestamptz columns as Date; Date.parse(Date) loses milliseconds through toString().
const timestamp = value => value instanceof Date ? value.getTime() :
  typeof value === 'string' ? Date.parse(value) : NaN;

/** Delayed labels evaluate frozen predictions; feedback never refits or promotes a model here. */
export function evaluateInventoryProspectiveOutcomes(rows, { now = Date.now() } = {}) {
  if (!Array.isArray(rows) || rows.length > 5000 || !Number.isFinite(now)) throw new Error('inventory_prospective_budget');
  const coverage = { captured: rows.length, invalid: 0, awaitingOutcome: 0, conflicting: 0,
    outsideCandidateScope: 0, duplicateIdentityOrDescription: 0, excludedOutcomes: 0 };
  const media = { movie: empty(), tv: empty() };
  const kinds = { confirmation: empty(), correction: empty() };
  const strata = new Map();
  const identities = new Set(), descriptions = new Set();
  for (const row of [...rows].sort((a, b) => timestamp(a?.recorded_at) - timestamp(b?.recorded_at) ||
      Number(a?.classification_id) - Number(b?.classification_id))) {
    const capture = row?.capture, recorded = timestamp(row?.recorded_at);
    if (!validInventoryRankingShadow(capture) || capture.mediaType !== row.media_type ||
        !Number.isInteger(row.tmdb_id) || row.tmdb_id <= 0 || !Number.isFinite(recorded) ||
        Date.parse(capture.capturedAt) > recorded || recorded > now ||
        !Array.isArray(row.outcomes) || row.outcomes.length > 100) { coverage.invalid++; continue; }
    const key = `${row.media_type}:${row.tmdb_id}`;
    // Reserve the earliest capture, even while awaiting feedback. No favorable retry selection.
    if (identities.has(key) || descriptions.has(capture.queryHash)) { coverage.duplicateIdentityOrDescription++; continue; }
    identities.add(key); descriptions.add(capture.queryHash);
    const outcomes = row.outcomes.filter(outcome => Number.isInteger(outcome?.library_id) && outcome.library_id > 0 &&
      typeof outcome.was_correction === 'boolean' && Number.isFinite(timestamp(outcome.observed_at)) &&
      timestamp(outcome.observed_at) >= recorded && timestamp(outcome.observed_at) <= now);
    coverage.excludedOutcomes += row.outcomes.length - outcomes.length;
    if (!outcomes.length) { coverage.awaitingOutcome++; continue; }
    const destinations = new Set(outcomes.map(outcome => outcome.library_id));
    if (destinations.size !== 1) { coverage.conflicting++; continue; }
    const [destination] = destinations;
    if (!capture.candidates.some(candidate => candidate.libraryId === destination)) { coverage.outsideCandidateScope++; continue; }
    const correction = outcomes.some(outcome => outcome.was_correction);
    const stratumKey = `${row.media_type}:${destination}`;
    if (!strata.has(stratumKey)) {
      if (strata.size === 64) throw new Error('inventory_prospective_library_budget');
      strata.set(stratumKey, { stratum: strata.size + 1, mediaType: row.media_type, ...empty() });
    }
    for (const metrics of [media[row.media_type], kinds[correction ? 'correction' : 'confirmation'], strata.get(stratumKey)]) {
      metrics.sampled++;
      metrics[correction ? 'corrections' : 'confirmations']++;
      metrics.companyObserved += Number(capture.companyAvailable);
      metrics.baselineDecisions += Number(capture.baselineLibraryId !== null);
      metrics.combinedDecisions += Number(capture.combinedLibraryId !== null);
      metrics.baselineMatches += Number(capture.baselineLibraryId === destination);
      metrics.combinedMatches += Number(capture.combinedLibraryId === destination);
      metrics.gains += Number(capture.baselineLibraryId !== destination && capture.combinedLibraryId === destination);
      metrics.regressions += Number(capture.baselineLibraryId === destination && capture.combinedLibraryId !== destination);
    }
  }
  const sampleSize = media.movie.sampled + media.tv.sampled;
  return { protocol: INVENTORY_RANKING_SHADOW_VERSION, status: sampleSize ? 'diagnostic_only' : 'awaiting_eligible_outcomes',
    sampleSize, coverage, media, kinds, libraries: [...strata.values()], promotionAllowed: false, routingChanges: 0, providerCalls: 0,
    evaluation: { prospective: true, notFullPipelineAccuracy: true, confirmationsMayBeSuggestionBiased: true,
      fixedMetadataWeight: .25, fixedCompanyWeight: .25, scoreTransform: 'tanh',
      scope: 'complete_live_inventory_comparisons_only', uniqueDescriptionGroups: true } };
}
