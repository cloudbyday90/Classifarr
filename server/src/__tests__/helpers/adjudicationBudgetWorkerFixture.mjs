/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { executeAutomaticSourcePair } from '../../services/automaticSourcePairExecution.mjs';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';

export async function createAdjudicationBudgetWorkerFixture() {
  const source = sourcePairFixture();
  source.evaluationRows = source.rows.map(row => ({ ...row, title: 'Synthetic item', year: 2020 }));
  source.rows = source.evaluationRows;
  source.policies = source.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    name: 'Synthetic policy', library_name: library.name, library_media_type: library.media_type, priority: 1,
    auto_classify_threshold: 85, prompt_threshold: 60, profile_weight: .5, rag_weight: .5,
    trust_rag: true, trust_patterns: false, trust_history: false, presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type, source_updated_at: '2026-09-01', mutable_attachment: false }));
  const snapshot = { observedAt: '2026-09-25 01:00:00+00', inputs: { source, identity: sourcePairIdentity } };
  const prepared = await executeAutomaticSourcePair(snapshot, null);
  const evaluation = { status: 'complete', report: prepared.report, input_fingerprint: prepared.fingerprint,
    cohort: prepared.cohort, cohort_created_at: prepared.cohortCreatedAt };
  const state = { revision: 1, daily_calls: 20, daily_tokens: 168960, calls_reserved: 0, tokens_reserved: 0, cooling_down: false };
  const checkpoint = { publish: jest.fn() };
  const budget = { read: jest.fn(async () => state), finish: jest.fn(async () => ({ rowCount: 1 })),
    advance: jest.fn(), reserve: jest.fn(), checkpoint: jest.fn(() => checkpoint) };
  const capture = jest.fn(async (_options, dependencies) => {
    await dependencies.onPublished(prepared.fingerprint, true, new AbortController().signal);
    return { calls: 5, reused: 0, stored: 5 };
  });
  const repository = { readState: jest.fn(async () => evaluation), readSnapshot: jest.fn(async () => snapshot) };
  const owner = { claimFinalization: jest.fn(async revision => ({ revision, attemptId: '41db1265-8bc1-4ab3-992f-885799a4af1d' })) };
  const dependencies = { budget, repository, capture, withAdmission: (callback, { signal }) => callback(signal, undefined, owner),
    withWorkload: (callback, { signal }) => callback(signal, async () => {}) };
  return { state, budget, capture, repository, evaluation, snapshot, prepared, dependencies,
    worker: createAdjudicationBudgetWorker(dependencies) };
}
