/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { ragRecheckAdviceFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { buildPolicyRecheckCandidate } from '../../services/classificationRagLoopServiceShared.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { ragLoopResilienceManager } from '../../services/ragLoopResilienceManager.mjs';
import { holdAdoptedCurrentPolicyReviewSource, retainAdoptedCurrentPolicyReviewStage,
  prepareAdoptedCurrentPolicyReview } from '../../services/adoptedRagCurrentPolicyReview.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame,
  projectCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameLive.mjs';

afterEach(() => jest.restoreAllMocks());
const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const frame = (value, result) => {
  const published = publishCurrentPolicyReviewFrame(result, { ...result });
  return projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item));
};

for (const source of ['native_intent']) {
  test.each(['cap', 'resilience', 'transient', 'rejected'])(`${source} retained %s uses policy proof without claiming verification`, async kind => {
    const value = await ragRecheckAdviceFixture({ source, confidence: 75, afterEvaluate: row => { row.score = 70; } });
    const earlierStatus = { version: 'classification.candidate_bound_verification.v1', status_id: 'confirmed' };
    const advisory = { message: 'Earlier advisory' }, authority = { sideEffects: { canRoute: false } };
    Object.assign(value.ctx.baselineResult, { confidence: 80, candidate_bound_verification: earlierStatus,
      ai_advisory: advisory, ai_authority: authority });
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const stage = await runPolicyRecheckStage(value.ctx);
    if (kind === 'resilience') ragLoopResilienceManager.canRun.mockReturnValue({ allowed: false });
    const error = new Error('Owned operation failure');
    if (kind === 'transient') error.code = 'ECONNREFUSED';
    const classify = jest.fn(value.ctx.classifyStageError), aiClassify = jest.fn(async () => { throw error; });
    const failure = jest.spyOn(ragLoopResilienceManager, 'recordFailure');
    const rerun = await runAiRerunStage({ ...value.ctx, classifyStageError: classify, aiClassify,
      ...(kind === 'cap' ? { aiCallsUsed: 2 } : {}), policyAfter: stage.policyAfter,
      existingCandidate: stage.pass2Candidate, policyRecheckStage: stage });
    expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
    expect(rerun.pass2Candidate).toMatchObject({ confidence: 80, candidate_bound_verification: null });
    expect(rerun.pass2Candidate.ai_authority).toBe(authority);
    expect(rerun.pass2Candidate.ai_advisory).toBe(advisory);
    expect(rerun.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
    expect(value.ctx.baselineResult.candidate_bound_verification).toBe(earlierStatus);
    const called = ['transient', 'rejected'].includes(kind);
    expect(aiClassify).toHaveBeenCalledTimes(called ? 1 : 0);
    expect(rerun.aiCallsUsed).toBe(kind === 'resilience' ? 1 : 2);
    expect(rerun.hadError).toBe(kind === 'rejected');
    expect(failure).toHaveBeenCalledTimes(kind === 'rejected' ? 1 : 0);
    if (called) expect(classify).toHaveBeenCalledWith('ai_rerun', error, 'ai_rerun_failed');
    expect(frame(value, rerun.pass2Candidate)).toMatchObject({ status: 'recorded', method: 'policy_recheck',
      policy: { confidence: 75, ranked: [{ library_id: value.libraries[0].id, score: 70 }] } });
  });
}

test.each(['missing', 'copied', 'offline', '65 candidates', '65 libraries', 'other item', 'other pool'])(
  '%s retained source records a gap rather than reviving original policy advice', async kind => {
    const value = await ragRecheckAdviceFixture({ live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1 });
    if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 64 }, (_, i) => ({ id: i + 3001,
      media_type: 'movie', is_active: true })));
    const token = kind === 'missing' ? null : holdAdoptedCurrentPolicyReviewSource({ ...args(value),
      ...(kind === 'copied' ? { policyResult: { ...value.result } } : {}) });
    const scope = { ...args(value), ...(kind === 'other item' ? { metadata: { ...value.item } } : {}),
      ...(kind === 'other pool' ? { libraries: [...value.libraries] } : {}) };
    retainAdoptedCurrentPolicyReviewStage(value.stage, token, scope);
    expect(frame(value, value.candidate)).toMatchObject({ status: 'evidence_gap', policy: null });
  });

test.each(['score', 'revision', 'pool', 'item', 'gate', 'stage', 'candidate', 'confidence'])(
  'retained %s mutation latches policy loss even if restored', async kind => {
    const value = await ragRecheckAdviceFixture();
    retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
    let target, key;
    if (kind === 'score') [target, key] = [value.result.ranked[0], 'score'];
    if (kind === 'revision') [target, key] = [value.result.ranked[0].policy_intent_read_trace, 'intent_version'];
    if (kind === 'pool') [target, key] = [value.libraries[0], 'is_active'];
    if (kind === 'item') [target, key] = [value.item, 'tmdb_id'];
    if (kind === 'gate') [target, key] = [value.stage.policyGate, 'shouldAdopt'];
    if (kind === 'stage') [target, key] = [value.stage, 'policyGate'];
    if (kind === 'candidate') [target, key] = [value.stage, 'pass2Candidate'];
    if (kind === 'confidence') [target, key] = [value.candidate, 'confidence'];
    const original = target[key];
    target[key] = typeof original === 'boolean' ? !original : typeof original === 'number' ? original + 1 : { ...original };
    expect(frame(value, value.candidate).status).toBe('evidence_gap');
    target[key] = original;
    expect(frame(value, value.candidate).status).toBe('evidence_gap');
  });

test('optional invocation-context loss does not erase independent retained policy proof', async () => {
  const value = await ragRecheckAdviceFixture();
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  prepareAdoptedCurrentPolicyReview(value.stage, { ...args(value), candidate: value.candidate,
    signalContext: { ...value.consumer, confidence: 1 } });
  expect(frame(value, value.candidate).status).toBe('recorded');
});

test('retained candidate inspection failure records a gap without invoking an accessor', async () => {
  const value = await ragRecheckAdviceFixture(), trap = jest.fn(() => { throw new Error('must not run'); });
  Object.defineProperty(value.candidate, 'confidence', { configurable: true, enumerable: true, get: trap });
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  Object.defineProperty(value.candidate, 'confidence', { configurable: true, enumerable: true, value: 75 });
  expect(frame(value, value.candidate).status).toBe('evidence_gap');
  expect(trap).not.toHaveBeenCalled();
});

test.each(['auto_classify', 'prompt_select'])('%s policy-only candidates retain existing status and have no frame attempt', async action => {
  const value = await ragRecheckAdviceFixture();
  value.result.action = action;
  const status = { status_id: 'abstained' };
  value.ctx.baselineResult.candidate_bound_verification = status;
  const result = buildPolicyRecheckCandidate({ ...value.ctx, policyResult: value.result });
  const stage = { ...value.stage, pass2Candidate: result };
  retainAdoptedCurrentPolicyReviewStage(stage, null, args(value));
  expect(result.candidate_bound_verification).toBe(status);
  expect(frame(value, result)).toBeNull();
});
