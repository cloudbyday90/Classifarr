/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { jest } from '@jest/globals';
import { validateFrozenInventoryInput, projectFrozenInventoryWorkerInput,
  validateFrozenInventoryWorkerInput } from '../../services/operatorCorrectionFrozenInventoryInput.mjs';
import { captureOperatorCorrectionFrozenInventoryInput } from '../../services/operatorCorrectionFrozenInventoryCapture.mjs';
import { runIsolatedReleaseDecisionWorker } from '../../scripts/isolatedReleaseDecisionWorker.mjs';
import { buildReleaseDecisionPair } from '../../services/operatorCorrectionReleaseDecisionPair.mjs';
import { createIsolatedFrozenPolicyScorer } from '../../services/isolatedFrozenPolicyScoring.mjs';

const base = JSON.parse(await readFile(new URL('../../../../scripts/fixtures/frozen-policy-pair.synthetic-example.json',
  import.meta.url), 'utf8'));
const syntheticInventory = JSON.parse(await readFile(new URL('../../../../scripts/fixtures/frozen-inventory-pair.synthetic-example.json',
  import.meta.url), 'utf8'));
const noRequest = () => ({ ...structuredClone(base), version: 3,
  cases: base.cases.map(row => ({ ...structuredClone(row), inventory:
    { statusId: 'not_requested', contract: null, evidence: null } })) });
const withEvidence = () => {
  const input = noRequest();
  input.cases[0].inventory = { statusId: 'captured', contract: [3, 4], evidence: {
    statusId: 'available', candidates: [3, 4].map(libraryId => ({ libraryId, eligible: true, indexed: true,
      learnedProfile: { version: 'contrastive_profile_v1', snapshotId: 'd'.repeat(64),
        relativeFit: 0.4, statusId: 'available', trainingDescriptions: 10 },
      items: [{ description: 'A bounded synthetic description', similarity: 0.8,
        sharedAcrossCandidates: false }] })) } };
  return input;
};

test('v3 projects label-free bounded inventory evidence to both workers', () => {
  const input = withEvidence();
  const worker = projectFrozenInventoryWorkerInput(input);
  expect(validateFrozenInventoryWorkerInput(worker)).toBe(worker);
  expect(JSON.stringify(worker)).not.toContain('labelLibraryId');
  expect(worker.cases[0].inventory.contract).toEqual([3, 4]);
});

test('the committed v3 smoke fixture is accepted without exposing labels to workers', () => {
  const worker = projectFrozenInventoryWorkerInput(syntheticInventory);
  expect(worker.cases[0].inventory.statusId).toBe('captured');
  expect(JSON.stringify(worker)).not.toContain('labelLibraryId');
});

test.each(['foreign field', 'wrong candidate', 'unbounded description', 'duplicate pool', 'unknown status'])(
  'v3 rejects %s', kind => {
    const input = withEvidence();
    const inventory = input.cases[0].inventory;
    if (kind === 'foreign field') inventory.sourceId = 'private';
    if (kind === 'wrong candidate') inventory.evidence.candidates[0].libraryId = 5;
    if (kind === 'unbounded description') inventory.evidence.candidates[0].items[0].description = 'x'.repeat(10_001);
    if (kind === 'duplicate pool') inventory.contract[1] = 3;
    if (kind === 'unknown status') inventory.statusId = 'maybe';
    expect(() => validateFrozenInventoryInput(input)).toThrow();
  });

test('capture records only the exact requested pool and fails closed on a duplicate request', async () => {
  const sample = { foldIndex: 0, mediaType: 'movie' };
  const evidence = { forCase: jest.fn(() => ({ retrieve: async () => withEvidence().cases[0].inventory.evidence })) };
  const evaluate = jest.fn(async (_sample, _source, _evidence, _signal, { retriever }) => {
    await retriever.retrieve({ contract: { valid: true, candidates: [
      { libraryId: 3, mediaType: 'movie' }, { libraryId: 4, mediaType: 'movie' }] } });
  });
  const input = await captureOperatorCorrectionFrozenInventoryInput({ policyInput: base,
    prepared: { cases: [sample] }, source: { policies: base.policies }, evidence, evaluate });
  expect(input.cases[0].inventory.statusId).toBe('captured');
  expect(input.cases[0].inventory.contract).toEqual([3, 4]);
  expect(evaluate).toHaveBeenCalledTimes(1);
  const duplicate = async (...args) => { await evaluate(...args); await evaluate(...args); };
  await expect(captureOperatorCorrectionFrozenInventoryInput({ policyInput: base,
    prepared: { cases: [sample] }, source: {}, evidence, evaluate: duplicate }))
    .rejects.toThrow('frozen_inventory_capture_contract_invalid');
});

test('capture does not turn a swallowed retriever failure into not_requested', async () => {
  const evidence = { forCase: () => ({ retrieve: async () => { throw new Error('private backend detail'); } }) };
  const evaluate = async (_sample, _source, _evidence, _signal, { retriever }) => {
    try { await retriever.retrieve({ contract: { valid: true, candidates: [
      { libraryId: 3, mediaType: 'movie' }, { libraryId: 4, mediaType: 'movie' }] } }); } catch { /* production fallback */ }
  };
  await expect(captureOperatorCorrectionFrozenInventoryInput({ policyInput: base,
    prepared: { cases: [{ mediaType: 'movie' }] }, source: {}, evidence, evaluate }))
    .rejects.toThrow('frozen_inventory_capture_contract_invalid');
});

test('v3 pair reports replay coverage and remains non-promoting', async () => {
  const input = withEvidence();
  const workerInput = projectFrozenInventoryWorkerInput(input);
  const loadScorer = async role => async ({ onInventoryStatus }) => {
    if (role === 'candidate') onInventoryStatus?.('used');
    return { action: 'prompt_confirm', topCandidate: { library_id: 3 } };
  };
  const baseline = await runIsolatedReleaseDecisionWorker({ role: 'baseline', input: workerInput, loadScorer });
  const candidate = await runIsolatedReleaseDecisionWorker({ role: 'candidate', input: workerInput, loadScorer });
  const pair = buildReleaseDecisionPair({ input, baselineResult: baseline, candidateResult: candidate,
    candidateCommit: 'e'.repeat(40), token: () => 'f'.repeat(32) });
  expect(pair.report).toMatchObject({ scope: 'frozen_policy_inventory_and_decision_subpath',
    inventoryReplay: { frozenCases: 1, candidateStatuses: { used: 1 }, complete: true },
    fullPipelineAccuracy: null, promotionAllowed: false });
  expect(pair.report.omittedSources).not.toContain('inventory_evidence');
  const drift = structuredClone(candidate);
  drift.cases[0].inventoryStatusId = 'contract_mismatch';
  expect(buildReleaseDecisionPair({ input, baselineResult: baseline, candidateResult: drift,
    candidateCommit: 'e'.repeat(40), token: () => 'f'.repeat(32) }).report.inventoryReplay.complete).toBe(false);
});

test('candidate scorer exercises the installed offline inventory path and flags contract drift', async () => {
  const loadModule = path => import(path.replace('file:///app/current/src/services/',
    new URL('../../services/', import.meta.url).href));
  const score = await createIsolatedFrozenPolicyScorer('candidate', loadModule);
  const policies = base.policies.map(policy => ({ ...policy, trust_rag: true }));
  const profiles = structuredClone(base.folds[0].profiles);
  profiles[1].profile = structuredClone(profiles[0].profile);
  const inventory = { ...withEvidence().cases[0].inventory, evidence: { statusId: 'unavailable', candidates: [] } };
  const statuses = [];
  const request = { metadata: base.cases[0].metadata, policies, profiles,
    onInventoryStatus: value => statuses.push(value) };
  await score({ ...request, inventory });
  expect(statuses).toEqual(['unavailable']);
  statuses.length = 0;
  await score({ ...request, inventory: { ...inventory, contract: [3, 5] } });
  expect(statuses).toEqual(['contract_mismatch']);
});
