/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { preparePurposeOutcomeCohort } from './purposeOutcomeCohortPreparation.mjs';
import { projectPurposeOutcomeCase } from './purposeOutcomeCaseProjection.mjs';
import { PURPOSE_EVALUATION_VERSION, PURPOSE_EVALUATION_GAPS, PURPOSE_COMPARISONS, PURPOSE_ACTIONS, PURPOSE_SOURCES,
  PURPOSE_ORIGINAL_STATES, PURPOSE_EVALUATION_LIMITS, purposeEvaluationPhase, readPurposeEvaluationReport } from './purposeEvaluationContract.mjs';

const comparisons = () => Object.fromEntries(PURPOSE_COMPARISONS.map(key => [key, { agrees: 0, differs: 0, unavailable: 0 }]));
const group = () => ({ eligible: 0, comparisons: comparisons() });
const reasons = () => Object.fromEntries(PURPOSE_EVALUATION_GAPS.map(key => [key, 0]));
export function buildPurposeEvaluationReport(input) {
  const prepared = preparePurposeOutcomeCohort(input);
  const report = { version: PURPOSE_EVALUATION_VERSION, window: { since: input.window.since, until: input.window.until },
    phase: 'no_retained_choices', eligible: 0, comparisons: comparisons(),
    cohorts: Object.fromEntries(PURPOSE_ACTIONS.map(key => [key, group()])), sources: Object.fromEntries(PURPOSE_SOURCES.map(key => [key, group()])),
    originalEvidence: Object.fromEntries(PURPOSE_ORIGINAL_STATES.map(key => [key, 0])),
    coverage: { sourceRows: prepared.sourceRows, canonicalEvents: prepared.events.length, aliases: prepared.sourceRows - prepared.events.length,
      duplicateItems: 0, gaps: reasons(), observedGaps: reasons() }, limits: { ...PURPOSE_EVALUATION_LIMITS } };
  for (const event of prepared.events) {
    if (event.gap) report.coverage.observedGaps[event.gap]++;
    if (event.disposition === 'duplicate_item') { report.coverage.duplicateItems++; continue; }
    if (event.gap) { report.coverage.gaps[event.gap]++; continue; }
    // Reuse the exact frozen reference semantics; retain only fixed comparisons, never the private case.
    const item = projectPurposeOutcomeCase(event);
    report.eligible++; report.originalEvidence[item.original.status]++;
    const cohort = report.cohorts[event.action], source = report.sources[event.sourceKind];
    cohort.eligible++; source.eligible++;
    for (const key of PURPOSE_COMPARISONS) {
      const status = item.comparisons[key];
      report.comparisons[key][status]++; cohort.comparisons[key][status]++; source.comparisons[key][status]++;
    }
  }
  report.phase = purposeEvaluationPhase(report.coverage.sourceRows, report.eligible);
  if (!readPurposeEvaluationReport(report)) throw new Error('purpose_evaluation_invalid_report');
  return report;
}
