/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { createPolicyCandidateConsensusService } from '../../services/policyCandidateConsensusService.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { consensusDependencies, consensusFixture } from '../fixtures/policyCandidateConsensusFixture.mjs';

describe('consensus revalidation service', () => {
  test('captures provider configuration before generation and fails closed if unavailable', async () => {
    const input = consensusFixture(), dependencies = consensusDependencies(input);
    const service = createPolicyCandidateConsensusService(dependencies);
    expect(await service.prepare(input.policyResult)).toBe(input.consensusContext);
    expect(await service.prepare({ action: 'manual' })).toBeNull();
    expect(await service.prepare({ ...input.policyResult, decisionDiagnostics: { requires_manual_review: true } })).toBeNull();
    const failing = createPolicyCandidateConsensusService({ readConfig: async () => { throw new Error('offline'); } });
    expect(await failing.prepare(input.policyResult)).toBeNull();
  });

  test('a missing pre-generation snapshot cannot grant routing', async () => {
    const input = consensusFixture();
    delete input.consensusContext;
    expect(await createPolicyCandidateConsensusService(consensusDependencies(input)).resolve(input)).toBe(input.result);
  });
  test('preserves advisory inputs, rechecks current evidence and grants only the selected policy score', async () => {
    const input = consensusFixture(), before = structuredClone(input);
    const dependencies = consensusDependencies(input);
    dependencies.readPolicy = jest.fn(dependencies.readPolicy);
    dependencies.readEvidence = jest.fn(dependencies.readEvidence);
    const result = await createPolicyCandidateConsensusService(dependencies).resolve(input);
    expect(input).toEqual(before);
    expect(result).toMatchObject({ method: 'library_consensus_auto', confidence: 86, needs_clarification: false });
    expect(hasCandidateConsensusReceipt(result, { metadata: input.metadata })).toBe(true);
    expect(result.ai_authority).toBeUndefined();
    expect(result.reason).not.toContain('99');
    expect(dependencies.readPolicy).toHaveBeenCalledWith(input.metadata, input.policyResult, undefined);
    expect(dependencies.readEvidence).toHaveBeenCalledTimes(1);
  });

  test('does not perform extra reads for an ineligible result', async () => {
    const input = consensusFixture(), readPolicy = jest.fn();
    input.policyResult.ranked[1].score = 45;
    expect(await createPolicyCandidateConsensusService({ readPolicy }).resolve(input)).toBe(input.result);
    expect(readPolicy).not.toHaveBeenCalled();
  });

  test.each([
    ['policy changed', 'readPolicy', i => ({ ...i.policyResult, action: 'manual' })],
    ['threshold changed', 'readPolicy', i => { const p = structuredClone(i.policyResult); p.ranked[1].auto_classify_threshold = 90; return p; }],
    ['evidence changed', 'readEvidence', i => { const e = structuredClone(i.evidence); e.candidates[1].descriptionEvidence.items[0].description += ' changed'; return e; }],
    ['evidence unavailable', 'readEvidence', () => null],
    ['library disabled', 'readLibraries', i => i.libraries.filter(l => l.id !== 2)],
    ['destination changed', 'readLibraries', i => i.libraries.map(l => ({ ...l, root_folder: '/changed' }))],
    ['RAG disabled', 'readConfig', () => ({ rag_enabled: false })],
    ['remote host', 'readConfig', () => ({ rag_enabled: true, primary_provider: 'ollama', ollama_model: 'test:latest', ollama_host: 'https://example.org' })],
    ['different model', 'readConfig', () => ({ rag_enabled: true, primary_provider: 'ollama', ollama_model: 'changed:latest', ollama_host: 'http://localhost:11434' })],
  ])('returns the original review when %s', async (_name, key, value) => {
    const input = consensusFixture();
    const dependencies = { ...consensusDependencies(input), [key]: async () => value(input) };
    expect(await createPolicyCandidateConsensusService(dependencies).resolve(input)).toBe(input.result);
  });

  test.each(['readPolicy', 'readEvidence', 'readLibraries', 'readConfig'])('fails closed on %s errors', async key => {
    const input = consensusFixture();
    const dependencies = { ...consensusDependencies(input), [key]: async () => { throw new Error('unavailable'); } };
    expect(await createPolicyCandidateConsensusService(dependencies).resolve(input)).toBe(input.result);
  });

  test('rejects configuration changes during revalidation', async () => {
    const input = consensusFixture(), dependencies = consensusDependencies(input);
    const config = await dependencies.readConfig();
    dependencies.readConfig = jest.fn().mockResolvedValueOnce(config).mockResolvedValueOnce({ ...config, rag_enabled: false });
    expect(await createPolicyCandidateConsensusService(dependencies).resolve(input)).toBe(input.result);
  });

  test('ignores elapsed telemetry when comparing fresh evidence', async () => {
    const input = consensusFixture(), dependencies = consensusDependencies(input);
    dependencies.readEvidence = async () => ({ ...structuredClone(input.evidence), latencyMs: 500 });
    const result = await createPolicyCandidateConsensusService(dependencies).resolve(input);
    expect(hasCandidateConsensusReceipt(result)).toBe(true);
  });

  test.each(['abstained', 'response_rejected'])('never upgrades a %s advisory', async statusId => {
    const input = consensusFixture();
    input.result.candidate_adjudication.statusId = statusId;
    expect(await createPolicyCandidateConsensusService(consensusDependencies(input)).resolve(input)).toBe(input.result);
  });
});
