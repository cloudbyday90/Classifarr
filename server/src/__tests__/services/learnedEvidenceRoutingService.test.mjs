/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';
import { learnedRoutingDependencies, learnedRoutingFixture } from '../fixtures/learnedEvidenceRoutingFixture.mjs';

async function setup() {
  const input = learnedRoutingFixture(), deps = learnedRoutingDependencies(input);
  Object.entries(deps).forEach(([key, value]) => { if (typeof value === 'function') deps[key] = jest.fn(value); });
  deps.retriever.retrieve = jest.fn(deps.retriever.retrieve);
  const service = createLearnedEvidenceRoutingService(deps);
  input.learnedContext = await service.prepare(input);
  return { input, deps, service };
}

test.each(['manual', 'prompt_select'])('fresh %s review qualifies at the original score, not model confidence', async action => {
  const input = learnedRoutingFixture(), deps = learnedRoutingDependencies(input);
  input.policyResult.action = action;
  const original = structuredClone(input);
  const service = createLearnedEvidenceRoutingService(deps), learnedContext = await service.prepare(input);
  const result = await service.resolve({ ...input, learnedContext });
  expect(input).toEqual(original);
  expect(result).toMatchObject({ method: 'library_consensus_auto', confidence: 45, needs_clarification: false });
  expect(result.ai_authority).toBeUndefined();
  expect(result.reason).not.toContain('threshold');
  expect(hasCandidateConsensusReceipt(result, { metadata: input.metadata })).toBe(true);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(true);
  expect(evaluateClassificationRouteSafety({ result, requireAllConfirmations: true }).automatic_route_allowed).toBe(false);
  expect(hasCandidateConsensusReceipt(JSON.parse(JSON.stringify(result)))).toBe(false);
  expect(hasCandidateConsensusReceipt({ ...result, confidence: 99 })).toBe(false);
  expect(hasCandidateConsensusReceipt(result, { metadata: { ...input.metadata, tmdb_id: 1000 } })).toBe(false);
});

test.each([
  ['absent context', i => { delete i.learnedContext; }],
  ['serialized context', i => { i.learnedContext = JSON.parse(JSON.stringify(i.learnedContext)); }],
  ['changed query', i => { i.metadata.overview += ' changed'; }],
  ['changed policy', i => { i.policyResult.ranked[1].score++; }],
  ['changed contract', i => { i.contract = { ...i.contract, candidates: i.contract.candidates.slice(0, 2) }; }],
  ['changed prompt evidence', i => { i.evidence.candidates[0].descriptionEvidence.items[0].description += '!'; }],
  ['changed destination', i => { i.libraries[1].root_folder = '/elsewhere'; }],
  ['abstention', i => { i.aiMatch.needs_clarification = true; }],
  ['remote provider', i => { i.aiMatch.ai_authority.providerId = 'remote'; }],
  ['fallback', i => { i.aiMatch.ai_authority.isFallback = true; }],
  ['different model', i => { i.aiMatch.ai_authority.model = 'other:latest'; }],
  ['rejected result', i => { i.result.candidate_adjudication.statusId = 'response_rejected'; }],
  ['wrong result destination', i => { i.result.library = i.libraries[0]; }],
  ['wrong proposed destination', i => { i.result.candidate_adjudication.proposedDestination.library_id = 3; }],
  ['result retry', i => { i.result.needs_retry = true; }],
  ['provider recovery', i => { i.result.provider_recovery = {}; }],
])('retains review for %s', async (_name, mutate) => {
  const { input, service } = await setup();
  mutate(input);
  expect(await service.resolve(input)).toBe(input.result);
});

test.each([
  ['changed policy definitions', 'readPolicies', i => i.policies.map(p => ({ ...p, priority: 10 }))],
  ['unknown policy constraint', 'readPolicies', i => i.policies.map(p => ({ ...p, native_intent: { newRule: true } }))],
  ['disabled RAG', 'readConfig', () => ({ rag_enabled: false })],
  ['admin confirmation', 'readConfig', () => ({ confirmation_setting: 'true' })],
  ['changed policy outcome', 'readPolicy', i => ({ ...i.policyResult, action: 'prompt_confirm' })],
  ['changed threshold', 'readPolicy', i => { const p = structuredClone(i.policyResult); p.ranked[1].auto_classify_threshold++; return p; }],
  ['disabled library', 'readLibraries', i => i.libraries.filter(l => l.id !== 2)],
  ['duplicate library', 'readLibraries', i => [i.libraries[0], i.libraries[0], i.libraries[2]]],
  ['changed folder', 'readLibraries', i => i.libraries.map(l => ({ ...l, root_folder: '/new' }))],
])('retains review after %s', async (_name, key, value) => {
  const { input, deps, service } = await setup();
  deps[key].mockImplementation(async () => value(input));
  expect(await service.resolve(input)).toBe(input.result);
});

test.each(['readConfig', 'readPolicies', 'readPolicy', 'readLibraries'])('read errors in %s never grant authority', async key => {
  const { input, deps, service } = await setup();
  deps[key].mockRejectedValue(new Error('PRIVATE error'));
  expect(await service.resolve(input)).toBe(input.result);
});

test('one-use context cannot be replayed and drift during final revalidation cannot grant authority', async () => {
  const { input, deps, service } = await setup();
  deps.retriever.retrieve.mockResolvedValueOnce(input.reviewEvidence).mockResolvedValueOnce({ ...input.reviewEvidence, statusId: 'partial' });
  expect(await service.resolve(input)).toBe(input.result);
  expect(await service.resolve(input)).toBe(input.result);
  expect(deps.retriever.retrieve).toHaveBeenCalledTimes(2);
});

test.each(['readConfig', 'readPolicies'])('rejects final %s drift', async key => {
  const { input, deps, service } = await setup();
  const original = await deps[key]();
  deps[key].mockResolvedValueOnce(original).mockResolvedValueOnce(null);
  expect(await service.resolve(input)).toBe(input.result);
});

test('asynchronous result tampering cannot change the issued destination or score', async () => {
  const { input, deps, service } = await setup();
  deps.readPolicy.mockImplementation(async () => {
    input.result.candidate_adjudication.proposedDestination.library_id = 1;
    return structuredClone(input.policyResult);
  });
  expect(await service.resolve(input)).toBe(input.result);
});

test('fresh outside-shortlist competitor prevents routing and all pool libraries are retrieved', async () => {
  const input = learnedRoutingFixture();
  input.libraries.push({ ...input.libraries[0], id: 4 });
  input.policyResult.ranked.push({ ...input.policyResult.ranked[0], library_id: 4, policy_id: 4 });
  input.policies.push({ ...input.policies[0], id: 4, library_id: 4 });
  input.reviewEvidence.candidates.push({ ...structuredClone(input.reviewEvidence.candidates[0]), libraryId: 4,
    items: [0, 1, 2].map(n => ({ description: `Rival ${n}`, similarity: .99, sharedAcrossCandidates: false })) });
  const deps = learnedRoutingDependencies(input);
  deps.retriever.retrieve = jest.fn(deps.retriever.retrieve);
  const service = createLearnedEvidenceRoutingService(deps), learnedContext = await service.prepare(input);
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
  expect(deps.retriever.retrieve.mock.calls[0][0].contract.candidates.map(c => c.libraryId)).toEqual([1, 2, 3, 4]);
});

test.each([-1, 300001, NaN])('expired or invalid clocks reject the prepared request (%s)', async elapsed => {
  const input = learnedRoutingFixture();
  let clock = 1000;
  const service = createLearnedEvidenceRoutingService({ ...learnedRoutingDependencies(input), now: () => clock });
  const learnedContext = await service.prepare(input);
  clock += elapsed;
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
});

test('invalid preparation time cannot create a usable context', async () => {
  const input = learnedRoutingFixture();
  expect(await createLearnedEvidenceRoutingService({ ...learnedRoutingDependencies(input), now: () => NaN }).prepare(input)).toBeNull();
});

test.each(['prompt_confirm', 'auto_classify'])('does not prepare an explicit %s path', async action => {
  const input = learnedRoutingFixture(); input.policyResult.action = action;
  expect(await createLearnedEvidenceRoutingService(learnedRoutingDependencies(input)).prepare(input)).toBeNull();
});

test('preparation rejects unavailable, remote, restricted and unknown inputs', async () => {
  const input = learnedRoutingFixture(), deps = learnedRoutingDependencies(input);
  for (const config of [null, { rag_enabled: false }, { ...(await deps.readConfig()), confirmation_setting: 'true' },
    { ...(await deps.readConfig()), ollama_host: 'https://example.org' }]) {
    expect(await createLearnedEvidenceRoutingService({ ...deps, readConfig: async () => config }).prepare(input)).toBeNull();
  }
  expect(await createLearnedEvidenceRoutingService({ ...deps, readPolicies: async () => { throw new Error('offline'); } }).prepare(input)).toBeNull();
  input.policyResult.decisionDiagnostics.reason_code = 'operator_hold';
  expect(await createLearnedEvidenceRoutingService(deps).prepare(input)).toBeNull();
});
