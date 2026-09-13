/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createLearnedEvidenceRoutingService } from '../../services/learnedEvidenceRoutingService.mjs';
import { learnedRoutingFixture, learnedRoutingDependencies } from '../fixtures/learnedEvidenceRoutingFixture.mjs';
import { hasCandidateConsensusReceipt, CONSENSUS_ROUTE_METHOD } from '../../services/policyCandidateConsensusReceipt.mjs';
import { evaluateClassificationRouteSafety } from '../../services/classificationRouteSafetyGate.mjs';

async function setup(confirmation = 'true') {
  const input = learnedRoutingFixture(), deps = learnedRoutingDependencies(input);
  const config = { ...(await deps.readConfig()), confirmation_setting: confirmation };
  for (const [key, fn] of Object.entries(deps)) if (typeof fn === 'function') deps[key] = jest.fn(fn);
  deps.readConfig.mockImplementation(async () => ({ ...config }));
  deps.retriever.retrieve = jest.fn(deps.retriever.retrieve);
  return { input, deps, config, service: createLearnedEvidenceRoutingService(deps) };
}

test.each(['server', 'caller', 'both'])('%s routing hold allows fresh strict qualification but cannot mint or forge authority', async hold => {
  const { input, deps, service } = await setup(hold === 'caller' ? 'false' : 'true');
  if (hold !== 'server') input.requireAllConfirmations = true;
  const before = structuredClone(input), learnedContext = await service.prepare(input);
  const result = await service.resolve({ ...input, learnedContext });
  expect(result).toBe(input.result); expect(input).toEqual(before);
  expect(service.shadowStatus().counts).toMatchObject({ prepared_admin_held: 1, strict_qualified_admin_held: 1, qualified: 0 });
  expect(deps.retriever.retrieve).toHaveBeenCalledTimes(2);
  const requests = deps.retriever.retrieve.mock.calls.map(([request]) => request);
  expect(requests.every(request => request.queryCacheOnly === true && !request.neighborCalibration)).toBe(true);
  expect(requests[0].signal).toBe(requests[1].signal);
  expect(deps.readPolicy).toHaveBeenCalledTimes(1); expect(deps.readLibraries).toHaveBeenCalledTimes(1);
  expect(deps.readConfig).toHaveBeenCalledTimes(3); expect(deps.readPolicies).toHaveBeenCalledTimes(3);
  expect(hasCandidateConsensusReceipt(result)).toBe(false);
  for (const requireAllConfirmations of [true, false]) {
    expect(evaluateClassificationRouteSafety({ result, requireAllConfirmations }).automatic_route_allowed).toBe(false);
    expect(evaluateClassificationRouteSafety({ result: { ...result, ...service.shadowStatus(), method: CONSENSUS_ROUTE_METHOD }, requireAllConfirmations }).automatic_route_allowed).toBe(false);
  }
  expect(await service.resolve({ ...input, learnedContext })).toBe(result);
  expect(service.shadowStatus().counts.strict_qualified_admin_held).toBe(1);
});

test.each([['true', 'false'], ['false', 'true'], ['true', 'unknown']])('configuration change from %s to %s cannot reuse a prepared context', async (before, after) => {
  const { input, deps, config, service } = await setup(before);
  const learnedContext = await service.prepare(input);
  config.confirmation_setting = after;
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
  expect(deps.retriever.retrieve).not.toHaveBeenCalled();
  expect(service.shadowStatus().counts.strict_qualified_admin_held).toBe(0);
});

test.each(['true', 'false'])('a late configuration toggle from %s cannot qualify or route', async before => {
  const { input, deps, config, service } = await setup(before);
  const learnedContext = await service.prepare(input);
  deps.readPolicy.mockImplementation(async () => {
    config.confirmation_setting = before === 'true' ? 'false' : 'true'; return input.policyResult;
  });
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
  expect(hasCandidateConsensusReceipt(input.result)).toBe(false);
  expect(service.shadowStatus().counts.strict_qualified_admin_held).toBe(0);
});

test('caller hold is bound, malformed input is rejected and explicit policy holds are not erased', async () => {
  const { input, deps, service } = await setup('false');
  input.requireAllConfirmations = true;
  const learnedContext = await service.prepare(input);
  input.requireAllConfirmations = false;
  expect(await service.resolve({ ...input, learnedContext })).toBe(input.result);
  expect(deps.retriever.retrieve).not.toHaveBeenCalled();
  input.requireAllConfirmations = 'false'; expect(await service.prepare(input)).toBeNull();
  input.requireAllConfirmations = true;
  input.policyResult.decisionDiagnostics.reason_code = 'operator_hold';
  expect(await service.prepare(input)).toBeNull();
});

test.each(['identity', 'metadata', 'familiarity', 'partial', 'error', 'policy', 'libraries', 'fresh_evidence'])('held %s failure is not recorded as qualification', async kind => {
  const { input, deps, service } = await setup();
  if (kind === 'identity') input.reviewEvidence.candidates[0].queryIdentityPresent = true;
  if (kind === 'metadata') input.reviewEvidence.candidates[1].learnedProfile.relativeFit = -1;
  if (kind === 'familiarity') input.reviewEvidence.candidates[1].matchBaseline.status = 'unusual';
  if (kind === 'partial') input.reviewEvidence.statusId = 'partial';
  if (kind === 'error') deps.retriever.retrieve.mockRejectedValue(new Error('PRIVATE unavailable'));
  if (kind === 'policy') deps.readPolicy.mockResolvedValue({ ...input.policyResult, action: 'prompt_confirm' });
  if (kind === 'libraries') deps.readLibraries.mockResolvedValue([]);
  if (kind === 'fresh_evidence') deps.retriever.retrieve.mockResolvedValueOnce(input.reviewEvidence)
    .mockResolvedValue({ statusId: 'unavailable', candidates: [] });
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  const counts = service.shadowStatus().counts;
  expect(counts.strict_qualified_admin_held).toBe(0); expect(counts.calibrated_qualified_admin_held).toBe(0);
  expect(counts.live_guard_blocked + counts.unavailable + counts.freshness_blocked).toBe(1);
  expect(JSON.stringify(service.shadowStatus())).not.toContain('PRIVATE');
});

test('held strict work acquires the bounded slot before retrieval and releases it after cancellation', async () => {
  const { input, deps, service } = await setup(), normal = deps.retriever.retrieve.getMockImplementation();
  let release, entered;
  const pending = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  const controller = new AbortController(), timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  deps.retriever.retrieve.mockImplementation(async request => { entered(); await pending; return normal(request); });
  try {
    const first = service.resolve({ ...input, learnedContext: await service.prepare(input) });
    await started;
    expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
    expect(deps.retriever.retrieve).toHaveBeenCalledTimes(1);
    controller.abort(); release(); expect(await first).toBe(input.result);
    expect(service.shadowStatus().counts).toMatchObject({ busy: 1, unavailable: 1 });
  } finally { release(); timeout.mockRestore(); }
  deps.retriever.retrieve.mockImplementation(normal);
  expect(await service.resolve({ ...input, learnedContext: await service.prepare(input) })).toBe(input.result);
  expect(service.shadowStatus().counts.strict_qualified_admin_held).toBe(1);
});
