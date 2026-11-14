/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ragRecheckAdviceFixture as createFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import { holdAdoptedRagResultContextSource, applyAdoptedRagResultContext } from '../../services/adoptedRagResultContext.mjs';
import { runPolicyRecheckStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';

afterEach(() => jest.restoreAllMocks());
const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const apply = (value, token = holdAdoptedRagResultContextSource(args(value)), stage = value.stage, scope = args(value)) =>
  applyAdoptedRagResultContext(stage, token, scope);

describe.each(['prompt_confirm', 'prompt_select'])('%s construction-owned context', action => {
  const ragRecheckAdviceFixture = options => createFixture({ ...options, action });

  test.each(['native_intent', 'compatibility_bridge'])('%s construction uses fresh minimal context with independent outcome confidence', async source => {
    const value = await ragRecheckAdviceFixture({ source, confidence: 75, afterEvaluate: row => { row.score = 70; } });
    value.candidate.confidence = 80;
    const original = value.ctx.baselineResult.signalContext;
    expect(apply(value)).toBe(value.stage);
    expect(value.stage.pass2Candidate).toBe(value.candidate);
    expect(value.candidate.signalContext).toEqual({ ranked: value.result.ranked, confidence: 75, suggestedLibrary: value.libraries[0] });
    expect(Object.isFrozen(value.candidate.signalContext)).toBe(true);
    expect(value.candidate.signalContext.ranked).toBe(value.result.ranked);
    expect(value.candidate.signalContext.suggestedLibrary).toBe(value.libraries[0]);
    expect(value.candidate.confidence).toBe(80);
    expect(value.candidate.ai_advisory).toBeNull();
    expect(value.ctx.baselineResult.signalContext).toBe(original);
  });

  test.each(['missing', 'offline', 'copied', 'other item', 'other pool', '65 candidates', '65 libraries'])(
    '%s proof leaves explicit absence rather than inherited or reconstructed support', async kind => {
      const value = await ragRecheckAdviceFixture({ live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1 });
      if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 64 }, (_, i) => ({ id: i + 3001, is_active: true, media_type: 'movie' })));
      const token = kind === 'missing' ? null : holdAdoptedRagResultContextSource({ ...args(value),
        ...(kind === 'copied' ? { policyResult: { ...value.result } } : {}) });
      apply(value, token, value.stage, { ...args(value), ...(kind === 'other item' ? { metadata: { ...value.item } } : {}),
        ...(kind === 'other pool' ? { libraries: [...value.libraries] } : {}) });
      expect(value.candidate.signalContext).toBeNull();
      expect(value.candidate.ai_advisory).toBeNull();
    });

  test.each(['score', 'revision', 'item', 'pool', 'not adopted', 'failed stage', 'policy copy', 'library copy',
    'method', 'invalid confidence'])(
    '%s before construction cannot populate support', async kind => {
      const value = await ragRecheckAdviceFixture(), token = holdAdoptedRagResultContextSource(args(value));
      if (kind === 'score') value.result.ranked[0].score++;
      if (kind === 'revision') value.result.ranked[0].policy_intent_read_trace.intent_version++;
      if (kind === 'item') value.item.tmdb_id++;
      if (kind === 'pool') value.libraries[0].is_active = false;
      if (kind === 'not adopted') value.stage.policyGate.shouldAdopt = false;
      if (kind === 'failed stage') value.stage.hadError = true;
      if (kind === 'policy copy') value.candidate.policyResult = { ...value.result };
      if (kind === 'library copy') value.candidate.library = { ...value.libraries[0] };
      if (kind === 'method') value.candidate.method = 'ai_rerun';
      if (kind === 'invalid confidence') value.candidate.confidence = NaN;
      apply(value, token);
      expect(value.candidate.signalContext).toBeNull();
    });

  test.each(['missing label', 'long label', 'accessor label'])('%s does not couple numeric construction support to invocation permission', async kind => {
    const value = await ragRecheckAdviceFixture(), trap = jest.fn(() => { throw new Error('must not inspect labels'); });
    if (kind === 'missing label') delete value.libraries[0].name;
    if (kind === 'long label') value.libraries[0].name = 'x'.repeat(161);
    if (kind === 'accessor label') Object.defineProperty(value.libraries[0], 'name', { get: trap });
    apply(value);
    expect(value.candidate.signalContext.suggestedLibrary).toBe(value.libraries[0]);
    expect(trap).not.toHaveBeenCalled();
  });

  test('complete 64-candidate/64-library proof is admitted without truncation', async () => {
    const value = await ragRecheckAdviceFixture({ count: 64 }); value.libraries.pop();
    apply(value);
    expect(value.candidate.signalContext.ranked).toHaveLength(64);
  });

  test('complete numeric proof over 16 KiB stays unavailable rather than being truncated', async () => {
    const value = await ragRecheckAdviceFixture({ count: 64, configure: (policy, index) => {
      policy.id = 2147483647 - index; policy.library_id = 2147483000 - index;
      policy.native_intent_version = 2147483647;
      policy.auto_classify_threshold = 85.12345678901234; policy.prompt_threshold = 60.12345678901234;
      Object.assign(policy.policy_intent_contract, { policy_id: policy.id, library_id: policy.library_id });
      Object.assign(policy.policy_intent_read_trace, { policy_id: policy.id, intent_version: policy.native_intent_version });
    }, afterEvaluate: row => { row.score = 0.0000010000000000000002; } });
    value.libraries.pop();
    expect(holdAdoptedRagResultContextSource(args(value))).toBeNull();
    apply(value, null); expect(value.candidate.signalContext).toBeNull();
  });

  test('source is single use and equal public fields cannot replace its token', async () => {
    const value = await ragRecheckAdviceFixture(), token = holdAdoptedRagResultContextSource(args(value));
    apply(value, { ...token }); expect(value.candidate.signalContext).toBeNull();
    apply(value, token); expect(value.candidate.signalContext).not.toBeNull();
    value.candidate.signalContext = null;
    apply(value, token); expect(value.candidate.signalContext).toBeNull();
  });

  test('construction ownership does not claim later mutation or terminal revalidation', async () => {
    const value = await ragRecheckAdviceFixture(); apply(value);
    const context = value.candidate.signalContext;
    value.result.ranked[0].score++;
    value.libraries[0].is_active = false;
    expect(value.candidate.signalContext).toBe(context);
    expect(context.ranked[0].score).toBe(value.result.ranked[0].score);
    expect(context.suggestedLibrary.is_active).toBe(false);
  });

  test('hostile numeric proof and replaced output accessors are never invoked', async () => {
    const value = await ragRecheckAdviceFixture(), trap = jest.fn(() => { throw new Error('must not run'); });
    const token = holdAdoptedRagResultContextSource(args(value));
    Object.defineProperty(value.candidate, 'signalContext', { configurable: true, get: trap });
    expect(() => apply(value, token)).not.toThrow();
    const descriptor = Object.getOwnPropertyDescriptor(value.candidate, 'signalContext');
    expect(descriptor.get).toBe(trap);
    expect(holdAdoptedRagResultContextSource({ ...args(value), policyResult: new Proxy({}, { getOwnPropertyDescriptor: trap }) })).toBeNull();
    expect(trap).not.toHaveBeenCalled();
  });

  test('optional raw detail and frozen output cannot alter numeric admission or primary processing', async () => {
    const value = await ragRecheckAdviceFixture(), trap = jest.fn(() => { throw new Error('must not run'); });
    Object.defineProperty(value.result.ranked[0], 'breakdown', { get: trap });
    const token = holdAdoptedRagResultContextSource(args(value));
    expect(token).not.toBeNull();
    Object.freeze(value.candidate);
    expect(() => apply(value, token)).not.toThrow();
    expect(value.candidate.signalContext).toBeNull();
    expect(trap).not.toHaveBeenCalled();
  });

  test.each([false, true])('top-level signals and RAG remain independent, with fresh RAG present=%s', async freshRag => {
    const value = await ragRecheckAdviceFixture(), signals = { explicit_signal: 81 }, previousRag = { similarItems: [{ similarity: 0.8 }] };
    const currentRag = freshRag ? { similarItems: [{ similarity: 0.91 }] } : null;
    Object.assign(value.ctx.baselineResult, { signals, ragContext: previousRag, ai_advisory: { message: 'Earlier advisory' } });
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
    const stage = await runPolicyRecheckStage({ ...value.ctx, pass2RagContext: currentRag });
    expect(stage.pass2Candidate.signals).toBe(signals);
    expect(stage.pass2Candidate.ragContext).toBe(currentRag || previousRag);
    expect(stage.pass2Candidate.signalContext.signals).toBeUndefined();
    expect(stage.pass2Candidate.signalContext.ragContext).toBeUndefined();
    expect(value.ctx.baselineResult.ai_advisory).toEqual({ message: 'Earlier advisory' });
  });

  test('production construction captures proof before adoption callbacks can change its source', async () => {
    const value = await ragRecheckAdviceFixture();
    jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
    const stage = await runPolicyRecheckStage({ ...value.ctx, addEvent: event => {
      if (event.stage === 'policy_recheck') value.result.ranked[0].score++;
    } });
    expect(stage.policyGate.shouldAdopt).toBe(true);
    expect(stage.pass2Candidate.signalContext).toBeNull();
    expect(stage.pass2Candidate.ai_advisory).toBeNull();
  });

  test.each(['other pending action', 'automatic', 'unknown', 'accessor'])(
    '%s source action after capture cannot populate construction context', async kind => {
      const value = await ragRecheckAdviceFixture(), token = holdAdoptedRagResultContextSource(args(value));
      const trap = jest.fn(() => { throw new Error('must not run'); });
      if (kind === 'accessor') Object.defineProperty(value.result, 'action', { get: trap, configurable: true });
      else value.result.action = kind === 'other pending action'
        ? action === 'prompt_confirm' ? 'prompt_select' : 'prompt_confirm'
        : kind === 'automatic' ? 'auto_classify' : null;
      apply(value, token);
      expect(value.candidate.signalContext).toBeNull();
      expect(value.candidate.ai_advisory).toBeNull();
      expect(trap).not.toHaveBeenCalled();
    });
});

test.each(['manual'])('%s source is outside construction-context admission', async action => {
  const value = await createFixture({ action });
  expect(holdAdoptedRagResultContextSource(args(value))).toBeNull();
  expect(value.candidate.signalContext).toBe(value.ctx.signalContext);
});
