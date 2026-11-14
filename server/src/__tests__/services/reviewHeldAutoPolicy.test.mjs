/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { automaticPolicyReviewFixture } from '../fixtures/automaticPolicyReviewFixture.mjs';
import { holdAdoptedCurrentPolicyReviewSource, retainAdoptedCurrentPolicyReviewStage } from '../../services/adoptedRagCurrentPolicyReview.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame,
  transferCurrentPolicyReviewFrame, admitCurrentPolicyReviewForPersistence } from '../../services/currentPolicyReviewFrameLive.mjs';
import { readCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { buildPolicyRuntimeQuestionAnswerContract } from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { evaluateClassificationRouteSafety, buildClassificationRouteSafetyProjection } from '../../services/classificationRouteSafetyGate.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { policyEvaluationPayloadBytes } from '../../services/policyEvaluationCaptureContract.mjs';

afterEach(() => jest.restoreAllMocks());
const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const held = (value, result = value.candidate) => holdCurrentPolicyReviewFrame(
  publishCurrentPolicyReviewFrame(result, { ...result }), value.item);
const project = (value, status = 'awaiting_decision') => projectCurrentPolicyReviewFrame(
  admitCurrentPolicyReviewForPersistence(held(value), status));
async function fixture(options) {
  const value = await automaticPolicyReviewFixture(options);
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  return value;
}
function saved(value, frame = project(value), safety = buildClassificationRouteSafetyProjection(
  evaluateClassificationRouteSafety({ result: value.candidate, policyResult: value.result }))) {
  const id = '9007199254740993';
  return { classification: { id, tmdb_id: value.item.tmdb_id, media_type: value.item.media_type,
    method: 'policy_auto', status: 'awaiting_decision', confidence: value.candidate.confidence,
    metadata: { policyResult: value.original, classification_details: {
      current_policy_review: { ...frame, classification_id: id }, route_safety: safety } } },
  question: normalizePolicyRuntimeQuestion({ metadata: value.item, libraries: value.libraries, policyResult: value.result,
    question: { options: value.libraries.map(row => ({ library_id: row.id, label: row.name, value: `library:${row.id}` })) } }) };
}

test.each(['native_intent', 'compatibility_bridge'])('%s actual automatic decision keeps B90 and its independent hold', async source => {
  const value = await fixture({ source });
  expect(value.result).toMatchObject({ action: 'auto_classify', confidence: 90, ranked: [{ score: 90, library_id: 101 }] });
  expect(project(value)).toMatchObject({ version: 'policy.current_review.v3', status: 'recorded', method: 'policy_auto',
    policy: { action: 'auto_classify', ranked: [{ score: 90, library_id: 101 }] } });
  const input = saved(value), original = JSON.stringify(input.classification.metadata.policyResult);
  const contract = buildPolicyRuntimeQuestionAnswerContract(input);
  expect(contract.recommendation.leading_destination).toMatchObject({ library_id: 101, evidence_score: 90 });
  expect(contract.decision_summary.deterministic).toMatchObject({ destination: { library_id: 101 }, score: 90,
    status_id: 'automatic_threshold_blocked', safety_gate: { id: 'ai_advisory_cannot_route' } });
  expect(contract.allowed_actions.find(row => row.id === 'confirm_destination').available).toBe(true);
  expect(JSON.stringify(input.classification.metadata.policyResult)).toBe(original);
  expect(JSON.stringify(project(value))).not.toMatch(/Owned|Original|keywords|raw|provider/u);
});

test.each(['completed', 'pending_retry', 'failed', undefined])('%s writer state emits no automatic frame', async status => {
  const value = await fixture();
  expect(projectCurrentPolicyReviewFrame(admitCurrentPolicyReviewForPersistence(held(value), status))).toBeNull();
});

test.each(['unknown copy', 'owner copy'])('%s preserves automatic cohort admission and version', async kind => {
  const value = await fixture(), published = publishCurrentPolicyReviewFrame(value.candidate, { ...value.candidate });
  const copy = kind === 'owner copy' ? transferCurrentPolicyReviewFrame(published, { ...published }) : { ...published };
  const receipt = holdCurrentPolicyReviewFrame(copy, value.item);
  expect(projectCurrentPolicyReviewFrame(admitCurrentPolicyReviewForPersistence(receipt, 'completed'))).toBeNull();
  expect(projectCurrentPolicyReviewFrame(admitCurrentPolicyReviewForPersistence(receipt, 'awaiting_decision'))).toMatchObject({
    version: 'policy.current_review.v3', status: kind === 'owner copy' ? 'recorded' : 'evidence_gap' });
});

test.each(['missing', 'copied', 'offline', '65 candidates', '65 libraries'])('%s proof is a v3 gap without A fallback', async kind => {
  // Corroborated compatibility remains auto when the separate 64-row purpose producer is unavailable.
  const value = await automaticPolicyReviewFixture({ live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1,
    ...(kind === '65 candidates' ? { source: 'compatibility_bridge' } : {}) });
  if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 63 }, (_, index) => ({
    id: index + 3001, media_type: value.item.media_type, is_active: true })));
  const token = kind === 'missing' ? null : holdAdoptedCurrentPolicyReviewSource({ ...args(value),
    ...(kind === 'copied' ? { policyResult: { ...value.result } } : {}) });
  retainAdoptedCurrentPolicyReviewStage(value.stage, token, args(value));
  const frame = project(value);
  expect(frame).toMatchObject({ version: 'policy.current_review.v3', status: 'evidence_gap', policy: null });
  const contract = buildPolicyRuntimeQuestionAnswerContract(saved(value, frame));
  expect(contract.recommendation.leading_destination).toBeNull();
  expect(contract.recommendation.policy_destination).toBeNull();
  expect(contract.allowed_actions.find(row => row.id === 'confirm_destination').available).toBe(true);
});

test.each(['score', 'action', 'revision', 'item', 'pool', 'gate', 'candidate'])('%s loss stays a version-bound gap after restoration', async kind => {
  const value = await fixture(); let target, key, replacement;
  if (kind === 'score') [target, key, replacement] = [value.result.ranked[0], 'score', 89];
  if (kind === 'action') [target, key, replacement] = [value.result, 'action', 'prompt_confirm'];
  if (kind === 'revision') [target, key, replacement] = [value.result.ranked[0].policy_intent_read_trace, 'intent_version', 4];
  if (kind === 'item') [target, key, replacement] = [value.item, 'tmdb_id', value.item.tmdb_id + 1];
  if (kind === 'pool') [target, key, replacement] = [value.libraries[0], 'is_active', false];
  if (kind === 'gate') [target, key, replacement] = [value.stage.policyGate, 'shouldAdopt', false];
  if (kind === 'candidate') [target, key, replacement] = [value.candidate, 'confidence', 91];
  const original = target[key]; target[key] = replacement;
  expect(project(value)).toMatchObject({ version: 'policy.current_review.v3', status: 'evidence_gap', policy: null });
  target[key] = original;
  expect(project(value).status).toBe('evidence_gap');
});

test.each(['policy_recheck', 'ai_verified', 'manual_classification'])('v3 %s cannot become automatic evidence', async method => {
  const value = await fixture(), input = saved(value), frame = input.classification.metadata.classification_details.current_policy_review;
  input.classification.method = method; frame.method = method;
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).toBeNull();
  expect(buildPolicyRuntimeQuestionAnswerContract(input).recommendation.policy_destination).toBeNull();
});

test.each(['policy.current_review.v1', 'policy.current_review.v2', 'future'])('%s does not reinterpret recorded automatic bytes', async version => {
  const value = await fixture(), input = saved(value);
  input.classification.metadata.classification_details.current_policy_review.version = version;
  expect(buildPolicyRuntimeQuestionAnswerContract(input).recommendation.policy_destination).toBeNull();
});

test.each([null, { version: 'unknown', automatic_route_allowed: true }])('recorded automatic evidence with invalid safety %s retains stale/retry-only protection', async safety => {
  const value = await fixture(), contract = buildPolicyRuntimeQuestionAnswerContract(saved(value, project(value), safety));
  expect(contract.recommendation.leading_destination).toMatchObject({ library_id: 101, evidence_score: 90 });
  expect(contract.decision_summary.deterministic.status_id).toBe('historical_route_safety_details_unavailable');
  expect(contract.allowed_actions.find(row => row.id === 'confirm_destination').available).toBe(false);
});

test.each(['prompt_confirm', 'prompt_select'])('v3 recorded %s cannot change its action meaning', async action => {
  const value = await fixture(), input = saved(value);
  input.classification.metadata.classification_details.current_policy_review.policy = {
    ...input.classification.metadata.classification_details.current_policy_review.policy, action };
  expect(buildPolicyRuntimeQuestionAnswerContract(input).recommendation.policy_destination).toBeNull();
});

test('unbound old adjudication cannot replace the new technical reference or suppress its existing primary shortcut', async () => {
  const value = await fixture(), input = saved(value);
  input.classification.metadata.classification_details.candidate_adjudication = {
    version: 'policy.candidate_adjudication.v1', status_id: 'proposed', candidate_count: 2,
    proposed_destination: { library_id: 2001, library_name: 'Earlier destination' },
  };
  const contract = buildPolicyRuntimeQuestionAnswerContract(input);
  expect(contract.recommendation.leading_destination.library_id).toBe(101);
  expect(contract.decision_summary.candidate_adjudication).toBeNull();
  expect(contract.allowed_actions.find(row => row.id === 'confirm_destination').available).toBe(true);
});

test.each(['accessor', 'proxy', 'oversized bytes', 'outside question'])('%s current frame cannot revive the original ranking', async kind => {
  const value = await fixture(), input = saved(value);
  const frame = structuredClone(input.classification.metadata.classification_details.current_policy_review);
  input.classification.metadata.classification_details.current_policy_review = frame;
  if (kind === 'accessor') Object.defineProperty(frame.policy, 'confidence', { get() { throw new Error('Owned getter must not run'); } });
  if (kind === 'proxy') input.classification.metadata.classification_details.current_policy_review = new Proxy(frame, { ownKeys() { throw new Error('Owned proxy must not run'); } });
  if (kind === 'oversized bytes') frame.policy.ranked = Array.from({ length: 64 }, (_, index) => {
    const row = { ...structuredClone(frame.policy.ranked[0]), policy_id: 1000 + index, library_id: 1000 + index,
      score: Number.MIN_VALUE, prompt_threshold: Number.MIN_VALUE, auto_classify_threshold: Number.MIN_VALUE,
      detail: index < 5 ? structuredClone(frame.policy.ranked[0].detail) : null };
    if (row.detail?.explanation) row.detail.explanation.score = 0;
    return row;
  });
  if (kind === 'outside question') input.question.options = input.question.options.filter(option => option.library_id !== 101);
  if (kind === 'oversized bytes') expect(policyEvaluationPayloadBytes(frame)).toBeGreaterThan(65536);
  const contract = buildPolicyRuntimeQuestionAnswerContract(input);
  expect(contract.recommendation.leading_destination).toBeNull();
  expect(contract.recommendation.policy_destination).toBeNull();
});

test('complete 64-candidate/library evaluation retains its ranking and only five details', async () => {
  const value = await automaticPolicyReviewFixture({ count: 64 }); value.libraries.pop();
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)), args(value));
  const frame = project(value);
  expect(frame.status).toBe('recorded'); expect(frame.policy.ranked).toHaveLength(64);
  expect(frame.policy.ranked.filter(row => row.detail !== null)).toHaveLength(5);
});

test('actual automatic stage clears inherited verification only and performs no extra AI work', async () => {
  const value = await automaticPolicyReviewFixture(), status = { status_id: 'confirmed' }, advisory = { message: 'Earlier advisory' };
  Object.assign(value.ctx.baselineResult, { candidate_bound_verification: status, ai_advisory: advisory });
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  const stage = await runPolicyRecheckStage(value.ctx), aiClassify = jest.fn();
  expect(stage.policyGate.shouldAdopt).toBe(true);
  const rerun = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
    policyRecheckStage: stage, aiClassify });
  expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
  expect(stage.pass2Candidate.candidate_bound_verification).toBeNull();
  expect(stage.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
  expect(stage.pass2Candidate.ai_advisory).toBe(advisory);
  expect(stage.pass2Candidate.ai_authority).toBe(value.ctx.baselineResult.ai_authority);
  expect(value.ctx.baselineResult.candidate_bound_verification).toBe(status);
  expect(aiClassify).not.toHaveBeenCalled(); expect(rerun.aiCallsUsed).toBe(value.ctx.aiCallsUsed);
});
