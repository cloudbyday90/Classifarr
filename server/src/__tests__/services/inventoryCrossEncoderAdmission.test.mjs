/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { prepareCrossEncoderEvidence, createCrossEncoderExclusionDiagnostics } from '../../services/inventoryCrossEncoderAdmission.mjs';
import { prepareSemanticComparisonPlan } from '../../services/inventorySemanticComparisonContract.mjs';
import { createCrossEncoderEvaluation } from '../../services/inventoryCrossEncoderEvaluation.mjs';
import { leaderSemanticFixture } from '../fixtures/leaderSemanticFixture.mjs';

function fixture() {
  const input = leaderSemanticFixture();
  return { ...input, policyResult: { action: 'manual', ranked: input.candidateIds.map(id => ({ id })) },
    libraries: input.candidateIds.map(id => ({ id, media_type: 'tv', is_active: true })) };
}

test('admitted plans and fingerprints are unchanged and input evidence is not mutated', () => {
  const input = fixture(), before = structuredClone(input);
  expect(prepareCrossEncoderEvidence(input)).toEqual({ plan: prepareSemanticComparisonPlan(input) });
  expect(input).toEqual(before);
});

test.each([
  ['policy_auto_decision', input => { input.policyResult.action = 'auto_classify'; input.candidateIds = []; input.evidence = null; input.contextId = null; }],
  ['policy_not_reviewable', input => { input.policyResult.action = 'PRIVATE UNKNOWN'; }],
  ['insufficient_policy_candidates', input => { input.libraries.forEach(row => { row.is_active = false; }); }],
  ['query_metadata_unavailable', input => { input.metadata = null; }],
  ['query_metadata_unavailable', input => { input.metadata.media_type = 'PRIVATE'; }],
  ['query_description_missing', input => { input.metadata.overview = '\u200b  '; }],
  ['candidate_scope_invalid', input => { input.candidateIds = [1]; }],
  ['candidate_scope_invalid', input => { input.candidateIds[0] = '1'; }],
  ['candidate_scope_invalid', input => { input.candidateIds[1] = 1; }],
  ['candidate_scope_invalid', input => { input.candidateIds = Array.from({ length: 65 }, (_, index) => index + 1); }],
  ['retrieval_unavailable', input => { input.evidence = null; input.contextId = null; }],
  ['snapshot_context_invalid', input => { input.contextId = 'PRIVATE'; }],
  ['candidate_evidence_mismatch', input => { input.evidence.candidates.pop(); }],
  ['candidate_evidence_mismatch', input => { input.evidence.candidates[0].libraryId = 999; }],
  ['example_counts_invalid', input => { input.evidence.candidates[0].eligible = -1; }],
  ['example_counts_invalid', input => { input.evidence.candidates[0].indexed = '10'; }],
  ['examples_missing', input => { Object.assign(input.evidence.candidates[0], { eligible: 0, indexed: 0, items: [] }); }],
  ['example_coverage_incomplete', input => { input.evidence.candidates[0].indexed = 9; }],
  ['examples_missing', input => { input.evidence.candidates[0].items = []; }],
  ['examples_invalid', input => { input.evidence.candidates[0].items = null; }],
  ['examples_invalid', input => { input.evidence.candidates[0].items.push(input.evidence.candidates[0].items[0]); }],
  ['examples_invalid', input => { input.evidence.candidates[0].items[0] = null; }],
  ['shared_examples', input => { input.evidence.candidates[0].items[0].sharedAcrossCandidates = true; }],
  ['shared_examples', input => { delete input.evidence.candidates[0].items[0].sharedAcrossCandidates; }],
  ['duplicate_examples', input => { input.evidence.candidates[0].items[1].description = input.evidence.candidates[0].items[0].description; }],
  ['duplicate_examples', input => { input.evidence.candidates[1].items[0].description = input.evidence.candidates[0].items[0].description; }],
  ['query_in_examples', input => { input.evidence.candidates[0].items[0].description = input.metadata.overview; }],
  ['too_few_examples', input => { input.evidence.candidates[0].items.length = 1; }],
  ['validation_failed', input => { Object.defineProperty(input, 'contextId', { get() { throw new Error('PRIVATE FAILURE'); } }); }],
])('%s is reported without requests, repair authority or private content', async (reason, change) => {
  const input = fixture(); change(input);
  expect(prepareCrossEncoderEvidence(input)).toEqual({ reason });
  const createClient = jest.fn(), evaluation = createCrossEncoderEvaluation({ scoreCases: 1, createClient });
  evaluation.add(input);
  const report = await evaluation.run();
  expect(report).toMatchObject({ considered: 1, eligible: 0, selected: 0, completed: 0, calls: 0, shortfall: 1,
    excluded: { [reason]: 1 }, exclusionDiagnostics: [{ reason, count: 1 }], livePromotionAllowed: false });
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|libraryId|candidateIds|contextId|voyage/);
  expect(createClient).not.toHaveBeenCalled();
});

test('the two auto-decisions are scope exclusions, not repairable missing evidence', async () => {
  const evaluation = createCrossEncoderEvaluation();
  for (const mediaType of ['movie', 'tv']) {
    const input = fixture(); input.policyResult.action = 'auto_classify'; input.metadata.media_type = mediaType;
    input.evidence = null; input.candidateIds = []; input.contextId = null;
    evaluation.add(input);
  }
  expect(await evaluation.run()).toMatchObject({ considered: 2, eligible: 0,
    excluded: { policy_auto_decision: 2 }, exclusionDiagnostics: [{ reason: 'policy_auto_decision',
      count: 2, category: 'policy_scope', nextStep: 'not_needed', byMedia: { movie: 1, tv: 1, unknown: 0 } }] });
});

test('fixed recovery dispositions preserve isolation and do not claim a scheduled repair', () => {
  const diagnostics = createCrossEncoderExclusionDiagnostics();
  diagnostics.record('query_metadata_unavailable', 'movie'); diagnostics.record('too_few_examples', 'tv');
  diagnostics.record('query_in_examples', 'movie'); diagnostics.record('__proto__', 'PRIVATE');
  diagnostics.record('PRIVATE ERROR', 'PRIVATE');
  const report = diagnostics.report();
  expect(report.exclusionDiagnostics).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'query_metadata_unavailable', nextStep: 'check_existing_readiness' }),
    expect.objectContaining({ reason: 'too_few_examples', nextStep: 'check_fold_eligibility' }),
    expect.objectContaining({ reason: 'query_in_examples', nextStep: 'preserve_exclusion' }),
    expect.objectContaining({ reason: 'validation_failed', count: 2, byMedia: { movie: 0, tv: 0, unknown: 2 } }),
  ]));
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|__proto__|scheduled|enqueued/);
  report.exclusionDiagnostics[0].byMedia.movie = 999; report.excluded.validation_failed = 999;
  expect(diagnostics.report().excluded.validation_failed).toBe(2);
  expect(diagnostics.report().exclusionDiagnostics[0].byMedia.movie).not.toBe(999);
});

test('the bounded retention limit is not mislabeled as missing evidence', async () => {
  const evaluation = createCrossEncoderEvaluation();
  for (let index = 0; index < 301; index++) evaluation.add(fixture());
  const report = await evaluation.run();
  expect(report).toMatchObject({ considered: 301, eligible: 300, excluded: { retention_budget: 1 },
    exclusionDiagnostics: [{ reason: 'retention_budget', category: 'resource_limit', nextStep: 'reduce_run_size' }] });
  expect(report.considered).toBe(report.eligible + Object.values(report.excluded).reduce((sum, count) => sum + count, 0));
});
