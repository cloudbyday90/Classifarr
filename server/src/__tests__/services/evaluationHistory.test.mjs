/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test, jest } from '@jest/globals';
import { evaluationHistoryFixture } from '../fixtures/evaluationHistoryFixture.mjs';
import { validEvaluationHistory, createEvaluationHistory } from '../../services/evaluationHistoryContract.mjs';
import { projectEvaluationHistory } from '../../services/evaluationHistorySummary.mjs';
import { appendEvaluationHistory, readEvaluationHistory } from '../../services/evaluationHistoryRepository.mjs';
import { createAutomaticSourcePairRepository } from '../../services/automaticSourcePairRepository.mjs';
import { executeAutomaticSourcePair } from '../../services/automaticSourcePairExecution.mjs';
import { sourcePairFixture, sourcePairIdentity } from '../fixtures/sourceDescriptionPairFixture.mjs';
import { projectAdjudicationConfig } from '../../services/cachedAdjudicationRepository.mjs';

const row = (result = evaluationHistoryFixture(), observed_at = '2026-09-25T12:00:00Z') => ({ result, observed_at });
test('latest completed distinct items survive repeated windows and later cache misses, without mixing revisions', () => {
  const rows = [row(evaluationHistoryFixture({ status: 'misses' })), row(evaluationHistoryFixture({ offset: 20 })), row(), row(),
    row(evaluationHistoryFixture({ revision: 'different' }))];
  const summary = projectEvaluationHistory(rows);
  expect(summary).toMatchObject({ windows: 5, revisions: 2, providerCalls: 0, routingWrites: 0, fullPipelineAccuracy: null });
  expect(summary.groups[0]).toMatchObject({ selected: 45, paired: 45, labeled: 45, gains: 45, regressions: 0 });
  expect(summary.groups[1].paired).toBe(25);
  expect(summary.groups[0].moviePaired + summary.groups[0].tvPaired).toBe(45);
  expect(JSON.stringify(summary)).not.toMatch(/item-|revision"|evidenceRevision|modelRevision/);
});

test('empty history, missing labels, and invalid responses cannot be accuracy successes', () => {
  expect(projectEvaluationHistory([])).toMatchObject({ windows: 0, revisions: 0, groups: [] });
  expect(projectEvaluationHistory([row(evaluationHistoryFixture({ labeled: false }))]).groups[0]).toMatchObject({ paired: 25, labeled: 0, gains: 0 });
  expect(projectEvaluationHistory([row(evaluationHistoryFixture({ status: 'invalid' }))]).groups[0]).toMatchObject({ selected: 25, paired: 0 });
  expect(projectEvaluationHistory(Array.from({ length: 8 }, (_, revision) => row(evaluationHistoryFixture({ revision })))).groups).toHaveLength(6);
});

test.each([
  value => { value.private = 'secret'; }, value => { value.cases[0].private = 'secret'; },
  value => { value.version = 'unknown'; }, value => { value.revision = 'a'.repeat(64); },
  value => { value.cases = Array(26).fill(value.cases[0]); }, value => { value.cases[0] = null; },
  value => { value.cases[1] = value.cases[0]; }, value => { value.cases[0].mediaType = 'music'; },
  value => { value.cases[0].paired = false; }, value => { value.cases[0].regression = true; },
  value => { value.cases[0].gain = 1; }, value => { value.sampled = 301; }, value => { value.eligible = -1; },
  value => { value.offset = 300; }, value => { value.offset = 50; },
  value => { value.cases[0].deferralReduced = true; value.cases[0].deferralIncreased = true; },
])('rejects malformed/private/impossible records', mutate => {
  const value = evaluationHistoryFixture(); mutate(value);
  expect(validEvaluationHistory(value)).toBe(false);
  expect(() => projectEvaluationHistory([row(value)])).toThrow('invalid');
});

test('guards input bounds, timestamps and inconsistent within-revision populations', async () => {
  expect(() => projectEvaluationHistory(Array(501).fill(row()))).toThrow('invalid');
  expect(() => projectEvaluationHistory([row(undefined, 'invalid')])).toThrow('invalid');
  const changed = evaluationHistoryFixture(); changed.sampled++;
  expect(() => projectEvaluationHistory([row(), row(changed)])).toThrow('inconsistent');
  const client = { query: jest.fn(async () => ({ rows: [row()] })) };
  expect(await readEvaluationHistory({ withTransaction: callback => callback(client) })).toMatchObject({ windows: 1 });
  expect(client.query.mock.calls[0][0]).toContain('READ ONLY');
  await expect(appendEvaluationHistory(client, {}, new Date())).rejects.toThrow('invalid');
});

test('real replay derives bounded private case facts; windows and response contents do not change comparison provenance', async () => {
  const source = sourcePairFixture(60);
  source.evaluationRows = source.rows;
  source.policies = source.libraries.map(library => ({ id: library.id, library_id: library.id, enabled: true,
    name: 'PRIVATE', library_name: library.name, library_media_type: library.media_type,
    priority: 1, auto_classify_threshold: 85, prompt_threshold: 60, profile_weight: .5, rag_weight: .5,
    trust_rag: true, trust_patterns: false, trust_history: false, presets: [] }));
  source.policySourceRevisionRows = source.policies.map(policy => ({ policy_id: policy.id,
    media_type: policy.library_media_type, source_updated_at: '2026-09-01', mutable_attachment: false }));
  source.adjudicationConfig = projectAdjudicationConfig({ primary_provider: 'ollama', ollama_model: 'PRIVATE:latest', ollama_host: 'localhost' });
  const snapshot = { observedAt: '2026-09-25T12:00:00Z', inputs: { source, identity: sourcePairIdentity } };
  const result = await executeAutomaticSourcePair(snapshot, null, { includePlan: true });
  expect(validEvaluationHistory(result.history, result.report)).toBe(true);
  expect(result.history.cases).toHaveLength(result.report.aiReplay.selected);
  expect(validEvaluationHistory(result.history, { ...result.report, aiReplay: { ...result.report.aiReplay, paired: 999 } })).toBe(false);
  source.adjudicationSelectionOffset = 25;
  const shifted = createEvaluationHistory(snapshot, result, []);
  expect(shifted.revision).toBe(result.history.revision);
  source.adjudicationBatch = { version: 'cached_adjudication.v1', configuration: source.adjudicationConfig.fingerprint,
    identity: { model: 'PRIVATE:latest', digest: 'a'.repeat(64), contextLength: 8192 }, records: [] };
  const model = createEvaluationHistory(snapshot, result, []);
  expect(model.evidenceRevision).toBe(shifted.evidenceRevision); expect(model.revision).not.toBe(shifted.revision);
  source.adjudicationBatch.identity.digest = 'b'.repeat(64);
  expect(createEvaluationHistory(snapshot, result, []).revision).not.toBe(model.revision);
  source.policies[0].priority++;
  expect(createEvaluationHistory(snapshot, result, []).evidenceRevision).not.toBe(model.evidenceRevision);
  expect(JSON.stringify(result.history)).not.toMatch(/PRIVATE|prompt|response|localhost/);
});

test('singleton publication and history share a transaction; superseded results never append', async () => {
  const source = sourcePairFixture(); source.policies = [];
  const result = await executeAutomaticSourcePair({ observedAt: '2026-09-25T12:00:00Z', inputs: { source, identity: sourcePairIdentity } }, null);
  const client = { query: jest.fn(async sql => ({ rowCount: sql.includes('INSERT INTO automatic_source_pair_evaluation') ? 0 : 1 })) };
  const repository = createAutomaticSourcePairRepository({ withTransaction: callback => callback(client) });
  expect(await repository.save(result.fingerprint, result.report, '2026-09-25T12:00:00Z', undefined, result)).toBe(false);
  expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO automatic_evaluation_history'))).toBe(false);
  expect(() => repository.save(result.fingerprint, result.report, '2026-09-25T12:00:00Z', undefined,
    { ...result, history: evaluationHistoryFixture() })).toThrow('invalid');
});
