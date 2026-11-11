/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { nonadoptedRagVerificationFixture } from '../fixtures/nonadoptedRagVerificationFixture.mjs';
import { holdNonadoptedRagVerificationSource, retainNonadoptedRagVerification, prepareNonadoptedRagVerification,
  enterNonadoptedRagVerification, acceptNonadoptedRagVerification } from '../../services/nonadoptedRagVerification.mjs';
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

test('existing pure gates permit the non-adopted case; actual stage/entry preserves count and result-context precedence', async () => {
  const v = await nonadoptedRagVerificationFixture(); jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(v.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(v.ctx); expect(stage.policyGate.shouldAdopt).toBe(false); expect(stage.pass2Candidate).toBeNull();
  const aiClassify = jest.fn(async (metadata, libraries, signalContext, options) => {
    enterNonadoptedRagVerification(options.nonadoptedRagVerification, { metadata, libraries, signalContext }, options.verificationCandidate).assertCurrent();
    return { library: signalContext.suggestedLibrary, confidence: signalContext.confidence, verified_by_ai: true };
  });
  const result = await runAiRerunStage({ ...v.ctx, policyAfter: stage.policyAfter, existingCandidate: null, policyRecheckStage: stage, aiClassify });
  expect(aiClassify).toHaveBeenCalledTimes(1); expect(result.aiCallsUsed).toBe(2);
  expect(result.pass2Candidate).toMatchObject({ library: v.libraries[0], confidence: 75 }); expect(result.pass2Candidate.signalContext).toBe(v.ctx.signalContext);
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
