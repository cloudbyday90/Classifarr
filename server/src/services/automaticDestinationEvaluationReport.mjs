/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evaluateDestinationOutcomes } from './destinationOutcomeEvaluation.mjs';

const template = evaluateDestinationOutcomes([], []);
const alternatives = {
  status: ['complete', 'no_eligible_outcomes'],
  qualityStatus: ['explicit_outcome_cohort_measured', 'no_completed_decision_labels'],
};
function matches(value, expected, key) {
  if (expected === null) return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
  if (typeof expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(expected).length && Object.entries(expected)
      .every(([name, entry]) => Object.hasOwn(value, name) && matches(value[name], entry, name));
  if (Object.hasOwn(alternatives, key)) return alternatives[key].includes(value);
  if (typeof expected === 'number' && expected === 0 && !['providerCalls', 'routingWrites'].includes(key)) {
    return Number.isSafeInteger(value) && value >= 0 && value <= 10000;
  }
  return value === expected;
}

/** Exact aggregate shape only: never return arbitrary checkpoint JSON to a reader. */
export function readAutomaticDestinationEvaluationReport(value) {
  return matches(value, template, '') ? value : null;
}
