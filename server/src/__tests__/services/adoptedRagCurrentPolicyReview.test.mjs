/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { ragRecheckAdviceFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import {
  holdAdoptedCurrentPolicyReviewSource,
  retainAdoptedCurrentPolicyReviewStage,
  prepareAdoptedCurrentPolicyReview,
  retainAdoptedCurrentPolicyReview,
} from '../../services/adoptedRagCurrentPolicyReview.mjs';
import {
  associateCurrentPolicyReviewCandidate,
  publishCurrentPolicyReviewFrame,
  holdCurrentPolicyReviewFrame,
  projectCurrentPolicyReviewFrame,
} from '../../services/currentPolicyReviewFrameLive.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { ragLoopResilienceManager } from '../../services/ragLoopResilienceManager.mjs';
import { buildPolicyRuntimeQuestionAnswerContract } from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';

afterEach(() => jest.restoreAllMocks());

const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const consumer = value => ({ ...args(value), signalContext: value.consumer, candidate: value.candidate });

async function fixture(options) {
  const value = await ragRecheckAdviceFixture(options);
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)));
  return value;
}

function candidate(value) {
  return { library: value.libraries[0], confidence: 75, method: 'ai_verified', policyResult: value.result,
    needs_clarification: true, candidate_bound_verification: { status_id: 'confirmed' } };
}

function frame(value, result) {
  const published = publishCurrentPolicyReviewFrame(result, { ...result });
  return projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item));
}

function complete(value, options = {}) {
  const token = prepareAdoptedCurrentPolicyReview(options.stage ?? value.stage, options.args ?? consumer(value));
  const result = candidate(value);
  retainAdoptedCurrentPolicyReview(token, result);
  return result;
}

test.each(['native_intent', 'compatibility_bridge'])('%s adopted source publishes the fresh review and keeps original evidence distinct', async source => {
  const value = await fixture({ source, confidence: 75, captureEvaluation: true, afterEvaluate: row => { row.score = 70; } });
  const result = complete(value);
  const current = frame(value, result);
  expect(current).toMatchObject({ status: 'recorded', policy: { confidence: 75, ranked: [{ score: 70 }] } });
  const question = normalizePolicyRuntimeQuestion({ metadata: value.item, libraries: value.libraries, policyResult: value.result });
  const original = { action: 'prompt_confirm', confidence: 80, ranked: [{ policy_id: 2001, library_id: 2001,
    score: 80, auto_classify_threshold: 95, prompt_threshold: 60 }] };
  const classification = { id: '9007199254740993', media_type: value.item.media_type, tmdb_id: value.item.tmdb_id,
    method: result.method, confidence: 75, metadata: { policyResult: original, classification_details: {
      current_policy_review: { ...current, classification_id: '9007199254740993' },
    } } };
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification, question });
  expect(contract.recommendation.leading_destination).toMatchObject({ library_id: value.libraries[0].id, evidence_score: 70 });
  expect(contract.decision_summary.deterministic.score).toBe(70);
  expect(classification.metadata.policyResult).toBe(original);
  expect(JSON.stringify(current)).not.toMatch(/Owned|EARLIER|keywords|raw|provider/);
});

test.each(['long label', 'missing label', 'accessor label'])('%s does not remove numeric review authority', async kind => {
  const value = await ragRecheckAdviceFixture();
  const trap = jest.fn(() => { throw new Error('must not read optional label'); });
  if (kind === 'long label') value.libraries[0].name = 'x'.repeat(161);
  if (kind === 'missing label') delete value.libraries[0].name;
  if (kind === 'accessor label') Object.defineProperty(value.libraries[0], 'name', { get: trap });
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)));
  expect(frame(value, complete(value)).status).toBe('recorded');
  expect(trap).not.toHaveBeenCalled();
});

test.each(['missing', 'offline', 'copied', 'other item', '65 candidates', '65 libraries'])(
  '%s source still registers a gap for the fulfilled adopted result', async kind => {
    const value = await ragRecheckAdviceFixture({ live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1 });
    if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 64 }, (_, i) => ({ id: i + 3001,
      name: 'Extra', media_type: 'movie', is_active: true })));
    let source = args(value);
    if (kind === 'copied') source = { ...source, policyResult: { ...value.result } };
    if (kind === 'other item') source = { ...source, metadata: { ...value.item } };
    const token = kind === 'missing' ? null : holdAdoptedCurrentPolicyReviewSource(source);
    expect(token).toBeNull();
    retainAdoptedCurrentPolicyReviewStage(value.stage, token);
    expect(frame(value, complete(value))).toMatchObject({ status: 'evidence_gap', policy: null });
  });

test('complete 64-candidate and 64-library evidence is admitted without truncation', async () => {
  const value = await ragRecheckAdviceFixture({ count: 64 });
  value.libraries.pop(); // Remove only the fixture's extra earlier destination.
  retainAdoptedCurrentPolicyReviewStage(value.stage, holdAdoptedCurrentPolicyReviewSource(args(value)));
  const current = frame(value, complete(value));
  expect(current.status).toBe('recorded');
  expect(current.policy.ranked).toHaveLength(64);
  expect(current.policy.ranked.filter(row => row.detail !== null)).toHaveLength(5);
});

test('valid numeric values exceeding the source byte limit yield a complete evidence gap', async () => {
  const value = await ragRecheckAdviceFixture({ count: 64, configure: (policy, index) => {
    policy.id = 2147483647 - index;
    policy.library_id = 2147483000 - index;
    policy.native_intent_version = 2147483647;
    policy.auto_classify_threshold = 85.12345678901234;
    policy.prompt_threshold = 60.12345678901234;
    Object.assign(policy.policy_intent_contract, { policy_id: policy.id, library_id: policy.library_id });
    Object.assign(policy.policy_intent_read_trace, { policy_id: policy.id, intent_version: policy.native_intent_version });
  }, afterEvaluate: row => { row.score = 0.0000010000000000000002; } });
  value.libraries.pop();
  expect(value.result.ranked).toHaveLength(64);
  expect(value.libraries).toHaveLength(64);
  expect(holdAdoptedCurrentPolicyReviewSource(args(value))).toBeNull();
  expect(frame(value, complete(value))).toMatchObject({ status: 'evidence_gap', policy: null });
});

test.each(['stage copy', 'gate copy', 'candidate copy', 'not adopted', 'failed', 'policy copy', 'candidate confidence',
  'candidate method', 'candidate destination', 'consumer confidence', 'consumer destination', 'item copy', 'pool copy'])(
  '%s cannot reuse the adopted stage association', async kind => {
    const value = await fixture();
    let stage = value.stage, input = consumer(value);
    if (kind === 'stage copy') stage = { ...stage };
    if (kind === 'gate copy') stage.policyGate = { ...stage.policyGate };
    if (kind === 'candidate copy') stage.pass2Candidate = { ...value.candidate };
    if (kind === 'not adopted') stage.policyGate.shouldAdopt = false;
    if (kind === 'failed') stage.hadError = true;
    if (kind === 'policy copy') stage.policyAfter = { ...value.result };
    if (kind === 'candidate confidence') value.candidate.confidence++;
    if (kind === 'candidate method') value.candidate.method = 'ai_rerun';
    if (kind === 'candidate destination') value.candidate.library = { ...value.candidate.library };
    if (kind === 'consumer confidence') value.consumer.confidence++;
    if (kind === 'consumer destination') value.consumer.suggestedLibrary = { ...value.libraries[0] };
    if (kind === 'item copy') input = { ...input, metadata: { ...value.item } };
    if (kind === 'pool copy') input = { ...input, libraries: [...value.libraries] };
    expect(frame(value, complete(value, { stage, args: input })).status).toBe('evidence_gap');
  });

test.each(['score', 'revision', 'item', 'pool', 'stage', 'candidate', 'consumer'])(
  '%s mutation at completion latches the gap through publication', async kind => {
    const value = await fixture();
    const token = prepareAdoptedCurrentPolicyReview(value.stage, consumer(value));
    let reset = () => {};
    if (kind === 'score') {
      const score = value.result.ranked[0].score;
      value.result.ranked[0].score++;
      reset = () => { value.result.ranked[0].score = score; };
    }
    if (kind === 'revision') value.result.ranked[0].policy_intent_read_trace.intent_version++;
    if (kind === 'item') {
      const id = value.item.tmdb_id;
      value.item.tmdb_id++;
      reset = () => { value.item.tmdb_id = id; };
    }
    if (kind === 'pool') {
      value.libraries[0].is_active = false;
      reset = () => { value.libraries[0].is_active = true; };
    }
    if (kind === 'stage') {
      value.stage.policyGate.shouldAdopt = false;
      reset = () => { value.stage.policyGate.shouldAdopt = true; };
    }
    if (kind === 'candidate') {
      const score = value.candidate.confidence;
      value.candidate.confidence++;
      reset = () => { value.candidate.confidence = score; };
    }
    if (kind === 'consumer') {
      value.consumer.confidence++;
      reset = () => { value.consumer.confidence--; };
    }
    const result = candidate(value);
    retainAdoptedCurrentPolicyReview(token, result);
    reset();
    expect(frame(value, result).status).toBe('evidence_gap');
  });

test('stage and completion handoffs are consumed once', async () => {
  const value = await fixture();
  const first = prepareAdoptedCurrentPolicyReview(value.stage, consumer(value));
  const second = prepareAdoptedCurrentPolicyReview(value.stage, consumer(value));
  const result = candidate(value);
  retainAdoptedCurrentPolicyReview(first, result);
  const other = candidate(value);
  retainAdoptedCurrentPolicyReview(first, other);
  expect(frame(value, result).status).toBe('recorded');
  expect(frame(value, other)).toBeNull();
  retainAdoptedCurrentPolicyReview(second, other);
  expect(frame(value, other).status).toBe('evidence_gap');
});

test.each([
  ['CONFIRM', false], ['ABSTAIN', false], ['invalid', false], ['capability refusal', false],
  ['CONFIRM', true], ['ABSTAIN', true], ['invalid', true], ['capability refusal', true],
])(
  'production stages retain a current frame for fulfilled %s same destination=%s', async (outcome, sameDestination) => {
    const value = await ragRecheckAdviceFixture({ confidence: 75, afterEvaluate: row => { row.score = 70; } });
    value.ctx.baselineResult.confidence = 80;
    if (sameDestination) {
      value.ctx.baselineResult.library = value.libraries[0];
      value.ctx.signalContext.suggestedLibrary = value.libraries[0];
    }
    const earlierAdvisory = { version: 'classification.ai_advisory.v1', message: 'Earlier advisory sentinel' };
    value.ctx.baselineResult.ai_advisory = earlierAdvisory;
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const stage = await runPolicyRecheckStage(value.ctx);
    expect(stage.pass2Candidate.confidence).toBe(80);
    const currentAdvisory = outcome === 'CONFIRM' ? null : {
      version: 'classification.ai_advisory.v1', message: 'Current advisory', status_id: outcome,
    };
    const aiClassify = jest.fn(async (_metadata, _libraries, context) => {
      expect(context.confidence).toBe(75);
      return { library: value.libraries[0], confidence: 75, verified_by_ai: outcome === 'CONFIRM',
        ...(currentAdvisory ? { ai_advisory: currentAdvisory } : {}),
        needs_clarification: true, candidate_bound_verification: { status_id: outcome === 'CONFIRM' ? 'confirmed' : 'abstained' } };
    });
    const rerun = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
      policyRecheckStage: stage, aiClassify });
    expect(aiClassify).toHaveBeenCalledTimes(1);
    expect(rerun.aiCallsUsed).toBe(2);
    expect(rerun.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
    expect(rerun.pass2Candidate.signalContext).not.toBe(value.ctx.signalContext);
    expect(rerun.pass2Candidate.signalContext.ranked).toBe(value.ctx.signalContext.ranked);
    expect(rerun.pass2Candidate.signalContext.breakdown).toBe(value.ctx.signalContext.breakdown);
    expect(rerun.pass2Candidate.ai_advisory).toBe(currentAdvisory);
    expect(stage.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
    expect(stage.pass2Candidate.ai_advisory).toBe(earlierAdvisory);
    expect(frame(value, rerun.pass2Candidate)).toMatchObject({ status: 'recorded', policy: { confidence: 75, ranked: [{ score: 70 }] } });
  });

test.each(['missing stage', 'copied stage', 'mutated during call'])(
  'production %s proof changes only the diagnostic frame', async kind => {
    const value = await ragRecheckAdviceFixture();
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
    jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
    const stage = await runPolicyRecheckStage(value.ctx);
    const aiClassify = jest.fn(async () => {
      if (kind === 'mutated during call') value.result.ranked[0].score++;
      return { library: value.libraries[0], confidence: 70, verified_by_ai: true };
    });
    const rerun = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate,
      policyRecheckStage: kind === 'missing stage' ? null : kind === 'copied stage' ? { ...stage } : stage, aiClassify });
    expect(aiClassify).toHaveBeenCalledTimes(1);
    expect(rerun).toMatchObject({ aiCallsUsed: 2, hadError: false });
    expect(rerun.pass2Candidate.signalContext).toBe(aiClassify.mock.calls[0][2]);
    expect(rerun.pass2Candidate.ai_advisory).toBeNull();
    expect(frame(value, rerun.pass2Candidate).status).toBe('evidence_gap');
  });

test('returned invocation references retain their loaded lifecycle while current frame checks latch diagnostic loss', async () => {
  const value = await ragRecheckAdviceFixture({ confidence: 75 });
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(value.ctx);
  const aiClassify = jest.fn(async () => ({ library: value.libraries[0], confidence: 75, verified_by_ai: true }));
  const rerun = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter,
    existingCandidate: stage.pass2Candidate, policyRecheckStage: stage, aiClassify });
  const result = rerun.pass2Candidate;
  expect(result.signalContext).toBe(aiClassify.mock.calls[0][2]);
  result.signalContext.ranked[0].score = 33;
  expect(value.ctx.signalContext.ranked[0].score).toBe(33);
  expect(frame(value, result).status).toBe('recorded');
  result.signalContext.confidence = 74;
  expect(frame(value, result).status).toBe('evidence_gap');
  result.signalContext.confidence = 75;
  expect(frame(value, result).status).toBe('evidence_gap');
  expect(result.ai_advisory).toBeNull();
  expect(rerun).toMatchObject({ aiCallsUsed: 2, hadError: false });
  expect(aiClassify).toHaveBeenCalledTimes(1);
});

test.each(['rejected', 'transient', 'skipped', 'resilience', 'mode'])('%s adopted rerun retains the ordinary deterministic candidate without a new frame attempt', async kind => {
  const value = await ragRecheckAdviceFixture();
  value.ctx.baselineResult.ai_advisory = { message: 'Existing candidate advisory' };
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(value.ctx);
  if (kind === 'resilience') ragLoopResilienceManager.canRun.mockReturnValue({ allowed: false });
  if (kind === 'mode') value.libraries[0].id = 0;
  const failure = jest.spyOn(ragLoopResilienceManager, 'recordFailure');
  const aiClassify = jest.fn(async () => {
    const error = new Error('Owned refusal');
    if (kind === 'transient') error.code = 'ECONNREFUSED';
    throw error;
  });
  const rerun = await runAiRerunStage({ ...value.ctx, ...(kind === 'skipped' ? { aiCallsUsed: 2 } : {}),
    policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate, policyRecheckStage: stage, aiClassify });
  expect(rerun.pass2Candidate).toBe(stage.pass2Candidate);
  expect(aiClassify).toHaveBeenCalledTimes(['rejected', 'transient'].includes(kind) ? 1 : 0);
  expect(rerun.hadError).toBe(kind === 'rejected');
  expect(failure).toHaveBeenCalledTimes(kind === 'rejected' ? 1 : 0);
  expect(rerun.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
  expect(rerun.pass2Candidate.ai_advisory).toBe(value.ctx.baselineResult.ai_advisory);
  expect(frame(value, rerun.pass2Candidate)).toBeNull();
});

test.each(['accessor', 'proxy', 'confidence object', 'library object', 'method object', 'NaN', 'negative id'])(
  '%s result inspection registers a gap without calling hostile hooks', async kind => {
    const value = await fixture();
    const result = candidate(value);
    const trap = jest.fn(() => { throw new Error('must not run'); });
    const hostile = { toJSON: trap, [Symbol.toPrimitive]: trap };
    if (kind === 'accessor') Object.defineProperty(result, 'confidence', { get: trap, configurable: true });
    if (kind === 'proxy') result.library = new Proxy({}, { getOwnPropertyDescriptor: trap });
    if (kind === 'confidence object') result.confidence = hostile;
    if (kind === 'library object') result.library = { id: hostile };
    if (kind === 'method object') result.method = hostile;
    if (kind === 'NaN') result.confidence = NaN;
    if (kind === 'negative id') result.library = { id: -1 };
    associateCurrentPolicyReviewCandidate(result, { seed: null, current: () => true, policyResult: value.result, metadata: value.item });
    Object.defineProperty(result, 'confidence', { value: 75, configurable: true, enumerable: true, writable: true });
    result.library = value.libraries[0]; result.method = 'ai_verified';
    expect(frame(value, result)).toMatchObject({ status: 'evidence_gap', policy: null });
    expect(trap).not.toHaveBeenCalled();
  });
