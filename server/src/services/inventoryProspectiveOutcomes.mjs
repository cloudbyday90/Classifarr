/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validInventoryRankingShadow, INVENTORY_RANKING_SHADOW_VERSION } from './inventoryRankingShadow.mjs';
import { inventoryProspectiveEvidenceState } from './inventoryProspectiveEvidenceState.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { prepareProspectiveObservations, prospectiveObservationCoverage } from './inventoryProspectiveObservations.mjs';
import { prospectiveTimestamp as timestamp, prospectiveClassificationId, compareProspectiveClassificationIds } from './inventoryProspectiveValues.mjs';
import { planProspectiveHoldouts } from './inventoryProspectiveHoldouts.mjs';

const empty = () => ({ sampled: 0, confirmations: 0, corrections: 0, companyObserved: 0,
  baselineDecisions: 0, baselineMatches: 0, combinedDecisions: 0, combinedMatches: 0, gains: 0, regressions: 0 });

/** Delayed labels evaluate frozen predictions; feedback never refits or promotes a model here. */
export function evaluateInventoryProspectiveOutcomes(rows, { now = Date.now() } = {}) {
  if (!Array.isArray(rows) || rows.length > 5000 || !Number.isFinite(now)) throw new Error('inventory_prospective_budget');
  const coverage = { captured: rows.length, invalid: 0, awaitingOutcome: 0, conflicting: 0,
    outsideCandidateScope: 0, duplicateIdentityOrDescription: 0, excludedOutcomes: 0,
    unboundCaptures: 0, identityMismatchCaptures: 0, unverifiedCaptures: 0, unavailable: 0, mixedKinds: 0, observationOverflowCaptures: 0,
    ...prospectiveObservationCoverage() };
  const media = { movie: empty(), tv: empty() };
  const kinds = { confirmation: empty(), correction: empty() };
  const strata = new Map();
  const preparedRows = [...rows].sort((a, b) => timestamp(a?.recorded_at) - timestamp(b?.recorded_at) ||
    compareProspectiveClassificationIds(a?.classification_id, b?.classification_id)).map(row => {
    const recorded = timestamp(row?.recorded_at);
    const validCapture = validInventoryRankingShadow(row?.capture, { allowLegacy: true }) &&
      Number.isFinite(recorded) && Date.parse(row.capture.capturedAt) <= recorded && recorded <= now;
    const validObservations = Array.isArray(row?.outcomes) && row.outcomes.length <= 100;
    if (Array.isArray(row?.outcomes) && row.outcomes.length > 101) throw new Error('inventory_prospective_budget');
    // The SQL sentinel is bounded. Validate its aliases for exclusion even when it cannot be graded.
    const prepared = validCapture && Array.isArray(row.outcomes) ? prepareProspectiveObservations(row, now) :
      { observations: [], aliases: new Set(), coverage: prospectiveObservationCoverage(), uncertain: false };
    for (const [key, count] of Object.entries(prepared.coverage)) coverage[key] += count;
    coverage.excludedOutcomes += prepared.coverage.excludedTemporalRows;
    return { ...row, validCapture, validObservations, prepared };
  });
  const firstCaptures = planProspectiveHoldouts(preparedRows);
  for (const [index, row] of preparedRows.entries()) {
    const capture = row.capture;
    if (!row.validCapture) { coverage.invalid++; continue; }
    if (!firstCaptures[index]) { coverage.duplicateIdentityOrDescription++; continue; }
    if (!row.validObservations || !prospectiveClassificationId(row.classification_id)) {
      coverage.invalid++; coverage.observationOverflowCaptures += Number(row.outcomes?.length > 100); continue;
    }
    if (!validInventoryRankingShadow(capture)) { coverage.unboundCaptures++; continue; }
    if (inventoryRankingItemIdentity(row) !== capture.identityKey) { coverage.identityMismatchCaptures++; continue; }
    const outcomes = row.prepared.observations;
    const destinations = new Set(outcomes.map(outcome => outcome.library_id));
    if (destinations.size > 1 || outcomes.some(outcome => outcome.evidence_conflict)) { coverage.conflicting++; continue; }
    if (row.prepared.uncertain) { coverage.unverifiedCaptures++; continue; }
    if (!outcomes.length) { coverage.awaitingOutcome++; continue; }
    if (outcomes.some(outcome => !outcome.target_available)) { coverage.unavailable++; continue; }
    if (new Set(outcomes.map(outcome => outcome.was_correction)).size !== 1) { coverage.mixedKinds++; continue; }
    const [destination] = destinations;
    if (!capture.candidates.some(candidate => candidate.libraryId === destination)) { coverage.outsideCandidateScope++; continue; }
    const correction = outcomes[0].was_correction;
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
    sampleSize, coverage, media, kinds, libraries: [...strata.values()],
    evidenceState: inventoryProspectiveEvidenceState({ coverage, media, kinds, sampleSize }),
    promotionAllowed: false, routingChanges: 0, providerCalls: 0,
    evaluation: { prospective: true, notFullPipelineAccuracy: true, confirmationsMayBeSuggestionBiased: true,
      identityBoundCapturesRequired: true, legacyKindsNotInferred: true, placementsAreNotLabels: true,
      fixedMetadataWeight: .25, fixedCompanyWeight: .25, scoreTransform: 'tanh',
      scope: 'complete_live_inventory_comparisons_only', uniqueDescriptionGroups: true } };
}
