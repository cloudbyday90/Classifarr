/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { BASELINE_COMMIT } from '../scripts/pinnedReleaseSchema.mjs';
import { compareOperatorCorrectionReleasePair,
  fingerprintOperatorCorrectionPairCohort } from './operatorCorrectionReleasePairComparison.mjs';
import { fingerprintReleaseDecisionInput, validateReleaseDecisionInput } from './operatorCorrectionReleaseDecisionInput.mjs';
import { fingerprintFrozenPolicyInput, validateFrozenPolicyInput } from './operatorCorrectionFrozenPolicyInput.mjs';
import { fingerprintFrozenInventoryInput, validateFrozenInventoryInput } from './operatorCorrectionFrozenInventoryInput.mjs';

const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function validateWorkerResult(result, role, count, inventory = false) {
  if (!exact(result, ['version', 'role', 'cases']) || result.version !== 1 || result.role !== role ||
      !Array.isArray(result.cases) || result.cases.length !== count) throw new Error('release_decision_worker_invalid');
  const seen = new Set();
  for (const row of result.cases) {
    if (!exact(row, inventory ? ['index', 'statusId', 'destinationLibraryId', 'inventoryStatusId']
      : ['index', 'statusId', 'destinationLibraryId']) ||
        !Number.isInteger(row.index) || row.index < 0 || row.index >= count || seen.has(row.index) ||
        !['destination', 'abstained', 'safety_blocked', 'failed'].includes(row.statusId) ||
        (row.statusId === 'destination' ? !Number.isSafeInteger(row.destinationLibraryId) || row.destinationLibraryId <= 0
          : row.destinationLibraryId !== null) ||
        (inventory && !(role === 'baseline' ? ['not_applicable', 'failed'] :
          ['not_requested', 'used', 'unavailable', 'contract_mismatch', 'failed']).includes(row.inventoryStatusId))) {
      throw new Error('release_decision_worker_invalid');
    }
    seen.add(row.index);
  }
  return result.cases.slice().sort((a, b) => a.index - b.index);
}

/** Bind two executed decision subpaths to one input; no full-pipeline claim. */
export function buildReleaseDecisionPair({ input, baselineResult, candidateResult, candidateCommit,
  token = () => randomBytes(16).toString('hex') }) {
  const validated = input?.version === 3 ? validateFrozenInventoryInput(input)
    : input?.version === 2 ? validateFrozenPolicyInput(input) : validateReleaseDecisionInput(input);
  const baseline = validateWorkerResult(baselineResult, 'baseline', validated.cases.length, validated.version === 3);
  const candidate = validateWorkerResult(candidateResult, 'candidate', validated.cases.length, validated.version === 3);
  const tokens = validated.cases.map(() => token());
  if (new Set(tokens).size !== tokens.length || tokens.some(value => !/^[a-f0-9]{32}$/.test(value))) {
    throw new Error('release_decision_tokens_invalid');
  }
  const fingerprint = validated.version === 3 ? fingerprintFrozenInventoryInput(validated)
    : validated.version === 2 ? fingerprintFrozenPolicyInput(validated) : fingerprintReleaseDecisionInput(validated);
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
    ...comparison, scope: validated.version === 3 ? 'frozen_policy_inventory_and_decision_subpath'
      : validated.version === 2 ? 'frozen_policy_scoring_and_decision_subpath'
      : 'policy_decision_subpath_only',
    omittedSources: validated.version === 3
      ? ['semantic_rag_search', 'ai_adjudication', 'authoritative_signals',
        'pattern_history', 'routing_and_learning']
      : validated.version === 2
      ? ['inventory_evidence', 'retrieval', 'ai_adjudication', 'authoritative_signals',
        'pattern_history', 'routing_and_learning']
      : ['policy_scoring', 'inventory_evidence', 'retrieval', 'ai_adjudication',
        'authoritative_signals', 'routing_and_learning'],
    foldProfileInputSchemaVerified: validated.version >= 2,
    ...(validated.version >= 2 ? { eligibleCorrections: validated.eligibleCorrections,
      sampledCorrectionCoverage: Number((validated.cases.length / validated.eligibleCorrections).toFixed(4)) } : {}),
    ...(validated.version === 3 ? { inventoryReplay: {
      baselineSupported: false,
      frozenCases: validated.cases.filter(row => row.inventory.statusId === 'captured').length,
      candidateStatuses: Object.fromEntries(['used', 'not_requested', 'unavailable', 'contract_mismatch', 'failed']
        .map(status => [status, candidate.filter(row => row.inventoryStatusId === status).length])),
      complete: candidate.every((row, index) => row.statusId !== 'failed' &&
        !['contract_mismatch', 'failed'].includes(row.inventoryStatusId) &&
        (validated.cases[index].inventory.statusId === 'captured' ?
          ['used', 'unavailable'].includes(row.inventoryStatusId) : row.inventoryStatusId === 'not_requested')),
    } } : {}),
    decisionSubpathExecutionVerified: false,
  } };
}
