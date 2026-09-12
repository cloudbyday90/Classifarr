/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { runPolicyShortlistReplay, reducePolicyShortlistReplayResponse } from '../../services/policyShortlistReplay.mjs';
import { preparePolicyShortlistReplayCase } from '../../services/policyShortlistReplayCase.mjs';
import { runInventoryDescriptionBenchmark } from '../../scripts/runInventoryDescriptionBenchmark.mjs';
import { consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';

const settings = { seed: 'policy-shortlist-replay-20260912', size: 10, generateCases: 10 };
function fixture() {
  const libraries = [1, 2, 3, 4, 5].map(id => ({ id, name: `Private library ${id}`, media_type: 'movie', is_active: true }));
  const policyResult = { action: 'manual', confidence: 45,
    ranked: libraries.map(library => ({ library_id: library.id, score: 45, auto_classify_threshold: 85, prompt_threshold: 60 })) };
  const entry = { policyResult, metadata: { title: 'Private item', overview: 'Private synopsis', tmdb_id: 999, media_type: 'movie', genres: ['Documentary'] } };
  const source = { config: { rag_enabled: true, primary_provider: 'ollama', ollama_host: 'localhost', ollama_model: 'test:latest' },
    cases: [entry], libraries, fingerprint: 'a'.repeat(64), retainedIdentities: 1, skippedMetadata: 0 };
  const evidence = { statusId: 'available', candidates: libraries.map(({ id }) => ({ libraryId: id, eligible: 20, indexed: 20,
    learnedProfile: { version: 'contrastive_profile_v1', snapshotId: 'b'.repeat(64), trainingDescriptions: 100,
      statusId: 'available', relativeFit: id === 4 ? 1 : -1 },
    items: [1, 2, 3].map(index => ({ description: `Private evidence ${id}:${index}`, similarity: id === 5 ? .9 : .6, sharedAcrossCandidates: false })) })) };
  const client = { inspect: jest.fn(async () => ({ model: 'test:latest', digest: 'c'.repeat(64), contextLength: 32768 })),
    generate: jest.fn(async ({ prompt, onGenerationCall }) => { onGenerationCall(); return {
      response: `CONFIDENT|${prompt.includes('Private library 5') ? 3 : 1}|95|Private reason`, latencyMs: 3, promptTokens: 100 }; }) };
  const runtime = { repository: { read: jest.fn(async () => structuredClone(source)) },
    retrieve: jest.fn(async () => evidence), readProfile: jest.fn(async () => null), retrieveCurrent: jest.fn(async () => null),
    createClient: jest.fn(() => client), close: jest.fn() };
  return { runtime, source, entry, evidence, client };
}

test('real prompt, parser and gates compare changed shortlists without routing capabilities or private reports', async () => {
  const { runtime, source, client } = fixture(), before = structuredClone(source);
  const report = await runPolicyShortlistReplay(settings, { loadRuntime: async () => runtime });
  expect(report).toMatchObject({ status: 'complete', sampledTitles: 1, retainedIdentities: 1, changedShortlists: 1,
    calls: 2, reusedResults: 0, paired: { valid: 1, changedProposals: 1, newlyConsensusEligible: 0 },
    accuracy: null, routingReceiptsCreated: 0, userQuestionsCreated: 0, learningRecordsCreated: 0 });
  expect(report.effectiveOutcomes.every(arm => arm.automaticRouteAllowed === 0 && arm.consensusReasons.policy_review_required === 1)).toBe(true);
  expect(runtime.retrieve).toHaveBeenCalledTimes(1);
  expect(runtime.readProfile).toHaveBeenCalledTimes(4);
  expect(client.generate.mock.calls.every(([request]) => request.responseContract === 'adjudication')).toBe(true);
  expect(JSON.stringify(report)).not.toMatch(/Private|tmdb|destinationId|ollama_host/);
  expect(source).toEqual(before);
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('identical prompts reuse one generation and report actual versus effective arms', async () => {
  const { runtime, evidence } = fixture();
  evidence.candidates[4].items.forEach(item => { item.similarity = .1; });
  const report = await runPolicyShortlistReplay(settings, { loadRuntime: async () => runtime });
  expect(report).toMatchObject({ calls: 1, reusedResults: 1, changedShortlists: 0, paired: { valid: 1, changedProposals: 0 } });
  expect(report.arms.map(arm => arm.finished)).toEqual([1, 0]);
  expect(report.effectiveOutcomes.map(arm => arm.finished)).toEqual([1, 1]);
});

test.each(['partial', 'missing', 'extra', 'duplicate'])('unusable %s evidence never reaches generation', async kind => {
  const { runtime, evidence, client } = fixture();
  if (kind === 'partial') evidence.statusId = 'partial';
  if (kind === 'missing') evidence.candidates.pop();
  if (kind === 'extra') evidence.candidates.push({ libraryId: 999 });
  if (kind === 'duplicate') evidence.candidates[0].libraryId = 2;
  expect(await runPolicyShortlistReplay(settings, { loadRuntime: async () => runtime }))
    .toMatchObject({ status: 'completed_with_errors', calls: 0, preparation: { evidence_unavailable: 1 } });
  expect(client.generate).not.toHaveBeenCalled();
});

test.each(['invalid', 'limited', 'failed', 'cancelled'])('rejects %s outputs rather than retaining an advisory as a valid proposal', async kind => {
  const { runtime, client } = fixture(), controller = new AbortController();
  client.generate.mockImplementation(async ({ onGenerationCall }) => {
    onGenerationCall();
    if (kind === 'failed') throw new Error('PRIVATE provider secret');
    if (kind === 'cancelled') controller.abort();
    return { response: kind === 'invalid' ? 'CONFIDENT|99|100|PRIVATE' : 'CONFIDENT|1|99|PRIVATE', outputLimitReached: kind === 'limited' };
  });
  const report = await runPolicyShortlistReplay(settings, { loadRuntime: async () => runtime, signal: controller.signal });
  expect(report.status).toBe(kind === 'cancelled' ? 'interrupted' : 'completed_with_errors');
  expect(report.paired.valid).toBe(0);
  expect(JSON.stringify(report)).not.toContain('PRIVATE');
});

test('shared candidate drift, source drift and cancellation are not accepted as paired evidence', async () => {
  const { runtime, source, entry } = fixture();
  let read = 0;
  runtime.retrieveCurrent.mockImplementation(async () => ({ statusId: 'available', candidates: [{ libraryId: 1, matchCount: ++read, items: [] }] }));
  expect(await preparePolicyShortlistReplayCase(entry, source, runtime)).toEqual({ status: 'evidence_changed' });
  runtime.repository.read.mockResolvedValueOnce(source).mockResolvedValue({ ...source, fingerprint: 'changed' });
  await expect(runPolicyShortlistReplay({ ...settings, generateCases: 0 }, { loadRuntime: async () => runtime })).rejects.toThrow('source_changed');
  expect(runtime.close).toHaveBeenCalledTimes(1);
  const controller = new AbortController(); controller.abort();
  const loadRuntime = jest.fn();
  await expect(runPolicyShortlistReplay(settings, { signal: controller.signal, loadRuntime })).rejects.toThrow();
  expect(loadRuntime).not.toHaveBeenCalled();
});

test('threshold-qualified replay reports potential consensus but cannot mint live routing authority', () => {
  const input = consensusFixture(), entry = { ...input, arms: { baseline: { contract: input.contract, evidence: input.evidence } } };
  const result = reducePolicyShortlistReplayResponse(entry, 'baseline', { response: 'CONFIDENT|2|95|Private' }, { model: 'test:latest' });
  expect(result).toMatchObject({ status: 'proposed', destinationId: 2, consensusEligible: true, automaticRouteAllowed: false });
  expect(result).not.toHaveProperty('library_consensus_auto');
});

test('limited responses retain usage and rejected JSON exposes only schema-owned field names', () => {
  const input = consensusFixture(), entry = { ...input, arms: { baseline: { contract: input.contract, evidence: input.evidence } } };
  const usage = { latencyMs: 123, promptTokens: 2000, outputTokens: 256 };
  for (const [flag, status] of [['outputLimitReached', 'output_limited'], ['contextLimitSuspected', 'context_limit_suspected']]) {
    expect(reducePolicyShortlistReplayResponse(entry, 'baseline', { ...usage, [flag]: true }, { model: 'test:latest' }))
      .toEqual({ status, ...usage });
  }
  const result = reducePolicyShortlistReplayResponse(entry, 'baseline', { ...usage, response: JSON.stringify({
    decision: 'CONFIDENT', library_number: 2, confidence: 95, reason: 'Private reason', question: '',
  }) }, { model: 'test:latest' });
  expect(result).toMatchObject({ status: 'response_rejected', validationFields: ['question'], ...usage });
  expect(JSON.stringify(result)).not.toMatch(/Private|validation_errors/);
});

test('CLI preflight runs without generation; incompatible modes fail before either runtime loads', async () => {
  const { runtime } = fixture(), loadRuntime = jest.fn(), loadReplayRuntime = jest.fn(async () => runtime);
  const args = ['--seed', settings.seed, '--policy-shortlist-replay'];
  const report = await runInventoryDescriptionBenchmark({ argv: args, loadRuntime, loadReplayRuntime });
  expect(report).toMatchObject({ status: 'preflight', calls: 0, sampledTitles: 1, accuracy: null });
  expect(runtime.createClient).not.toHaveBeenCalled();
  for (const extra of [['--folds', '5'], ['--exclude-prior-size', '1'], ['--learned-profiles'], ['--content-first-comparison']]) {
    await expect(runInventoryDescriptionBenchmark({ argv: [...args, ...extra], loadRuntime, loadReplayRuntime })).rejects.toThrow();
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  expect(loadReplayRuntime).toHaveBeenCalledTimes(1);
});
