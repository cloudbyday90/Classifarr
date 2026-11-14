/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { adoptedSelectPolicyReviewFixture } from '../fixtures/adoptedSelectPolicyReviewFixture.mjs';
import { ragRecheckAdviceFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import { currentPolicyReviewFixture } from '../fixtures/currentPolicyReviewFixture.mjs';
import { readCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameContract.mjs';
import { holdAdoptedCurrentPolicyReviewSource, retainAdoptedCurrentPolicyReviewStage } from '../../services/adoptedRagCurrentPolicyReview.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame,
  transferCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameLive.mjs';
import { buildPolicyRuntimeQuestionAnswerContract, validatePolicyRuntimeQuestionAnswer } from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';

afterEach(() => jest.restoreAllMocks());
const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const project = (value, result = value.candidate) => projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(
  publishCurrentPolicyReviewFrame(result, { ...result }), value.item));
function saved(value, frame = value.frame) {
  const id = '9007199254740993';
  return { classification: { id, tmdb_id: value.item.tmdb_id, media_type: value.item.media_type,
    method: 'policy_recheck', confidence: 80, metadata: { policyResult: { action: 'prompt_confirm', confidence: 80,
      ranked: [{ library_id: 2001, policy_id: 2001, score: 80, prompt_threshold: 60, auto_classify_threshold: 95 }] },
    classification_details: { current_policy_review: { ...frame, classification_id: id } } } },
  question: normalizePolicyRuntimeQuestion({ metadata: value.item, libraries: value.libraries, policyResult: value.result,
    question: { options: value.libraries.map(row => ({ library_id: row.id, label: row.name, value: `library:${row.id}` })) } }) };
}

test.each(['native_intent', 'compatibility_bridge'])('%s v2 select keeps technical evidence without a primary or automatic permission', async source => {
  const value = await adoptedSelectPolicyReviewFixture({ source });
  expect(value.frame).toMatchObject({ version: 'policy.current_review.v2', status: 'recorded', method: 'policy_recheck',
    policy: { action: 'prompt_select', confidence: 75, ranked: [{ library_id: 101, score: 70 }] } });
  const input = saved(value), original = JSON.stringify(input.classification.metadata.policyResult);
  const contract = buildPolicyRuntimeQuestionAnswerContract(input);
  expect(contract.recommendation).toMatchObject({ leading_destination: null,
    policy_destination: { library_id: 101, evidence_score: 70 },
    status_id: 'manual_destination_selection_required', why_not_automatic: { reason_id: 'policy_destination_selection_required' } });
  expect(contract.decision_summary.deterministic).toMatchObject({ destination: { library_id: 101 }, score: 70,
    status_id: 'destination_selection_required', safety_gate: { id: 'policy_destination_selection_required' } });
  expect(contract.allowed_actions.find(row => row.id === 'confirm_destination')).toMatchObject({ available: true, destination_required: true });
  expect(contract.candidate_destinations.map(row => row.library_id)).toEqual(expect.arrayContaining([101, 2001]));
  for (const libraryId of [101, 2001]) expect(validatePolicyRuntimeQuestionAnswer({ ...input,
    answer: { contractVersion: contract.version, contractFingerprint: contract.fingerprint,
      actionId: 'confirm_destination', destinationLibraryId: libraryId } }).ok).toBe(true);
  expect(JSON.stringify(input.classification.metadata.policyResult)).toBe(original);
  expect(JSON.stringify(value.frame)).not.toMatch(/Owned|keywords|raw|provider/u);
});

test('v1 select stays rejected and existing confirm v1 stays valid', async () => {
  const select = await adoptedSelectPolicyReviewFixture(), input = saved(select);
  const v1Select = { ...input.classification.metadata.classification_details.current_policy_review, version: 'policy.current_review.v1' };
  expect(readCurrentPolicyReviewFrame(v1Select, input.classification)).toBeNull();
  const confirm = await currentPolicyReviewFixture();
  expect(readCurrentPolicyReviewFrame(confirm.frame, { id: confirm.frame.classification_id,
    tmdb_id: confirm.item.tmdb_id, media_type: confirm.item.media_type, method: confirm.frame.method })).not.toBeNull();
});

test.each(['rounded tie', 'duplicate library', 'same destination'])(
  '%s retains conservative technical-reference and explicit-choice rules', async kind => {
    const value = await adoptedSelectPolicyReviewFixture({ count: kind === 'same destination' ? 1 : 2,
      configure: policy => { if (kind === 'duplicate library') policy.library_id = 101; },
      afterEvaluate: row => { row.score = row.library_id === 101 ? 70.4 : 70.3; } });
    const input = saved(value);
    if (kind === 'same destination') input.classification.metadata.policyResult.ranked[0].library_id = 101;
    const contract = buildPolicyRuntimeQuestionAnswerContract(input);
    expect(contract.recommendation.leading_destination).toBeNull();
    if (kind === 'duplicate library') expect(contract.recommendation.policy_destination).toBeNull();
    else expect(contract.recommendation.why_not_automatic.reason_id).toBe(kind === 'same destination'
      ? 'policy_destination_selection_required' : 'policy_tie');
  });

test('owner-controlled select copies retain v2; an unassociated copy remains an explicit gap', async () => {
  const value = await adoptedSelectPolicyReviewFixture();
  const copied = transferCurrentPolicyReviewFrame(value.published, { ...value.published });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(copied, value.item))).toMatchObject({
    version: 'policy.current_review.v2', status: 'recorded' });
  const gap = projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame({ ...value.published }, value.item));
  expect(gap.status).toBe('evidence_gap');
  expect(buildPolicyRuntimeQuestionAnswerContract(saved(value, gap)).recommendation.policy_destination).toBeNull();
});

test.each(['prompt_confirm', 'auto_classify', 'manual'])('v2 recorded %s cannot be reinterpreted as select', async action => {
  const value = await adoptedSelectPolicyReviewFixture(), input = saved(value);
  const frame = input.classification.metadata.classification_details.current_policy_review;
  frame.policy = { ...frame.policy, action };
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).toBeNull();
  expect(buildPolicyRuntimeQuestionAnswerContract(input).recommendation.policy_destination).toBeNull();
});

test.each(['ai_verified', 'policy_auto', 'manual_classification'])('v2 %s is outside the retained select method boundary', async method => {
  const value = await adoptedSelectPolicyReviewFixture(), input = saved(value);
  input.classification.method = method;
  input.classification.metadata.classification_details.current_policy_review.method = method;
  expect(readCurrentPolicyReviewFrame(input.classification.metadata.classification_details.current_policy_review, input.classification)).toBeNull();
});

test.each(['missing', 'copied', 'offline', '65 candidates', '65 libraries'])(
  '%s source registers a select v2 gap without original-policy fallback', async kind => {
    const value = await ragRecheckAdviceFixture({ action: 'prompt_select', live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1 });
    if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 64 }, (_, index) => ({ id: index + 3001, is_active: true, media_type: 'movie' })));
    const token = kind === 'missing' ? null : holdAdoptedCurrentPolicyReviewSource({ ...args(value),
      ...(kind === 'copied' ? { policyResult: { ...value.result } } : {}) });
    retainAdoptedCurrentPolicyReviewStage(value.stage, token, args(value));
    const frame = project(value);
    expect(frame).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap', policy: null });
    const contract = buildPolicyRuntimeQuestionAnswerContract(saved(value, frame));
    expect(contract.recommendation.leading_destination).toBeNull();
    expect(contract.recommendation.policy_destination).toBeNull();
  });

test.each(['prompt_confirm', 'auto_classify', null])('action changed to %s before stage association preserves the captured v2 gap', async action => {
  const value = await ragRecheckAdviceFixture({ action: 'prompt_select' });
  const token = holdAdoptedCurrentPolicyReviewSource(args(value));
  value.result.action = action;
  retainAdoptedCurrentPolicyReviewStage(value.stage, token, args(value));
  expect(project(value)).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap', policy: null });
});

test('action accessor after capture keeps the private version and records a gap without calling it', async () => {
  const value = await ragRecheckAdviceFixture({ action: 'prompt_select' });
  const token = holdAdoptedCurrentPolicyReviewSource(args(value)), trap = jest.fn(() => { throw new Error('must not run'); });
  Object.defineProperty(value.result, 'action', { get: trap, configurable: true, enumerable: true });
  retainAdoptedCurrentPolicyReviewStage(value.stage, token, args(value));
  Object.defineProperty(value.result, 'action', { value: 'prompt_select', writable: true, configurable: true, enumerable: true });
  expect(project(value)).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap', policy: null });
  expect(trap).not.toHaveBeenCalled();
});

test.each(['action', 'score', 'revision', 'item', 'pool', 'gate', 'candidate'])(
  '%s mutation latches a gap without changing the bound v2 version', async kind => {
    const value = await adoptedSelectPolicyReviewFixture();
    let target, key, replacement;
    if (kind === 'action') [target, key, replacement] = [value.result, 'action', 'prompt_confirm'];
    if (kind === 'score') [target, key, replacement] = [value.result.ranked[0], 'score', 69];
    if (kind === 'revision') [target, key, replacement] = [value.result.ranked[0].policy_intent_read_trace, 'intent_version', 4];
    if (kind === 'item') [target, key, replacement] = [value.item, 'tmdb_id', value.item.tmdb_id + 1];
    if (kind === 'pool') [target, key, replacement] = [value.libraries[0], 'is_active', false];
    if (kind === 'gate') [target, key, replacement] = [value.stage.policyGate, 'shouldAdopt', false];
    if (kind === 'candidate') [target, key, replacement] = [value.candidate, 'confidence', value.candidate.confidence + 1];
    const original = target[key]; target[key] = replacement;
    expect(project(value)).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap', policy: null });
    target[key] = original;
    expect(project(value)).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap' });
  });

test('unknown version and missing question membership never restore the original primary', async () => {
  const value = await adoptedSelectPolicyReviewFixture(), input = saved(value);
  input.classification.metadata.classification_details.current_policy_review.version = 'policy.current_review.future';
  expect(buildPolicyRuntimeQuestionAnswerContract(input).recommendation.policy_destination).toBeNull();
  const limited = saved(value);
  limited.question = normalizePolicyRuntimeQuestion({ metadata: value.item, libraries: [value.libraries.at(-1)] });
  expect(buildPolicyRuntimeQuestionAnswerContract(limited).recommendation.policy_destination).toBeNull();
});

test('complete 64-row select capture keeps five detail projections without truncating ranking', async () => {
  const value = await ragRecheckAdviceFixture({ action: 'prompt_select', count: 64 }); value.libraries.pop();
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  const frame = project(value);
  expect(frame.status).toBe('recorded'); expect(frame.policy.ranked).toHaveLength(64);
  expect(frame.policy.ranked.filter(row => row.detail !== null)).toHaveLength(5);
});

test('fallible candidate inspection still registers a v2 gap without invoking accessors', async () => {
  const value = await ragRecheckAdviceFixture({ action: 'prompt_select' }), trap = jest.fn(() => { throw new Error('must not run'); });
  Object.defineProperty(value.candidate, 'confidence', { get: trap, configurable: true, enumerable: true });
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  Object.defineProperty(value.candidate, 'confidence', { value: 75, configurable: true, enumerable: true });
  expect(project(value)).toMatchObject({ version: 'policy.current_review.v2', status: 'evidence_gap' });
  expect(trap).not.toHaveBeenCalled();
});

test('actual select stage owns fresh context, clears inherited advisory/status and preserves authority with zero AI calls', async () => {
  const value = await ragRecheckAdviceFixture({ action: 'prompt_select' });
  const status = { version: 'classification.candidate_bound_verification.v1', status_id: 'confirmed' };
  const advisory = { message: 'Earlier advisory' }, authority = { sideEffects: { canRoute: false, canLearn: false } };
  Object.assign(value.ctx.baselineResult, { confidence: 80, candidate_bound_verification: status, ai_advisory: advisory, ai_authority: authority });
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  const stage = await runPolicyRecheckStage(value.ctx), aiClassify = jest.fn();
  expect(stage.policyGate.shouldAdopt).toBe(true);
  const rerun = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
    policyRecheckStage: stage, aiClassify });
  expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
  expect(rerun.pass2Candidate).toMatchObject({ confidence: 80, candidate_bound_verification: null });
  expect(rerun.pass2Candidate.signalContext).toEqual({ ranked: value.result.ranked,
    confidence: value.result.confidence, suggestedLibrary: value.libraries[0] });
  expect(rerun.pass2Candidate.ai_advisory).toBeNull(); expect(rerun.pass2Candidate.ai_authority).toBe(authority);
  expect(value.ctx.baselineResult.ai_advisory).toBe(advisory);
  expect(value.ctx.baselineResult.candidate_bound_verification).toBe(status);
  expect(aiClassify).not.toHaveBeenCalled(); expect(rerun.aiCallsUsed).toBe(1);
  expect(project(value, rerun.pass2Candidate)).toMatchObject({ version: 'policy.current_review.v2', status: 'recorded' });
});
