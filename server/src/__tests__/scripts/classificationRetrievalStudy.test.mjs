/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { summarizeSemanticStudyPlan, assertClassificationRetrievalEvidence } from '../../scripts/classificationRetrievalStudyContract.mjs';
import { assertImageIndexMixedReceipt } from '../../scripts/imageIndexMixedContract.mjs';
import { imageIndexMixedReceiptFixture } from '../helpers/imageIndexMixedReceiptFixture.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';

const document = [{ 'Execution Time': 25, Plan: { 'Node Type': 'Limit', 'Actual Rows': 5,
  'Shared Hit Blocks': 24, 'Shared Read Blocks': 3, 'secret': 'must not persist',
  Plans: [{ 'Node Type': 'Limit', 'Actual Rows': 50, Plans: [
    { 'Node Type': 'Index Scan', 'Index Name': 'idx_embeddings_hnsw', 'Filter': 'private vector' },
  ] }] } }];
const evidence = () => ({ protocol: 'semantic_retrieval.v1', queries: 40, imageScoredRows: 200,
  candidateLimit: 50, resultLimit: 5, statusPreserved: true, weightedScoresVerified: true,
  plan: summarizeSemanticStudyPlan(document) });

test('plans expose only aggregate evidence and preserve actual index distinctions', () => {
  expect(summarizeSemanticStudyPlan(document)).toEqual({ textIndexUsed: true, imageIndexUsed: false,
    sequentialEmbeddingScan: false, candidateRows: 50, executionMs: 25, sharedHitBlocks: 24, sharedReadBlocks: 3 });
  expect(JSON.stringify(summarizeSemanticStudyPlan(document))).not.toMatch(/private|secret/);
  const changed = structuredClone(document);
  changed[0].Plan.Plans[0].Plans = [{ 'Node Type': 'Seq Scan', 'Relation Name': 'classification_embeddings' }];
  expect(summarizeSemanticStudyPlan(changed)).toMatchObject({ textIndexUsed: false, sequentialEmbeddingScan: true });
});

test.each([
  value => { value.queries--; }, value => { value.imageScoredRows--; }, value => { value.candidateLimit = 10; },
  value => { value.statusPreserved = false; }, value => { value.weightedScoresVerified = false; },
  value => { value.plan.candidateRows = 5; }, value => { value.plan.executionMs = NaN; },
  value => { value.plan.sharedReadBlocks = -1; }, value => { value.plan.textIndexUsed = 'yes'; },
])('incomplete semantic evidence is rejected (%#)', mutate => {
  const value = evidence(); mutate(value); expect(() => assertClassificationRetrievalEvidence(value)).toThrow();
});

test('semantic mode cannot use an image-only receipt and reports the measured plans', () => {
  const study = { ...imageIndexMixedReceiptFixture(), profile: 'classification-retrieval' };
  expect(() => assertImageIndexMixedReceipt(study)).toThrow();
  for (const row of study.cases) row.foreground.semantic = evidence();
  expect(() => assertImageIndexMixedReceipt(study)).not.toThrow();
  const result = { study, mode: study.profile, budget: 'image-capacity', cleanup: 'passed' };
  expect(formatResourceStudySummary(result)).toContain('Production text-first semantic SQL');
  expect(() => formatResourceStudySummary({ ...result, mode: 'image-index-mixed' })).toThrow();
});
