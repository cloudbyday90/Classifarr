/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryProspectiveCases } from './inventoryProspectiveCases.mjs';
import { summarizeInventoryProspectiveCases } from './inventoryProspectiveOutcomes.mjs';
import { withInventoryProspectiveActivity } from './inventoryProspectiveActivity.mjs';
import { projectInventoryDisagreementCase } from './inventoryDisagreementCase.mjs';
import { INVENTORY_PROSPECTIVE_MAX_INPUT_BYTES } from './inventoryProspectiveLimits.mjs';

export const INVENTORY_DISAGREEMENT_CASE_LIMIT = 50;
export const INVENTORY_DISAGREEMENT_REPORT_BYTES = 1024 * 1024;
const tally = () => ({ agrees: 0, differs: 0, abstained: 0, unavailable: 0 });
const cohortCounts = () => ({ sampled: 0, flagged: 0, originalUnavailable: 0,
  originalVersusAssessment: tally(), baselineVersusAssessment: tally(), companyVersusAssessment: tally(), experimentalArms: tally() });

/** Diagnostic comparisons only; presentation never changes the complete cohort's denominator. */
export function buildInventoryDisagreementReport({ rows, activity, observedAt, window }) {
  const now = Date.parse(observedAt);
  if (!Number.isFinite(now) || window?.until !== observedAt || Date.parse(window.since) !== now - 30 * 86400000) {
    throw new Error('inventory_disagreement_window');
  }
  const prepared = prepareInventoryProspectiveCases(rows, { now });
  const evaluation = withInventoryProspectiveActivity(summarizeInventoryProspectiveCases(prepared), activity);
  const cohorts = { confirmation: cohortCounts(), correction: cohortCounts() };
  const report = { version: 'inventory_prospective_disagreements.v1', private: true, status: evaluation.status,
    window: { since: window.since, until: window.until, outcomesAsOf: observedAt }, evaluation, cohorts,
    evidenceGaps: { historicalIntent: 'not_frozen', fullPolicyRanking: 'not_frozen',
      outcomesWithoutEligibleCapture: 'not_assessed', originalUnavailable: 0, originalConflicting: 0, partialOriginalSources: 0 },
    limits: { retentionDays: 30, captures: 5000, candidatesPerCapture: 64, observationsPerCapture: 100,
      inputBytes: INVENTORY_PROSPECTIVE_MAX_INPUT_BYTES, displayedCases: INVENTORY_DISAGREEMENT_CASE_LIMIT, reportBytes: INVENTORY_DISAGREEMENT_REPORT_BYTES },
    display: { eligibleCases: evaluation.sampleSize, flaggedCases: 0, shownCases: 0, omittedCases: 0, truncated: false,
      order: 'recorded_time_then_exact_classification_id', alternativeOrder: 'experimental_baseline_score_then_library_id' },
    interpretation: { comparisonsOverlap: true, disagreementsAreNotErrorLabels: true, experimentalRanksAreNotPolicyScores: true,
      confirmationsMayBeSuggestionBiased: true, unavailableCompanyIsNotAnIndependentArm: true, automaticPromotionAllowed: false }, cases: [] };
  for (const row of prepared.cases) {
    if (row.disposition !== 'eligible') continue;
    const item = projectInventoryDisagreementCase(row), cohort = cohorts[item.cohort];
    cohort.sampled++;
    for (const [key, status] of Object.entries(item.comparisons)) cohort[key][status]++;
    if (item.original.status !== 'available') { report.evidenceGaps.originalUnavailable++; cohort.originalUnavailable++; }
    if (item.original.status === 'conflicting') report.evidenceGaps.originalConflicting++;
    if (item.original.status === 'available' && item.original.gaps.length) report.evidenceGaps.partialOriginalSources++;
    if (!item.flags.length) continue;
    cohort.flagged++; report.display.flaggedCases++;
    if (report.cases.length < INVENTORY_DISAGREEMENT_CASE_LIMIT) report.cases.push(item);
  }
  const updateDisplay = () => {
    report.display.shownCases = report.cases.length;
    report.display.omittedCases = report.display.flaggedCases - report.cases.length;
    report.display.truncated = report.display.omittedCases > 0;
  };
  updateDisplay();
  while (Buffer.byteLength(JSON.stringify(report)) > INVENTORY_DISAGREEMENT_REPORT_BYTES && report.cases.length) {
    report.cases.pop(); updateDisplay();
  }
  if (Buffer.byteLength(JSON.stringify(report)) > INVENTORY_DISAGREEMENT_REPORT_BYTES) throw new Error('inventory_disagreement_report_budget');
  return report;
}
