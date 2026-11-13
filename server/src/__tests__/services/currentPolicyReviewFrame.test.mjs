/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { currentPolicyReviewFixture } from '../fixtures/currentPolicyReviewFixture.mjs';
import { holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame, transferCurrentPolicyReviewFrame,
  savedCurrentPolicyReviewMetadata, rememberSavedCurrentPolicyReview } from '../../services/currentPolicyReviewFrameLive.mjs';
import { readCurrentPolicyReviewFrame, cloneReviewData } from '../../services/currentPolicyReviewFrameContract.mjs';
import { buildPolicyRuntimeReviewReference } from '../../services/policyRuntimeReviewReference.mjs';
import { buildPolicyRuntimeQuestionAnswerContract } from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { ClassificationPolicyPathService } from '../../services/classificationPolicyPathService.mjs';

function saved(v, id = '9007199254740993') {
  const frame = { ...v.frame, classification_id: id };
  const metadata = { ...v.item, policyResult: { action: 'prompt_confirm', confidence: 80, ranked: [{ library_id: 2001, policy_id: 2001,
    score: 80, prompt_threshold: 60, auto_classify_threshold: 95 }] }, classification_details: { current_policy_review: frame,
    candidate_adjudication: { version: 'policy.candidate_adjudication.v1', status_id: 'proposed', candidate_count: 2,
      proposed_destination: { library_id: 2001, library_name: 'Earlier destination' } } } };
  const classification = { id, media_type: v.item.media_type, tmdb_id: v.item.tmdb_id, method: v.published.method, confidence: 75, metadata };
  const question = normalizePolicyRuntimeQuestion({ metadata: v.item, libraries: v.libraries, policyResult: v.result });
  return { classification, question };
}

test('current pending contract uses fresh 70 mechanics, not original 80 or overall 75, and retains original evidence', async () => {
  const v = await currentPolicyReviewFixture();
  expect(v.frame.status).toBe('recorded'); expect(v.frame.policy.confidence).toBe(75);
  const input = saved(v), original = JSON.stringify(input.classification.metadata.policyResult);
  const contract = buildPolicyRuntimeQuestionAnswerContract(input);
  expect(contract.recommendation.leading_destination).toMatchObject({ library_id: 101, evidence_score: 70 });
  expect(contract.decision_summary.deterministic).toMatchObject({ score: 70, review_threshold: 60, automatic_threshold: 85,
    candidate_evidence_card: { version: 'policy.candidate_evidence_card.v2', purpose_evidence: { origin: 'unverified' } } });
  expect(contract.decision_summary.candidate_adjudication).toBeNull();
  expect(JSON.stringify(input.classification.metadata.policyResult)).toBe(original);
  expect(JSON.stringify(v.frame)).not.toMatch(/Owned|title|keywords|raw|diagnostic|provider/);
});

test.each(['row', 'item', 'type', 'method', 'null', 'version', 'extra', 'incomplete', 'overflow', 'no leader'])(
  '%s invalid current frame requires selection without old-policy or question fallback', async kind => {
    const v = await currentPolicyReviewFixture(), input = saved(v), frame = input.classification.metadata.classification_details.current_policy_review;
    if (kind === 'row') frame.classification_id = '9007199254740992';
    if (kind === 'item') input.classification.tmdb_id++;
    if (kind === 'type') input.classification.media_type = 'tv';
    if (kind === 'method') input.classification.method = 'manual_classification';
    if (kind === 'null') input.classification.metadata.classification_details.current_policy_review = null;
    if (kind === 'version') frame.version = 'future';
    if (kind === 'extra') frame.raw_rules = [];
    if (kind === 'incomplete') frame.policy = { ...frame.policy, ranked: [] };
    if (kind === 'overflow') frame.policy = { ...frame.policy, ranked: Array(65).fill(frame.policy.ranked[0]) };
    if (kind === 'no leader') input.question = normalizePolicyRuntimeQuestion({ metadata: v.item,
      libraries: [{ id: 2001, name: 'Earlier destination', media_type: 'movie', is_active: true }] });
    const contract = buildPolicyRuntimeQuestionAnswerContract(input);
    expect(contract.recommendation.leading_destination).toBeNull();
    expect(contract.decision_summary.deterministic.score).toBeNull();
    expect(contract.decision_summary.deterministic.candidate_evidence_card).toBeNull();
  });

test.each(['score', 'confidence', 'item', 'pool', 'selected confidence', 'selected library', 'policy copy', 'unknown copy'])(
  '%s loss after publication is a latched evidence gap, without classification refusal', async kind => {
    const v = await currentPolicyReviewFixture(); let result = v.published;
    if (kind === 'score') v.result.ranked[0].score++;
    if (kind === 'confidence') v.result.confidence++;
    if (kind === 'item') v.item.tmdb_id++;
    if (kind === 'pool') v.libraries[0].is_active = false;
    if (kind === 'selected confidence') result.confidence++;
    if (kind === 'selected library') result.library = { ...result.library, id: 102 };
    if (kind === 'policy copy') result.policyResult = { ...result.policyResult };
    if (kind === 'unknown copy') result = { ...result };
    const held = holdCurrentPolicyReviewFrame(result, v.item);
    expect(projectCurrentPolicyReviewFrame(held)).toMatchObject({ status: 'evidence_gap', policy: null });
    v.libraries[0].is_active = true;
    expect(projectCurrentPolicyReviewFrame(held).status).toBe('evidence_gap');
  });

test('only explicit owner copy transfer preserves authority; ordinary legacy result has no attempted frame', async () => {
  const v = await currentPolicyReviewFixture();
  const result = transferCurrentPolicyReviewFrame(v.published, { ...v.published, candidate_contrastive_evidence: null });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(result, v.item)).status).toBe('recorded');
  expect(holdCurrentPolicyReviewFrame({ library: result.library, policyResult: result.policyResult }, v.item)).toBeNull();
  const metadata = { ...v.item, classification_details: { current_policy_review: v.frame } };
  const bound = rememberSavedCurrentPolicyReview(result, metadata, '9007199254740993');
  expect(bound.classification_details.current_policy_review.classification_id).toBe('9007199254740993');
  expect(savedCurrentPolicyReviewMetadata(result, v.item)).toBe(bound);
  expect(savedCurrentPolicyReviewMetadata({ ...result }, v.item)).toBe(v.item);
});

test('own-descriptor inspection rejects accessors/proxies and never calls coercion hooks', () => {
  const trap = jest.fn(() => { throw new Error('must not run'); });
  for (const hostile of [new Proxy({}, { ownKeys: trap }), Object.defineProperty({}, 'x', { get: trap, enumerable: true }),
    { toJSON: trap }]) {
    expect(() => cloneReviewData(hostile)).toThrow();
  }
  expect(trap).not.toHaveBeenCalled();
  expect(cloneReviewData({ x: { [Symbol.toPrimitive]: trap } })).toEqual({ x: {} });
});

test('absent field keeps legacy reference bytes and a present gap cannot impersonate it', async () => {
  const v = await currentPolicyReviewFixture(), input = saved(v);
  delete input.classification.metadata.classification_details.current_policy_review;
  const candidateDestinations = [{ library_id: 2001, library_name: 'Earlier destination' }];
  const legacy = buildPolicyRuntimeReviewReference({ ...input, candidateDestinations });
  expect(legacy.primaryDestination).toEqual(candidateDestinations[0]);
  input.classification.metadata.classification_details.current_policy_review = { ...v.frame, classification_id: input.classification.id,
    status: 'evidence_gap', policy: null };
  expect(buildPolicyRuntimeReviewReference({ ...input, candidateDestinations }).primaryDestination).toBeNull();
});

test('database JSONB key ordering and exact BIGINT text retain the same validated view', async () => {
  const v = await currentPolicyReviewFixture(), input = saved(v), frame = input.classification.metadata.classification_details.current_policy_review;
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, val]) => [key, reorder(val)])) : value;
  expect(readCurrentPolicyReviewFrame(reorder(frame), input.classification)).toEqual(frame);
  expect(readCurrentPolicyReviewFrame(frame, { ...input.classification, id: Number(input.classification.id) })).toBeNull();
});

test('complete 64-candidate ranking retains only five detailed projections; schema/byte admission rejects overflow', async () => {
  const v = await currentPolicyReviewFixture(), input = saved(v), frame = structuredClone(input.classification.metadata.classification_details.current_policy_review);
  const first = frame.policy.ranked[0];
  frame.policy.ranked = Array.from({ length: 64 }, (_, index) => ({ ...structuredClone(first), policy_id: index + 1,
    library_id: index + 101, score: 70, detail: index < 5 ? structuredClone(first.detail) : null }));
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).not.toBeNull();
  frame.policy.ranked[5].detail = structuredClone(first.detail);
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).toBeNull();
  frame.policy.ranked[5].detail = null;
  const expanded = structuredClone(frame);
  for (const row of expanded.policy.ranked) {
    row.score = Number.MIN_VALUE; row.prompt_threshold = Number.MIN_VALUE; row.auto_classify_threshold = Number.MIN_VALUE;
    if (row.detail?.explanation) row.detail.explanation.score = 0;
  }
  expect(readCurrentPolicyReviewFrame(expanded, input.classification)).toBeNull();
  frame.policy.ranked.push({ ...first, policy_id: 65, library_id: 165, detail: null });
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).toBeNull();
});

test('six rounded contributions may produce base 100.2 while the candidate score remains bounded', async () => {
  const v = await currentPolicyReviewFixture({ afterEvaluate: row => {
    row.score = 70;
    row.breakdown = ['preset', 'native_intent', 'profile', 'pattern', 'rag', 'history'].map(type => ({ type, score: 100, activeWeight: 1 / 6 }));
  } });
  const input = saved(v), frame = input.classification.metadata.classification_details.current_policy_review;
  expect(frame.policy.ranked[0].detail.explanation.base_score).toBe(100.2);
  expect(frame.policy.ranked[0].detail.explanation.components.reduce((sum, row) => sum + row.normalized_weight_percent, 0)).toBeCloseTo(100.2);
  expect(readCurrentPolicyReviewFrame(frame, input.classification)).not.toBeNull();
});

test('declared purpose comes from immutable live v2 capture; later mutable diagnostic changes cannot upgrade it', async () => {
  const v = await currentPolicyReviewFixture({ captureEvaluation: true });
  expect(v.frame.policy.ranked[0].detail.card.purpose_evidence.origin).toBe('declared_native');
  const before = JSON.stringify(v.frame);
  v.result.ranked[0].candidate_diagnostics.purpose_evidence = { origin: 'mixed' };
  expect(JSON.stringify(projectCurrentPolicyReviewFrame(v.held))).toBe(before);
  const legacy = await currentPolicyReviewFixture();
  expect(legacy.frame.policy.ranked[0].detail.card.purpose_evidence.origin).toBe('unverified');
});

test('frozen mechanics survive subsequent diagnostic mutations without retaining raw text', async () => {
  const v = await currentPolicyReviewFixture({ afterEvaluate: row => {
    row.score = 70; row.candidate_diagnostics.positive_sources = { rag: true, profile: true };
  } });
  const before = JSON.stringify(v.frame);
  v.result.ranked[0].candidate_diagnostics.positive_sources = { history: true };
  v.result.ranked[0].candidate_diagnostics.raw_provider_text = 'PRIVATE RAW SENTINEL';
  expect(JSON.stringify(projectCurrentPolicyReviewFrame(v.held))).toBe(before);
  expect(v.frame.policy.ranked[0].detail.facts).toEqual(['similar_items', 'observed_profile']);
});

test('the policy owner explicitly transfers the selected RAG receipt across its success-result copy', async () => {
  const v = await currentPolicyReviewFixture();
  const owner = new ClassificationPolicyPathService({
    logger: Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, jest.fn()])),
    policyEngine: { evaluateItem: async () => v.result },
    classificationAiService: { aiClassify: async () => ({ library: v.libraries[0], confidence: 75, needs_clarification: true }) },
    classificationRagLoopService: { evaluateRagLoopSecondPass: async () => v.published },
    classificationRoutingService: { ensureDecisionQuestion: async ({ result }) => result },
  });
  const response = await owner.execute({ metadata: v.item, libraries: v.libraries, relatedEvidence: [] });
  expect(response.handled).toBe(true); expect(response.result).not.toBe(v.published);
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(response.result, v.item)).status).toBe('recorded');
});
