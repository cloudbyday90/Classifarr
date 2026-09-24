/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { freshFixture, freshSettings } from '../fixtures/freshInventoryPolicyFixture.mjs';
import { runFreshInventoryPolicyEvaluation } from '../../services/freshInventoryPolicyEvaluation.mjs';
import { fingerprintFreshPolicySnapshot } from '../../services/freshInventoryPolicyRuntime.mjs';
import { prepareOperatorCorrectionFreshPolicySource,
  summarizeOperatorCorrectionFreshPolicy } from '../../services/operatorCorrectionFreshPolicyEvaluation.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';
import { prepareDescriptionBenchmark } from '../../services/inventoryDescriptionBenchmarkSample.mjs';
import { createFreshInventoryPolicyEvidence } from '../../services/freshInventoryPolicyEvidence.mjs';

function withCorrections(fixture, count = 12) {
  const { source } = fixture;
  source.operatorFeedbackRows = source.evaluationRows.slice(0, count).map(row => ({
    media_type: row.media_type, tmdb_id: row.tmdb_id, selected_library_id: row.library_id,
    was_correction: true, origin: 'manual_correction',
  }));
  source.fingerprint = fingerprintFreshPolicySnapshot(source);
  return fixture;
}

test('correction labels select cases without entering policy configuration or prompts', async () => {
  const { source, runtime } = withCorrections(freshFixture());
  const cohort = prepareOperatorCorrectionFreshPolicySource(source);
  expect(cohort.eligibleSampleKeys.size).toBe(12);
  expect(cohort.source.operatorFeedbackRows).toBeUndefined();
  expect(cohort.source.policies.every(policy => policy.trust_history === false && policy.trust_patterns === false)).toBe(true);
  expect(source.policies[0].trust_history).toBe(true);
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, generateCases: 0 }, {
    loadRuntime: async () => runtime, operatorCorrectionsOnly: true,
  });
  expect(report).toMatchObject({ protocol: 'operator_corrected_fresh_policy_v1', status: 'preflight',
    sampled: 12, calls: 0, accuracy: null, routingReceiptsCreated: 0,
    correctionEvaluation: { sampledCorrections: 12, fullPipelineAccuracy: null,
      priorReleaseComparisonAvailable: false, promotionAllowed: false } });
  expect(report.correctionEvaluation.byMedia.movie.sampled).toBeGreaterThan(0);
  expect(report.correctionEvaluation.byMedia.tv.sampled).toBeGreaterThan(0);
  expect(runtime.createClient).not.toHaveBeenCalled();
  expect(report).not.toHaveProperty('policyLeaderPlacementAgreement');
  expect(report).not.toHaveProperty('libraries');
  expect(report).not.toHaveProperty('matchCalibration');
  expect(JSON.stringify(report)).not.toMatch(/Private|tmdb_id|selected_library_id|operatorFeedbackRows|destinationId/);
});

test('no corrected labels is an explicit non-promotable result without provider calls', async () => {
  const { runtime } = withCorrections(freshFixture(), 0);
  const report = await runFreshInventoryPolicyEvaluation({ ...freshSettings, generateCases: 3 }, {
    loadRuntime: async () => runtime, operatorCorrectionsOnly: true,
  });
  expect(report).toMatchObject({ status: 'no_eligible_corrections', sampled: 0, calls: 0,
    correctionEvaluation: { status: 'no_eligible_corrections', sampledCorrections: 0, promotionAllowed: false } });
  expect(runtime.createClient).not.toHaveBeenCalled();
});

test('the case preparer cannot see raw correction rows', async () => {
  const { runtime } = withCorrections(freshFixture(), 1);
  const prepareCase = jest.fn(async (_sample, source) => {
    expect(source).not.toHaveProperty('operatorFeedbackRows');
    return { status: 'mode_not_adjudication' };
  });
  await runFreshInventoryPolicyEvaluation({ ...freshSettings, size: 1, generateCases: 0 }, {
    loadRuntime: async () => runtime, operatorCorrectionsOnly: true, prepareCase,
  });
  expect(prepareCase).toHaveBeenCalledTimes(1);
});

test('conflicting corrections are excluded rather than voted into a label', () => {
  const { source } = withCorrections(freshFixture(), 1);
  source.operatorFeedbackRows.push({ ...source.operatorFeedbackRows[0], selected_library_id: 2 });
  const cohort = prepareOperatorCorrectionFreshPolicySource(source);
  expect(cohort.eligibleSampleKeys.size).toBe(0);
  expect(cohort.coverage.conflictingIdentities).toBe(1);
});

test('selected correction and every matching description copy are excluded from fold training', () => {
  const { source } = withCorrections(freshFixture(), 1);
  source.evaluationRows[12].overview = source.evaluationRows[0].overview;
  source.corpus = prepareInventoryDescriptionCorpus(source.evaluationRows);
  source.vectors = new Map([...source.corpus.texts.keys()].map(hash => [hash, [1, 0.2]]));
  const cohort = prepareOperatorCorrectionFreshPolicySource(source);
  const prepared = prepareDescriptionBenchmark(cohort.source, source.vectors, 2,
    { ...freshSettings, size: 1, generateCases: 0, folds: 2 },
    { learnedProfiles: true, includeComparisonEvidence: true, preserveDescriptionCandidate: true,
      eligibleSampleKeys: cohort.eligibleSampleKeys });
  expect(prepared.cases).toHaveLength(1);
  const selected = prepared.cases[0];
  expect(selected.itemIdentity.tmdbId).toBe(1);
  expect(selected.heldDescriptionHashes.has(source.corpus.documents.find(doc => doc.id === 13).hash)).toBe(true);
  const evidence = createFreshInventoryPolicyEvidence(cohort.source, prepared).forCase(selected);
  expect(evidence.profiles.get(1).stats.totalItems).toBe(18);
});

test('aggregate report separates policy leader, proposal, abstention, gain and regression', () => {
  const rows = [
    { sample: { mediaType: 'movie', itemIdentity: { tmdbId: 1 } },
      prepared: { policyResult: { action: 'manual', ranked: [{ library_id: 2 }] } },
      generated: { status: 'proposed', destinationId: 1 } },
    { sample: { mediaType: 'movie', itemIdentity: { tmdbId: 2 } },
      prepared: { policyResult: { action: 'manual', ranked: [{ library_id: 1 }] } },
      generated: { status: 'proposed', destinationId: 2 } },
    { sample: { mediaType: 'tv', itemIdentity: { tmdbId: 3 } },
      prepared: { policyResult: { action: 'manual', ranked: [] } }, generated: { status: 'abstained' } },
  ];
  const corrections = new Map([['movie:1', { libraryId: 1 }], ['movie:2', { libraryId: 1 }],
    ['tv:3', { libraryId: 3 }]]);
  const summary = summarizeOperatorCorrectionFreshPolicy({ rows, corrections, coverage: {}, evaluationSnapshotValid: true });
  expect(summary.byMedia.movie).toMatchObject({ sampled: 2, policyLeaderMatches: 1, aiProposalMatches: 1,
    paired: 2, gainsOverPolicyLeader: 1, regressionsFromPolicyLeader: 1, changedDestinations: 2 });
  expect(summary.byMedia.tv).toMatchObject({ sampled: 1, aiAbstentions: 1, aiProposals: 0 });
  expect(summary.fullPipelineAccuracy).toBeNull();
  expect(summary.promotionAllowed).toBe(false);
});

test('source drift invalidates comparisons and malformed mode fails before runtime access', async () => {
  const { source, runtime } = withCorrections(freshFixture());
  const changed = structuredClone(source);
  changed.operatorFeedbackRows[0].selected_library_id = 2;
  changed.fingerprint = fingerprintFreshPolicySnapshot(changed);
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue(changed);
  await expect(runFreshInventoryPolicyEvaluation({ ...freshSettings, generateCases: 0 }, {
    loadRuntime: async () => runtime, operatorCorrectionsOnly: true,
  })).rejects.toThrow('source_changed');
  const loadRuntime = jest.fn();
  await expect(runFreshInventoryPolicyEvaluation(freshSettings, {
    loadRuntime, operatorCorrectionsOnly: true, neighborFallback: true,
  })).rejects.toThrow('mode_invalid');
  expect(loadRuntime).not.toHaveBeenCalled();
  const invalid = summarizeOperatorCorrectionFreshPolicy({ rows: [], corrections: new Map(), coverage: {},
    evaluationSnapshotValid: false });
  expect(invalid).toMatchObject({ status: 'invalidated', sampledCorrections: 0, promotionAllowed: false });
});

test('CLI validates budgets before evaluation and selects the correction-only mode', async () => {
  const evaluate = jest.fn(async () => ({ status: 'preflight' }));
  await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--size', '999'], evaluate })).rejects.toThrow('options_invalid');
  expect(evaluate).not.toHaveBeenCalled();
  await runOperatorCorrectionPolicyEvaluation({ argv: ['--size', '12', '--folds', '3'], evaluate });
  expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ size: 12, folds: 3, generateCases: 0 }),
    { operatorCorrectionsOnly: true });
});
