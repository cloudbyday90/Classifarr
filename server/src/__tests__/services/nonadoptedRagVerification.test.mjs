/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { nonadoptedRagVerificationFixture } from '../fixtures/nonadoptedRagVerificationFixture.mjs';
import { holdNonadoptedRagVerificationSource, retainNonadoptedRagVerification, prepareNonadoptedRagVerification,
  enterNonadoptedRagVerification, acceptNonadoptedRagVerification, buildNonadoptedRagInvocationBaseline } from '../../services/nonadoptedRagVerification.mjs';
import { isNonadoptedRagVerificationRefusal, createNonadoptedRagVerificationRefusal } from '../../services/nonadoptedRagVerificationRefusal.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { ragLoopResilienceManager } from '../../services/ragLoopResilienceManager.mjs';
import { verificationProfile } from '../fixtures/verificationAdviceFixture.mjs';

afterEach(() => { jest.restoreAllMocks(); });
const args = v => ({ policyResult: v.result, metadata: v.item, libraries: v.libraries });
const retain = v => retainNonadoptedRagVerification(v.stage, holdNonadoptedRagVerificationSource(args(v)));
const prepare = v => prepareNonadoptedRagVerification(v.stage, args(v));
const enter = (v, p) => enterNonadoptedRagVerification(p.token, { ...args(v), signalContext: p.signalContext }, p.candidate);

test.each(['native_intent', 'compatibility_bridge'])('fresh %s non-adopted stage yields exact confidence/target without earlier fields', async source => {
  const v = await nonadoptedRagVerificationFixture({ source }), serialized = JSON.stringify(v.stage);
  expect(retain(v)).toBe(v.stage); expect(JSON.stringify(v.stage)).toBe(serialized);
  const p = prepare(v); expect(p.signalContext.confidence).toBe(75); expect(p.signalContext.suggestedLibrary).toBe(v.libraries[0]);
  expect(p.signalContext.ranked).toBe(v.result.ranked); expect(p.signalContext.breakdown).toBeUndefined(); expect(Object.isFrozen(p.signalContext)).toBe(true);
  const session = enter(v, p); session.assertCurrent(); expect(() => acceptNonadoptedRagVerification(p.token)).not.toThrow();
  await session.advice.readProfile(async () => verificationProfile());
  expect((await session.advice.buildPrompt({}, async x => x)).libraryProfile.totalItems).toBe(10);
  expect(prepare(v)).toBeNull(); expect(JSON.stringify(p.token)).toBe('{}');
});

test.each(['copy stage', 'copy result', 'other item', 'other pool', 'gate replacement', 'adopted', 'candidate', 'failure'])(
  '%s cannot prepare a fresh authority reference', async kind => {
    const v = await nonadoptedRagVerificationFixture(); retain(v); let stage = v.stage, a = args(v);
    if (kind === 'copy stage') stage = { ...stage };
    if (kind === 'copy result') v.stage.policyAfter = { ...v.result };
    if (kind === 'other item') a = { ...a, metadata: { ...v.item } };
    if (kind === 'other pool') a = { ...a, libraries: [...v.libraries] };
    if (kind === 'gate replacement') v.stage.policyGate = { shouldAdopt: false };
    if (kind === 'adopted') v.stage.policyGate.shouldAdopt = true;
    if (kind === 'candidate') v.stage.pass2Candidate = {};
    if (kind === 'failure') v.stage.hadError = true;
    expect(prepareNonadoptedRagVerification(stage, a)).toBeNull();
  });

test.each(['score', 'confidence', 'typed item', 'pool', 'stage', 'label'])( '%s change after entry causes a latched trusted local refusal', async kind => {
  const v = await nonadoptedRagVerificationFixture(); retain(v); const p = prepare(v), session = enter(v, p);
  if (kind === 'score') v.result.ranked[0].score++;
  if (kind === 'confidence') v.result.confidence++;
  if (kind === 'typed item') v.item.tmdb_id++;
  if (kind === 'pool') v.libraries[0].is_active = false;
  if (kind === 'stage') v.stage.policyGate.shouldAdopt = true;
  if (kind === 'label') v.libraries[0].name += ' changed';
  let refusal; try { session.assertCurrent(); } catch (error) { refusal = error; }
  expect(isNonadoptedRagVerificationRefusal(refusal)).toBe(true);
  v.stage.policyGate.shouldAdopt = false;
  expect(session.assertCurrent).toThrow('Fresh verification context is unavailable');
});

test('long optional label gaps do not revoke genuine numeric verification provenance', async () => {
  const v = await nonadoptedRagVerificationFixture(); v.libraries[0].name = 'x'.repeat(161); retain(v);
  const p = prepare(v), session = enter(v, p), lookup = jest.fn();
  session.assertCurrent(); await session.advice.readProfile(lookup); expect(lookup).not.toHaveBeenCalled();
  expect(await session.advice.buildPrompt({}, async x => x)).toEqual({ policySignals: {}, libraryProfile: null });
  session.assertCurrent();
});

test('private refusal cannot be forged by code/message and request handles cannot be reentered', async () => {
  expect(isNonadoptedRagVerificationRefusal(new Error('Fresh verification context is unavailable'))).toBe(false);
  expect(isNonadoptedRagVerificationRefusal({ code: 'FRESH_VERIFICATION_CONTEXT_UNAVAILABLE' })).toBe(false);
  expect(isNonadoptedRagVerificationRefusal(createNonadoptedRagVerificationRefusal())).toBe(true);
  const v = await nonadoptedRagVerificationFixture(); retain(v); const p = prepare(v); enter(v, p);
  expect(() => enter(v, p)).toThrow('Fresh verification context is unavailable');
  expect(() => acceptNonadoptedRagVerification(p.token)).toThrow();
});

test.each(['offline', 'copied', 'overflow', 'hostile label'])( '%s source cannot authorize verification', async kind => {
  const v = await nonadoptedRagVerificationFixture({ live: kind !== 'offline', count: kind === 'overflow' ? 65 : 1 });
  const trap = jest.fn();
  if (kind === 'copied') v.result = { ...v.result };
  if (kind === 'hostile label') v.libraries[0].name = { toString: trap };
  expect(holdNonadoptedRagVerificationSource(args(v))).toBeNull(); expect(trap).not.toHaveBeenCalled();
});

test('existing non-adopted stage assembles the result with its accepted invocation context', async () => {
  const v = await nonadoptedRagVerificationFixture(); jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(v.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(v.ctx); expect(stage.policyGate.shouldAdopt).toBe(false); expect(stage.pass2Candidate).toBeNull();
  const aiClassify = jest.fn(async (metadata, libraries, signalContext, options) => {
    enterNonadoptedRagVerification(options.nonadoptedRagVerification, { metadata, libraries, signalContext }, options.verificationCandidate).assertCurrent();
    return { library: signalContext.suggestedLibrary, confidence: signalContext.confidence, verified_by_ai: true };
  });
  const result = await runAiRerunStage({ ...v.ctx, policyAfter: stage.policyAfter, existingCandidate: null, policyRecheckStage: stage, aiClassify });
  expect(aiClassify).toHaveBeenCalledTimes(1); expect(result.aiCallsUsed).toBe(2);
  expect(result.pass2Candidate).toMatchObject({ library: v.libraries[0], confidence: 75, ai_advisory: null });
  expect(result.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
  expect(result.pass2Candidate.signalContext).not.toBe(v.ctx.signalContext);
});

test.each(['confirmed', 'abstained', 'contract_violation', 'provider_capability_unavailable'])(
  '%s result owns its invocation context and advisory', async status => {
    const v = await nonadoptedRagVerificationFixture();
    const earlierAdvisory = { version: 'classification.ai_advisory.v1', status_id: 'earlier_advisory',
      deterministic_candidate: { library_id: 2001 }, message: 'EARLIER ADVISORY SENTINEL' };
    Object.assign(v.ctx.signalContext, { relatedEvidenceSummary: { stage: 'EARLIER SUMMARY SENTINEL' },
      signals: { earlier: 99 }, ragContext: { suggestion: 'EARLIER RETRIEVAL SENTINEL' } });
    v.ctx.baselineResult.ai_advisory = earlierAdvisory;
    const original = JSON.stringify(v.ctx.baselineResult);
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(v.result);
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const stage = await runPolicyRecheckStage(v.ctx);
    const currentAdvisory = status === 'confirmed' ? null : { version: 'classification.ai_advisory.v1', status_id: status,
      deterministic_candidate: { library_id: v.libraries[0].id }, message: 'Current invocation advisory' };
    const aiClassify = jest.fn(async (metadata, libraries, signalContext, options) => {
      enterNonadoptedRagVerification(options.nonadoptedRagVerification, { metadata, libraries, signalContext }, options.verificationCandidate).assertCurrent();
      return { library: libraries[0], confidence: signalContext.confidence, verified_by_ai: status === 'confirmed',
        ...(currentAdvisory ? { ai_advisory: currentAdvisory } : {}) };
    });
    const result = await runAiRerunStage({ ...v.ctx, policyAfter: stage.policyAfter, existingCandidate: null, policyRecheckStage: stage, aiClassify });
    expect(result.aiCallsUsed).toBe(2); expect(aiClassify).toHaveBeenCalledTimes(1);
    expect(result.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
    expect(Object.keys(result.pass2Candidate.signalContext).sort()).toEqual(['confidence', 'ranked', 'suggestedLibrary']);
    expect(result.pass2Candidate.signalContext.confidence).toBe(75);
    expect(result.pass2Candidate.ai_advisory).toBe(currentAdvisory);
    expect(JSON.stringify(result.pass2Candidate)).not.toContain('EARLIER');
    expect(JSON.stringify(v.ctx.baselineResult)).toBe(original);
  });

test('unentered, copied and invalidated references refuse assembly before reading the baseline', async () => {
  const baselineRead = jest.fn();
  const baseline = Object.defineProperty({}, 'signalContext', { enumerable: true, get: baselineRead });
  const v = await nonadoptedRagVerificationFixture(); retain(v); const p = prepare(v);
  expect(() => buildNonadoptedRagInvocationBaseline(p.token, baseline)).toThrow('Fresh verification context is unavailable');
  expect(() => buildNonadoptedRagInvocationBaseline({ ...p.token }, baseline)).toThrow('Fresh verification context is unavailable');
  expect(baselineRead).not.toHaveBeenCalled();
  const valid = await nonadoptedRagVerificationFixture(); retain(valid); const entered = prepare(valid); enter(valid, entered);
  valid.result.confidence++;
  expect(() => buildNonadoptedRagInvocationBaseline(entered.token, baseline)).toThrow('Fresh verification context is unavailable');
  expect(baselineRead).not.toHaveBeenCalled();
});

test.each(['skip', 'failure', 'timeout'])('%s reevaluation cannot reuse a genuine retained result or its late completion', async kind => {
  const v = await nonadoptedRagVerificationFixture(), evaluate = jest.spyOn(policyEngine, 'evaluateItem'); let resolveLate;
  if (kind === 'failure') evaluate.mockRejectedValue(new Error('Owned evaluation failure'));
  if (kind === 'timeout') evaluate.mockImplementation(() => new Promise(resolve => { resolveLate = resolve; }));
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage({ ...v.ctx, policyResult: v.result,
    ...(kind === 'skip' ? { remainingBudget: () => 0 } : {}), ...(kind === 'timeout' ? { remainingBudget: () => 5 } : {}) });
  if (resolveLate) { resolveLate(v.result); await Promise.resolve(); }
  expect(stage.policyAfter).toBe(v.result);
  const aiClassify = jest.fn();
  const outcome = await runAiRerunStage({ ...v.ctx, policyAfter: stage.policyAfter, existingCandidate: null, policyRecheckStage: stage, aiClassify });
  expect(outcome).toEqual({ pass2Candidate: null, aiCallsUsed: 1, hadError: false }); expect(aiClassify).not.toHaveBeenCalled();
  if (kind === 'skip') expect(evaluate).not.toHaveBeenCalled(); else expect(evaluate).toHaveBeenCalledTimes(1);
});

test('fresh proof alone cannot bypass the existing prompt-select resolved gate', async () => {
  const v = await nonadoptedRagVerificationFixture(); jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(v.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const ctx = v.ctx;
  const stage = await runPolicyRecheckStage(ctx); expect(stage.policyGate.shouldAdopt).toBe(false);
  const addEvent = jest.fn(), aiClassify = jest.fn();
  expect(await runAiRerunStage({ ...ctx, trigger: { trigger: 'policy_prompt_select' }, policyAfter: stage.policyAfter,
    existingCandidate: null, policyRecheckStage: stage, addEvent, aiClassify }))
    .toEqual({ pass2Candidate: null, aiCallsUsed: 1, hadError: false });
  expect(aiClassify).not.toHaveBeenCalled(); expect(addEvent).toHaveBeenCalledWith(expect.objectContaining({ reasonCode: 'policy_recheck_resolved' }));
});

test('own-data validation rejects hostile stage accessors without running them', async () => {
  const v = await nonadoptedRagVerificationFixture(); retain(v);
  const trap = jest.fn(() => { throw new Error('Owned accessor must not run'); });
  Object.defineProperty(v.stage, 'policyGate', { get: trap });
  expect(prepare(v)).toBeNull(); expect(trap).not.toHaveBeenCalled();
});
