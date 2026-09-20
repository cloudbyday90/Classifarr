/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { assessLearnedNeighborShadow, canAssessLearnedNeighborShadow } from '../../services/learnedEvidenceNeighborShadow.mjs';
import { learnedRoutingFixture, learnedRoutingDependencies } from '../fixtures/learnedEvidenceRoutingFixture.mjs';
import { neighborFallbackFixture } from '../fixtures/inventoryNeighborFallbackFixture.mjs';
import { projectLiveInventoryDescriptionEvidence } from '../../services/liveInventoryDescriptionEvidence.mjs';
import { hasCandidateConsensusReceipt } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';

function fixture() {
  const input = learnedRoutingFixture(), calibration = neighborFallbackFixture().evidence.calibration;
  input.reviewEvidence.candidates[0].items[0].similarity = .90;
  for (const candidate of input.evidence.candidates) candidate.descriptionEvidence = projectLiveInventoryDescriptionEvidence({
    ...input.reviewEvidence.candidates.find(value => value.libraryId === candidate.libraryId), statusId: 'available',
  }, true);
  const deps = learnedRoutingDependencies(input);
  for (const [key, fn] of Object.entries(deps)) if (typeof fn === 'function') deps[key] = jest.fn(fn);
  deps.retriever.retrieve = jest.fn(async request => {
    const evidence = structuredClone(input.reviewEvidence);
    if (request.neighborCalibration) evidence.candidates[1].neighborCalibration = structuredClone(calibration);
    return evidence;
  });
  const service = createLearnedEvidenceRoutingService(deps);
  return { input, calibration, deps, service };
}

test('qualified shadow reuses all final live checks but returns the exact original unreceipted result', async () => {
  const { input, deps, service } = fixture(), before = structuredClone(input);
  const learnedContext = await service.prepare(input);
  const result = await service.resolve({ ...input, learnedContext });
  expect(result).toBe(input.result); expect(input).toEqual(before);
  expect(service.shadowStatus()).toMatchObject({ counts: { qualified: 1 }, automaticRouteAllowed: false });
  expect(Object.values(service.shadowStatus().guardReasons).every(count => count === 0)).toBe(true);
  expect(hasCandidateConsensusReceipt(result)).toBe(false);
  expect(evaluateClassificationRouteSafety({ result }).automatic_route_allowed).toBe(false);
  expect(deps.retriever.retrieve.mock.calls.map(([r]) => r.neighborCalibration ?? false)).toEqual([false, true, true]);
  expect(deps.retriever.retrieve.mock.calls[1][0].signal).toBe(deps.retriever.retrieve.mock.calls[2][0].signal);
  expect(deps.readPolicy).toHaveBeenCalledTimes(1); expect(deps.readLibraries).toHaveBeenCalledTimes(1);
  expect(deps.readConfig).toHaveBeenCalledTimes(3); expect(deps.readPolicies).toHaveBeenCalledTimes(3);
  expect(await service.resolve({ ...input, learnedContext })).toBe(result);
  expect(service.shadowStatus().counts.qualified).toBe(1);
});

test.each(['identity', 'familiarity', 'prompt', 'metadata'])('cheap %s guard stops shadow before extra retrieval', async kind => {
  const { input, deps, service } = fixture();
  if (kind === 'identity') input.reviewEvidence.candidates[0].queryIdentityPresent = true;
  if (kind === 'familiarity') input.reviewEvidence.candidates[1].matchBaseline.status = 'unusual';
  if (kind === 'prompt') input.evidence.candidates[0].descriptionEvidence.items[0].description = 'Old prompt';
  if (kind === 'metadata') input.reviewEvidence.candidates[1].learnedProfile.relativeFit = -2;
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts.live_guard_blocked).toBe(1);
  expect(deps.retriever.retrieve).toHaveBeenCalledTimes(1);
  expect(deps.readPolicy).not.toHaveBeenCalled();
});

test.each(['calibration', 'scope', 'mean'])('unsupported %s never qualifies even with a superficially positive calibration', async kind => {
  const { input, calibration, deps, service } = fixture();
  if (kind === 'calibration') calibration.candidates[1].calibrated = false;
  if (kind === 'scope') calibration.candidates[0].libraryId = 99;
  if (kind === 'mean') {
    input.reviewEvidence.candidates[0].items.forEach(item => { item.similarity = .95; });
    input.evidence.candidates[0].descriptionEvidence = projectLiveInventoryDescriptionEvidence({ ...input.reviewEvidence.candidates[0], statusId: 'available' }, true);
  }
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts[kind === 'mean' ? 'live_guard_blocked' : 'fallback_blocked']).toBe(1);
  expect(service.shadowStatus().guardReasons.comparison_not_supported).toBe(kind === 'mean' ? 1 : 0);
  expect(deps.retriever.retrieve).toHaveBeenCalledTimes(kind === 'mean' ? 1 : 2);
  expect(deps.readPolicy).not.toHaveBeenCalled();
});

test.each(['policy', 'libraries', 'evidence', 'configuration', 'result', 'clock'])('final %s drift retains review and blocks qualification', async kind => {
  const { input, deps, service } = fixture();
  const context = await service.prepare(input);
  if (kind === 'policy') deps.readPolicy.mockResolvedValue({ ...input.policyResult, action: 'prompt_confirm' });
  if (kind === 'libraries') deps.readLibraries.mockResolvedValue([]);
  if (kind === 'evidence') {
    const normal = deps.retriever.retrieve.getMockImplementation(); let reads = 0;
    deps.retriever.retrieve.mockImplementation(async request => {
      const value = await normal(request);
      if (++reads === 3) value.candidates[1].neighborCalibration.snapshotId = 'b'.repeat(64);
      return value;
    });
  }
  if (kind === 'configuration') deps.readConfig.mockResolvedValueOnce(await deps.readConfig()).mockResolvedValue(null);
  if (kind === 'result') deps.readPolicy.mockImplementation(async () => { input.result.confidence = 99; return input.policyResult; });
  if (kind === 'clock') {
    const timed = createLearnedEvidenceRoutingService({ ...deps, now: () => deps.readPolicy.mock.calls.length ? 400000 : 1 });
    expect(await timed.resolve({ ...input, learnedContext: await timed.prepare(input) })).toBe(input.result);
    expect(timed.shadowStatus().counts.freshness_blocked).toBe(1); return;
  }
  expect(await service.resolve({ ...input, learnedContext: context })).toBe(input.result);
  expect(service.shadowStatus().counts.freshness_blocked).toBe(1);
});

test('changed current evidence before fitting, errors and cancellation cannot qualify', async () => {
  for (const kind of ['changed', 'error', 'abort']) {
    const { input, deps, service } = fixture(), normal = deps.retriever.retrieve.getMockImplementation();
    deps.retriever.retrieve.mockImplementation(async request => {
      if (!request.neighborCalibration) return normal(request);
      if (kind === 'error') throw new Error('PRIVATE database message');
      if (kind === 'abort') throw new DOMException('aborted', 'AbortError');
      const value = await normal(request); value.candidates[0].indexed = 0; return value;
    });
    expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
    expect(service.shadowStatus().counts[kind === 'changed' ? 'freshness_blocked' : 'unavailable']).toBe(1);
    expect(JSON.stringify(service.shadowStatus())).not.toContain('PRIVATE');
  }
});

test('one in-flight shadow rejects concurrent attempts without queueing and releases on completion', async () => {
  const { input, deps, service } = fixture(), normal = deps.retriever.retrieve.getMockImplementation();
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  deps.retriever.retrieve.mockImplementation(async request => {
    if (request.neighborCalibration) { entered(); await pending; }
    return normal(request);
  });
  const first = service.resolve({ ...input, learnedContext: await service.prepare(input) });
  await started;
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts.busy).toBe(1);
  release(); expect(await first).toBe(input.result);
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts.qualified).toBe(2);
});

test('an expired shared signal rejects a completed read and releases the in-flight slot', async () => {
  const { input, deps, service } = fixture(), normal = deps.retriever.retrieve.getMockImplementation();
  const controller = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  deps.retriever.retrieve.mockImplementation(async request => {
    const evidence = await normal(request);
    if (request.neighborCalibration) controller.abort();
    return evidence;
  });
  try {
    expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
    expect(service.shadowStatus().counts.unavailable).toBe(1);
    expect(deps.readPolicy).not.toHaveBeenCalled();
  } finally { timeout.mockRestore(); }
  deps.retriever.retrieve.mockImplementation(normal);
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts.qualified).toBe(1);
});

test('admin confirmation allows calibrated evaluation without changing the original review', async () => {
  const { input, deps, service } = fixture();
  deps.readConfig.mockResolvedValue({ ...(await deps.readConfig()), confirmation_setting: 'true' });
  const learnedContext = await service.prepare(input);
  expect(learnedContext).not.toBeNull();
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
  expect(service.shadowStatus().counts).toMatchObject({ prepared_admin_held: 1, calibrated_qualified_admin_held: 1, qualified: 0 });
  expect(deps.retriever.retrieve.mock.calls.every(([request]) => request.queryCacheOnly === true)).toBe(true);
  expect(hasCandidateConsensusReceipt(input.result)).toBe(false);
  expect(canAssessLearnedNeighborShadow({})).toBe(false); expect(assessLearnedNeighborShadow({})).toBe(false);
});
