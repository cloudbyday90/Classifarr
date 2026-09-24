/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { captureOperatorCorrectionFrozenPolicyCohort } from '../../services/operatorCorrectionFrozenPolicyCohort.mjs';

const options = { seed: 'frozen-policy-cohort-v2', size: 2, folds: 2, generateCases: 0, maxMinutes: 1 };

function setup({ changed = false, empty = false } = {}) {
  const source = { fingerprint: 'a'.repeat(64), vectors: new Map() };
  const runtime = { embedder: {}, repository: { read: jest.fn()
    .mockResolvedValueOnce(source).mockResolvedValueOnce(changed ? { ...source, fingerprint: 'b'.repeat(64) } : source) },
  close: jest.fn() };
  const deps = { loadRuntime: jest.fn(async () => runtime),
    inspectRepresentation: jest.fn(async () => ({ dimensions: 2 })),
    verifyRepresentation: jest.fn(),
    prepareCorrections: jest.fn(() => ({ source: { policies: [] }, eligibleSampleKeys: new Set() })),
    prepareSample: jest.fn(() => ({ cases: empty ? [] : [{}] })),
    createEvidence: jest.fn(() => ({})), captureInput: jest.fn(() => ({ version: 2 })),
    captureInventory: jest.fn(async () => ({ version: 3 })) };
  return { runtime, deps };
}

test('capture uses repeatable read and verifies the source before releasing a private input', async () => {
  const { runtime, deps } = setup();
  await expect(captureOperatorCorrectionFrozenPolicyCohort(options, deps)).resolves.toEqual({ version: 3 });
  expect(deps.loadRuntime).toHaveBeenCalledWith({ includeOperatorCorrectionLabels: true, repeatableRead: true });
  expect(runtime.repository.read).toHaveBeenCalledTimes(2);
  expect(deps.verifyRepresentation).toHaveBeenCalledTimes(2);
  expect(deps.captureInput).toHaveBeenCalledTimes(1);
  expect(deps.captureInventory).toHaveBeenCalledTimes(1);
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test.each(['changed', 'empty'])('capture fails closed on %s and closes its runtime', async kind => {
  const { runtime, deps } = setup({ changed: kind === 'changed', empty: kind === 'empty' });
  await expect(captureOperatorCorrectionFrozenPolicyCohort(options, deps)).rejects.toThrow(
    kind === 'changed' ? 'frozen_policy_source_changed' : 'frozen_policy_no_eligible_corrections');
  expect(runtime.close).toHaveBeenCalledTimes(1);
  if (kind === 'empty') expect(deps.captureInput).not.toHaveBeenCalled();
});
