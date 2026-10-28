/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_RANKING_SHADOW_VERSION } from './inventoryRankingShadow.mjs';
import { inventoryProspectiveEvidenceState } from './inventoryProspectiveEvidenceState.mjs';
import { prepareInventoryProspectiveCases } from './inventoryProspectiveCases.mjs';

const empty = () => ({ sampled: 0, confirmations: 0, corrections: 0, companyObserved: 0,
  baselineDecisions: 0, baselineMatches: 0, combinedDecisions: 0, combinedMatches: 0, gains: 0, regressions: 0 });

/** Delayed labels evaluate frozen predictions; feedback never refits or promotes a model here. */
export function evaluateInventoryProspectiveOutcomes(rows, { now = Date.now() } = {}) {
  return summarizeInventoryProspectiveCases(prepareInventoryProspectiveCases(rows, { now }));
}

/** Internal prepared cohort, shared by aggregates and private diagnostics. */
export function summarizeInventoryProspectiveCases({ cases, coverage }) {
  const media = { movie: empty(), tv: empty() };
  const kinds = { confirmation: empty(), correction: empty() };
  const strata = new Map();
  for (const row of cases) {
    if (row.disposition !== 'eligible') continue;
    const capture = row.capture;
    const destination = row.selectedLibraryId, correction = row.wasCorrection;
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
