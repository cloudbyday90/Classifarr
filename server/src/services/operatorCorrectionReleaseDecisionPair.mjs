/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { BASELINE_COMMIT } from '../scripts/pinnedReleaseSchema.mjs';
import { compareOperatorCorrectionReleasePair,
  fingerprintOperatorCorrectionPairCohort } from './operatorCorrectionReleasePairComparison.mjs';
import { fingerprintReleaseDecisionInput, validateReleaseDecisionInput } from './operatorCorrectionReleaseDecisionInput.mjs';

const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function validateWorkerResult(result, role, count) {
  if (!exact(result, ['version', 'role', 'cases']) || result.version !== 1 || result.role !== role ||
      !Array.isArray(result.cases) || result.cases.length !== count) throw new Error('release_decision_worker_invalid');
  const seen = new Set();
  for (const row of result.cases) {
    if (!exact(row, ['index', 'statusId', 'destinationLibraryId']) ||
        !Number.isInteger(row.index) || row.index < 0 || row.index >= count || seen.has(row.index) ||
        !['destination', 'abstained', 'safety_blocked', 'failed'].includes(row.statusId) ||
        (row.statusId === 'destination' ? !Number.isSafeInteger(row.destinationLibraryId) || row.destinationLibraryId <= 0
          : row.destinationLibraryId !== null)) throw new Error('release_decision_worker_invalid');
    seen.add(row.index);
  }
  return result.cases.slice().sort((a, b) => a.index - b.index);
}

/** Bind two executed decision subpaths to one input; no full-pipeline claim. */
export function buildReleaseDecisionPair({ input, baselineResult, candidateResult, candidateCommit,
  token = () => randomBytes(16).toString('hex') }) {
  const validated = validateReleaseDecisionInput(input);
  const baseline = validateWorkerResult(baselineResult, 'baseline', validated.cases.length);
  const candidate = validateWorkerResult(candidateResult, 'candidate', validated.cases.length);
  const tokens = validated.cases.map(() => token());
  if (new Set(tokens).size !== tokens.length || tokens.some(value => !/^[a-f0-9]{32}$/.test(value))) {
    throw new Error('release_decision_tokens_invalid');
  }
  const fingerprint = fingerprintReleaseDecisionInput(validated);
  const cohort = validated.cases.map((row, index) => ({ token: tokens[index], mediaType: row.mediaType,
    labelLibraryId: row.labelLibraryId }));
  const cohortFingerprint = fingerprintOperatorCorrectionPairCohort(cohort);
  const bundle = (role, commit, outcomes) => ({ version: 1, role, commit,
    frozenInputFingerprint: fingerprint, cohortFingerprint,
    cases: outcomes.map((outcome, index) => ({ ...cohort[index], statusId: outcome.statusId,
      destinationLibraryId: outcome.destinationLibraryId })) });
  const baselineBundle = bundle('baseline', BASELINE_COMMIT, baseline);
  const candidateBundle = bundle('candidate', candidateCommit, candidate);
  const comparison = compareOperatorCorrectionReleasePair({ baseline: baselineBundle,
    candidate: candidateBundle, candidateCommit });
  return { baselineBundle, candidateBundle, report: {
    ...comparison, scope: 'policy_decision_subpath_only',
    omittedSources: ['policy_scoring', 'inventory_evidence', 'retrieval', 'ai_adjudication',
      'authoritative_signals', 'routing_and_learning'],
    decisionSubpathExecutionVerified: false,
  } };
}
