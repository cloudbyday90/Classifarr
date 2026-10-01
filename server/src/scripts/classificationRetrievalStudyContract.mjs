/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

/** Only closed aggregate fields leave the disposable database; never raw plans. */
export function summarizeSemanticStudyPlan(document) {
  assert(Array.isArray(document) && document.length === 1);
  const root = document[0], nodes = [root.Plan], seen = [];
  while (nodes.length) {
    const node = nodes.pop(); assert(node && seen.length < 100);
    seen.push(node); nodes.push(...(node.Plans ?? []));
  }
  const result = { textIndexUsed: seen.some(node => node['Index Name'] === 'idx_embeddings_hnsw'),
    imageIndexUsed: seen.some(node => node['Index Name'] === 'idx_embeddings_image_hnsw'),
    sequentialEmbeddingScan: seen.some(node => node['Node Type'] === 'Seq Scan' && node['Relation Name'] === 'classification_embeddings'),
    candidateRows: Math.max(...seen.filter(node => node['Node Type'] === 'Limit').map(node => node['Actual Rows'])),
    executionMs: root['Execution Time'], sharedHitBlocks: root.Plan['Shared Hit Blocks'],
    sharedReadBlocks: root.Plan['Shared Read Blocks'] };
  assertSemanticStudyPlan(result); return result;
}

function assertSemanticStudyPlan(plan) {
  for (const key of ['textIndexUsed', 'imageIndexUsed', 'sequentialEmbeddingScan']) assert.equal(typeof plan[key], 'boolean');
  assert.equal(plan.candidateRows, 50);
  assert(Number.isFinite(plan.executionMs) && plan.executionMs >= 0 && plan.executionMs < 5000);
  for (const key of ['sharedHitBlocks', 'sharedReadBlocks']) assert(Number.isSafeInteger(plan[key]) && plan[key] >= 0);
}

export function assertClassificationRetrievalEvidence(value) {
  assert.equal(value.protocol, 'semantic_retrieval.v1');
  assert.equal(value.queries, 40); assert.equal(value.imageScoredRows, 200);
  assert.equal(value.candidateLimit, 50); assert.equal(value.resultLimit, 5);
  assert.equal(value.statusPreserved, true); assert.equal(value.weightedScoresVerified, true);
  assertSemanticStudyPlan(value.plan);
}
