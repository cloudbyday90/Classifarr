/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { ragRecheckAdviceFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import { verificationProfile } from '../fixtures/verificationAdviceFixture.mjs';
import { holdRagRecheckAdviceSource, retainRagRecheckAdvice, takeRagRecheckAdvice, createRagRecheckAdviceSession } from '../../services/ragRecheckVerificationAdvice.mjs';
import { runPolicyRecheckStage, runAiRerunStage } from '../../services/classificationRagLoopStages.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { ragLoopResilienceManager } from '../../services/ragLoopResilienceManager.mjs';
import { createPolicyVerificationAdviceSession } from '../../services/policyVerificationAdvice.mjs';

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const sourceArgs = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries });
const consumerArgs = value => ({ ...sourceArgs(value), signalContext: value.consumer, candidate: value.candidate });
const sections = session => session.buildPrompt({}, async context => context);
function retain(value) { return retainRagRecheckAdvice(value.stage, holdRagRecheckAdviceSource(sourceArgs(value))); }
function take(value, stage = value.stage) { return takeRagRecheckAdvice(stage, consumerArgs(value)); }

test.each(['native_intent', 'compatibility_bridge'])('fresh %s source separates qualified advice from unchanged earlier authority fields', async source => {
  const value = await ragRecheckAdviceFixture({ source, confidence: 73 }), before = JSON.stringify(value.stage);
  expect(retain(value)).toBe(value.stage); expect(JSON.stringify(value.stage)).toBe(before);
  const token = take(value), session = createRagRecheckAdviceSession(token, consumerArgs(value));
  const lookup = jest.fn(async () => verificationProfile()); await session.readProfile(lookup);
  expect(lookup).toHaveBeenCalledWith(value.libraries[0].id); expect(lookup).toHaveBeenCalledTimes(1);
  const result = await sections(session);
  expect(result.policySignals).toEqual({ confidence: 73, suggestedLibrary: { name: value.libraries[0].name } });
  expect(result.libraryProfile.totalItems).toBe(10); expect(JSON.stringify(result)).not.toContain('EARLIER PASS SENTINEL');
  expect(value.consumer.breakdown).toBe(value.ctx.signalContext.breakdown);
  expect(value.consumer.ranked).toBe(value.ctx.signalContext.ranked); expect(JSON.stringify(token)).toBe('{}');
  expect(await sections(createRagRecheckAdviceSession(token, consumerArgs(value)))).toEqual({ policySignals: {}, libraryProfile: null });
  expect(take(value)).toBeNull();
});

test.each(['stage copy', 'result copy', 'candidate replacement', 'candidate destination', 'gate replacement', 'failed', 'not adopted', 'other item', 'other pool', 'consumer confidence', 'consumer destination'])(
  '%s cannot reuse successful-stage proof', async kind => {
    const value = await ragRecheckAdviceFixture(); retain(value); let stage = value.stage, args = consumerArgs(value);
    if (kind === 'stage copy') stage = { ...stage };
    if (kind === 'result copy') value.stage.policyAfter = { ...value.result };
    if (kind === 'candidate replacement') value.stage.pass2Candidate = { ...value.candidate };
    if (kind === 'candidate destination') value.candidate.library = { ...value.libraries[0] };
    if (kind === 'gate replacement') value.stage.policyGate = { shouldAdopt: true };
    if (kind === 'failed') value.stage.hadError = true;
    if (kind === 'not adopted') value.stage.policyGate.shouldAdopt = false;
    if (kind === 'other item') args = { ...args, metadata: { ...value.item } };
    if (kind === 'other pool') args = { ...args, libraries: [...value.libraries] };
    if (kind === 'consumer confidence') value.consumer.confidence++;
    if (kind === 'consumer destination') value.consumer.suggestedLibrary = { ...value.libraries[0] };
    expect(takeRagRecheckAdvice(stage, args)).toBeNull();
  });

test.each(['consumer', 'stage', 'candidate', 'pool', 'source score', 'label', 'item'])(
  '%s mutation during lookup latches omission across formatting', async kind => {
    const value = await ragRecheckAdviceFixture(); retain(value);
    const session = createRagRecheckAdviceSession(take(value), consumerArgs(value));
    await session.readProfile(async () => {
      if (kind === 'consumer') value.consumer.confidence++;
      if (kind === 'stage') value.stage.policyGate.shouldAdopt = false;
      if (kind === 'candidate') value.candidate.library = { ...value.libraries[0] };
      if (kind === 'pool') value.libraries[0].is_active = false;
      if (kind === 'source score') value.result.ranked[0].score++;
      if (kind === 'label') value.libraries[0].name += ' changed';
      if (kind === 'item') value.item.tmdb_id++;
      return verificationProfile();
    });
    value.consumer.confidence = 70;
    expect(await sections(session)).toEqual({ policySignals: {}, libraryProfile: null });
  });

test('consumer mutation during formatting uses the shared two-build omission bound', async () => {
  const value = await ragRecheckAdviceFixture(); retain(value);
  const session = createRagRecheckAdviceSession(take(value), consumerArgs(value));
  const build = jest.fn(async context => { value.consumer.confidence++; await Promise.resolve(); return context; });
  expect(await session.buildPrompt({}, build)).toEqual({ policySignals: {}, libraryProfile: null });
  expect(build).toHaveBeenCalledTimes(2);
});

test('consumer accessors cannot execute while the additional private guard rejects data', async () => {
  const value = await ragRecheckAdviceFixture(); retain(value);
  const session = createRagRecheckAdviceSession(take(value), consumerArgs(value));
  const trap = jest.fn(() => { throw new Error('must not run'); });
  Object.defineProperty(value.consumer, 'confidence', { get: trap });
  const lookup = jest.fn(); await session.readProfile(lookup);
  expect(lookup).not.toHaveBeenCalled(); expect(trap).not.toHaveBeenCalled();
  expect(await sections(session)).toEqual({ policySignals: {}, libraryProfile: null });
});

test.each(['missing', 'offline', 'copied', 'wrong item', 'overflow'])( '%s evaluation cannot manufacture fresh source proof', async kind => {
  const value = await ragRecheckAdviceFixture({ live: kind !== 'offline', count: kind === 'overflow' ? 65 : 1 });
  let args = sourceArgs(value);
  if (kind === 'missing') args = {};
  if (kind === 'copied') args = { ...args, policyResult: { ...value.result } };
  if (kind === 'wrong item') args = { ...args, metadata: { ...value.item } };
  expect(holdRagRecheckAdviceSource(args)).toBeNull();
});

test('initial and RAG tokens cannot be exchanged; a copied consumer cannot use the original request token', async () => {
  const value = await ragRecheckAdviceFixture(); retain(value); const token = take(value);
  expect(await sections(createPolicyVerificationAdviceSession(token, consumerArgs(value)))).toEqual({ policySignals: {}, libraryProfile: null });
  expect(await sections(createRagRecheckAdviceSession(token, { ...consumerArgs(value), signalContext: { ...value.consumer } })))
    .toEqual({ policySignals: {}, libraryProfile: null });
});

test('actual successful stage holds the label before adoption callbacks can change it', async () => {
  const value = await ragRecheckAdviceFixture(); jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  const stage = await runPolicyRecheckStage({ ...value.ctx, addEvent: () => { value.libraries[0].name += ' changed'; } });
  expect(stage.policyGate.shouldAdopt).toBe(true);
  const token = takeRagRecheckAdvice(stage, { ...consumerArgs(value), candidate: stage.pass2Candidate });
  const lookup = jest.fn(); const session = createRagRecheckAdviceSession(token, consumerArgs(value));
  await session.readProfile(lookup); expect(lookup).not.toHaveBeenCalled(); expect((await sections(session)).policySignals).toEqual({});
});

test.each(['skip', 'failure', 'timeout'])( '%s recheck cannot recover proof from a genuine retained same-item result', async kind => {
  const value = await ragRecheckAdviceFixture();
  const evaluate = jest.spyOn(policyEngine, 'evaluateItem'); let resolveLate;
  if (kind === 'failure') evaluate.mockRejectedValue(new Error('Owned refusal'));
  if (kind === 'timeout') evaluate.mockImplementation(() => new Promise(resolve => { resolveLate = resolve; }));
  const stage = await runPolicyRecheckStage({ ...value.ctx, policyResult: value.result,
    ...(kind === 'skip' ? { remainingBudget: () => 0 } : {}), ...(kind === 'timeout' ? { remainingBudget: () => 5 } : {}) });
  if (resolveLate) { resolveLate(value.result); await Promise.resolve(); }
  expect(stage.policyAfter).toBe(value.result);
  expect(takeRagRecheckAdvice(stage, consumerArgs(value))).toBeNull();
  if (kind === 'skip') expect(evaluate).not.toHaveBeenCalled(); else expect(evaluate).toHaveBeenCalledTimes(1);
});

test('production stages keep call accounting and retained result context while qualifying fresh advice', async () => {
  const value = await ragRecheckAdviceFixture(); jest.spyOn(policyEngine, 'evaluateItem').mockResolvedValue(value.result);
  jest.spyOn(ragLoopResilienceManager, 'canRun').mockReturnValue({ allowed: true });
  const stage = await runPolicyRecheckStage(value.ctx); expect(stage.policyGate.shouldAdopt).toBe(true);
  const aiClassify = jest.fn(async (metadata, libraries, signalContext, options) => {
    const session = createRagRecheckAdviceSession(options.ragRecheckVerificationAdvice, { metadata, libraries, signalContext });
    expect((await sections(session)).policySignals.confidence).toBe(70);
    return { library: libraries[0], confidence: 70, verified_by_ai: true };
  });
  const result = await runAiRerunStage({ ...value.ctx, policyAfter: stage.policyAfter, existingCandidate: stage.pass2Candidate, policyRecheckStage: stage, aiClassify });
  expect(aiClassify).toHaveBeenCalledTimes(1); expect(result.aiCallsUsed).toBe(2);
  expect(result.pass2Candidate.signalContext).toBe(value.ctx.signalContext);
});
