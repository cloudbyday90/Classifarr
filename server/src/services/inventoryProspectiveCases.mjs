/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validInventoryRankingShadow } from './inventoryRankingShadow.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { prepareProspectiveObservations, prospectiveObservationCoverage } from './inventoryProspectiveObservations.mjs';
import { prospectiveTimestamp as timestamp, prospectiveClassificationId, compareProspectiveClassificationIds } from './inventoryProspectiveValues.mjs';
import { planProspectiveHoldouts } from './inventoryProspectiveHoldouts.mjs';

/** Whole-cohort exclusions precede every score or detail selection. Keep their order stable. */
export function prepareInventoryProspectiveCases(rows, { now = Date.now() } = {}) {
  if (!Array.isArray(rows) || rows.length > 5000 || !Number.isFinite(now)) throw new Error('inventory_prospective_budget');
  const coverage = { captured: rows.length, invalid: 0, awaitingOutcome: 0, conflicting: 0,
    outsideCandidateScope: 0, duplicateIdentityOrDescription: 0, excludedOutcomes: 0,
    unboundCaptures: 0, identityMismatchCaptures: 0, unverifiedCaptures: 0, unavailable: 0, mixedKinds: 0, observationOverflowCaptures: 0,
    ...prospectiveObservationCoverage() };
  const cases = [...rows].sort((a, b) => timestamp(a?.recorded_at) - timestamp(b?.recorded_at) ||
    compareProspectiveClassificationIds(a?.classification_id, b?.classification_id)).map(row => {
    const recorded = timestamp(row?.recorded_at);
    const validCapture = validInventoryRankingShadow(row?.capture, { allowLegacy: true }) &&
      Number.isFinite(recorded) && Date.parse(row.capture.capturedAt) <= recorded && recorded <= now;
    const validObservations = Array.isArray(row?.outcomes) && row.outcomes.length <= 100;
    if (Array.isArray(row?.outcomes) && row.outcomes.length > 101) throw new Error('inventory_prospective_budget');
    const prepared = validCapture && Array.isArray(row.outcomes) ? prepareProspectiveObservations(row, now) :
      { observations: [], aliases: new Set(), coverage: prospectiveObservationCoverage(), uncertain: false };
    for (const [key, count] of Object.entries(prepared.coverage)) coverage[key] += count;
    coverage.excludedOutcomes += prepared.coverage.excludedTemporalRows;
    return { ...row, validCapture, validObservations, prepared };
  });
  const first = planProspectiveHoldouts(cases);
  for (const [index, row] of cases.entries()) {
    const outcomes = row.prepared.observations, destinations = new Set(outcomes.map(outcome => outcome.library_id));
    let disposition;
    if (!row.validCapture) disposition = 'invalid';
    else if (!first[index]) disposition = 'duplicateIdentityOrDescription';
    else if (!row.validObservations || !prospectiveClassificationId(row.classification_id)) {
      disposition = 'invalid'; coverage.observationOverflowCaptures += Number(row.outcomes?.length > 100);
    } else if (!validInventoryRankingShadow(row.capture)) disposition = 'unboundCaptures';
    else if (inventoryRankingItemIdentity(row) !== row.capture.identityKey) disposition = 'identityMismatchCaptures';
    else if (destinations.size > 1 || outcomes.some(outcome => outcome.evidence_conflict)) disposition = 'conflicting';
    else if (row.prepared.uncertain) disposition = 'unverifiedCaptures';
    else if (!outcomes.length) disposition = 'awaitingOutcome';
    else if (outcomes.some(outcome => !outcome.target_available)) disposition = 'unavailable';
    else if (new Set(outcomes.map(outcome => outcome.was_correction)).size !== 1) disposition = 'mixedKinds';
    else if (!row.capture.candidates.some(candidate => candidate.libraryId === [...destinations][0])) disposition = 'outsideCandidateScope';
    else {
      disposition = 'eligible';
      row.selectedLibraryId = [...destinations][0]; row.wasCorrection = outcomes[0].was_correction;
    }
    row.disposition = disposition;
    if (disposition !== 'eligible') coverage[disposition]++;
  }
  return { cases, coverage };
}
