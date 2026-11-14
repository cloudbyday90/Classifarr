/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { automaticPolicyReviewFixture } from '../fixtures/automaticPolicyReviewFixture.mjs';
import { holdAdoptedRagResultContextSource, applyAdoptedRagResultContext } from '../../services/adoptedRagResultContext.mjs';
import { runPolicyRecheckStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';

afterEach(() => jest.restoreAllMocks());
const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const apply = (value, token = holdAdoptedRagResultContextSource(args(value)), scope = args(value)) =>
  applyAdoptedRagResultContext(value.stage, token, scope);

test.each(['native_intent', 'compatibility_bridge'])('%s automatic construction owns fresh context and preserves outcome/authority', async source => {
  const value = await automaticPolicyReviewFixture({ source });
  const signals = { explicit_signal: 81 }, rag = { similarItems: [{ similarity: 0.83 }] };
  const advisory = { message: 'Earlier advisory' }, earlier = value.ctx.signalContext;
  Object.assign(earlier, { signals: { nested_earlier_signal: 99 }, relatedEvidenceSummary: 'Earlier summary' });
  Object.assign(value.ctx.baselineResult, { confidence: 98, signals, ragContext: rag, ai_advisory: advisory });
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  const stage = await runPolicyRecheckStage(value.ctx), candidate = stage.pass2Candidate;
  expect(stage.policyGate.shouldAdopt).toBe(true);
  expect(candidate).toMatchObject({ method: 'policy_auto', confidence: 98, ai_advisory: null, candidate_bound_verification: null });
  expect(candidate.signalContext).toEqual({ ranked: value.result.ranked, confidence: 90, suggestedLibrary: value.libraries[0] });
  expect(Object.isFrozen(candidate.signalContext)).toBe(true);
  expect(candidate.signalContext.ranked).toBe(value.result.ranked);
  expect(candidate.signalContext.suggestedLibrary).toBe(value.libraries[0]);
  expect(candidate.signals).toBe(signals); expect(candidate.ragContext).toBe(rag);
  expect(candidate.ai_authority).toBe(value.ctx.baselineResult.ai_authority);
  expect(candidate.ai_authority.sideEffects.canRoute).toBe(false);
  expect(value.ctx.baselineResult.signalContext).toBe(earlier);
  expect(value.ctx.baselineResult.ai_advisory).toBe(advisory);
});

test.each(['missing', 'offline', 'copied', 'other item', 'other pool', '65 candidates', '65 libraries'])(
  '%s automatic proof leaves owned absence without changing its deterministic candidate', async kind => {
    const value = await automaticPolicyReviewFixture({ live: kind !== 'offline',
      source: kind === '65 candidates' ? 'compatibility_bridge' : 'native_intent', count: kind === '65 candidates' ? 65 : 1 });
    expect(value.result.action).toBe('auto_classify');
    if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 63 }, (_, i) => ({ id: i + 3001, is_active: true, media_type: 'movie' })));
    const token = kind === 'missing' ? null : holdAdoptedRagResultContextSource({ ...args(value),
      ...(kind === 'copied' ? { policyResult: { ...value.result } } : {}) });
    const authority = value.candidate.ai_authority;
    apply(value, token, { ...args(value), ...(kind === 'other item' ? { metadata: { ...value.item } } : {}),
      ...(kind === 'other pool' ? { libraries: [...value.libraries] } : {}) });
    expect(value.stage.pass2Candidate).toBe(value.candidate);
    expect(value.candidate.signalContext).toBeNull(); expect(value.candidate.ai_advisory).toBeNull();
    expect(value.candidate.library).toBe(value.libraries[0]);
    expect(value.candidate.method).toBe('policy_auto'); expect(value.candidate.needs_clarification).toBe(false);
    expect(value.candidate.ai_authority).toBe(authority);
  });

test.each(['score', 'revision', 'item', 'pool', 'not adopted', 'failed stage', 'policy copy', 'library copy',
  'method', 'invalid confidence', 'confirm action', 'select action'])(
  '%s mutation before automatic construction cannot populate context', async kind => {
    const value = await automaticPolicyReviewFixture(), token = holdAdoptedRagResultContextSource(args(value));
    expect(token).not.toBeNull();
    if (kind === 'score') value.result.ranked[0].score++;
    if (kind === 'revision') value.result.ranked[0].policy_intent_read_trace.intent_version++;
    if (kind === 'item') value.item.tmdb_id++;
    if (kind === 'pool') value.libraries[0].is_active = false;
    if (kind === 'not adopted') value.stage.policyGate.shouldAdopt = false;
    if (kind === 'failed stage') value.stage.hadError = true;
    if (kind === 'policy copy') value.candidate.policyResult = { ...value.result };
    if (kind === 'library copy') value.candidate.library = { ...value.libraries[0] };
    if (kind === 'method') value.candidate.method = 'policy_recheck';
    if (kind === 'invalid confidence') value.candidate.confidence = NaN;
    if (kind === 'confirm action') value.result.action = 'prompt_confirm';
    if (kind === 'select action') value.result.action = 'prompt_select';
    apply(value, token); expect(value.candidate.signalContext).toBeNull();
  });

test('automatic complete 64-candidate/64-library proof is admitted without truncation', async () => {
  const value = await automaticPolicyReviewFixture({ source: 'compatibility_bridge', count: 64 }); value.libraries.pop();
  expect(value.result.action).toBe('auto_classify'); apply(value);
  expect(value.candidate.signalContext.ranked).toBe(value.result.ranked);
  expect(value.candidate.signalContext.ranked).toHaveLength(64);
});

test('automatic source is single use, with no later reference-freshness promise', async () => {
  const value = await automaticPolicyReviewFixture(), token = holdAdoptedRagResultContextSource(args(value));
  apply(value, { ...token }); expect(value.candidate.signalContext).toBeNull();
  apply(value, token); const context = value.candidate.signalContext;
  expect(context).not.toBeNull(); value.result.ranked[0].score--;
  expect(value.candidate.signalContext).toBe(context); expect(context.ranked[0].score).toBe(89);
  value.candidate.signalContext = null; apply(value, token); expect(value.candidate.signalContext).toBeNull();
});

test.each(['accessor', 'frozen'])('automatic %s output is refused without invoking user code or altering processing', async kind => {
  const value = await automaticPolicyReviewFixture(), token = holdAdoptedRagResultContextSource(args(value));
  const trap = jest.fn(() => { throw new Error('must not run'); });
  if (kind === 'accessor') Object.defineProperty(value.candidate, 'signalContext', { configurable: true, get: trap });
  else Object.freeze(value.candidate);
  expect(() => apply(value, token)).not.toThrow(); expect(trap).not.toHaveBeenCalled();
  if (kind === 'accessor') expect(Object.getOwnPropertyDescriptor(value.candidate, 'signalContext').get).toBe(trap);
  else expect(value.candidate.signalContext).toBeNull();
});

test('automatic source is captured before adoption callbacks mutate its numeric input', async () => {
  const value = await automaticPolicyReviewFixture();
  jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  const stage = await runPolicyRecheckStage({ ...value.ctx, addEvent: event => {
    if (event.stage === 'policy_recheck') value.result.ranked[0].score++;
  } });
  expect(stage.policyGate.shouldAdopt).toBe(true); expect(stage.pass2Candidate.signalContext).toBeNull();
  expect(stage.pass2Candidate.ai_advisory).toBeNull();
});
