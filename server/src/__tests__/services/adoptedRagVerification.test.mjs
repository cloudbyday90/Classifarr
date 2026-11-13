/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { ragRecheckAdviceFixture } from '../fixtures/ragRecheckAdviceFixture.mjs';
import { holdAdoptedRagVerificationSource, retainAdoptedRagVerificationStage, prepareAdoptedRagVerification,
  enterAdoptedRagVerification, acceptAdoptedRagVerification, retainAdoptedRagVerificationGap } from '../../services/adoptedRagVerification.mjs';
import { isAdoptedRagVerificationRefusal } from '../../services/adoptedRagVerificationRefusal.mjs';
import { publishCurrentPolicyReviewFrame, holdCurrentPolicyReviewFrame, projectCurrentPolicyReviewFrame } from '../../services/currentPolicyReviewFrameLive.mjs';

const args = value => ({ policyResult: value.result, metadata: value.item, libraries: value.libraries, candidate: value.candidate });
const invocation = (value, held) => ({ metadata: value.item, libraries: value.libraries, signalContext: held.signalContext });
function hold(value) {
  retainAdoptedRagVerificationStage(value.stage, holdAdoptedRagVerificationSource(args(value)));
  return prepareAdoptedRagVerification(value.stage, args(value));
}
function refused(callback) {
  let observed;
  try { callback(); } catch (error) { observed = error; }
  expect(isAdoptedRagVerificationRefusal(observed)).toBe(true);
}

test.each(['native_intent', 'compatibility_bridge'])('%s live source owns the minimal current input', async source => {
  const value = await ragRecheckAdviceFixture({ source, confidence: 75 });
  const held = hold(value);
  expect(Object.keys(held.signalContext).sort()).toEqual(['confidence', 'ranked', 'suggestedLibrary']);
  expect(Object.isFrozen(held.signalContext)).toBe(true);
  expect(held.signalContext).toMatchObject({ ranked: value.result.ranked, confidence: 75, suggestedLibrary: value.libraries[0] });
  refused(() => acceptAdoptedRagVerification(held.token));
  const session = enterAdoptedRagVerification(held.token, invocation(value, held), held.candidate);
  expect(() => session.assertCurrent()).not.toThrow();
  expect(prepareAdoptedRagVerification(value.stage, args(value))).toBeNull();
  refused(() => enterAdoptedRagVerification(held.token, invocation(value, held), held.candidate));
  refused(() => session.assertCurrent());
});

test.each(['offline', 'copied result', 'copied item', '65 candidates', '65 libraries', 'wrong action', 'missing label', 'accessor label'])(
  '%s cannot mint invocation authority', async kind => {
    const value = await ragRecheckAdviceFixture({ live: kind !== 'offline', count: kind === '65 candidates' ? 65 : 1 });
    let input = args(value);
    const trap = jest.fn();
    if (kind === 'copied result') input = { ...input, policyResult: { ...value.result } };
    if (kind === 'copied item') input = { ...input, metadata: { ...value.item } };
    if (kind === '65 libraries') value.libraries.push(...Array.from({ length: 64 }, (_, i) => ({ id: 3001 + i })));
    if (kind === 'wrong action') value.result.action = 'prompt_select';
    if (kind === 'missing label') delete value.libraries[0].name;
    if (kind === 'accessor label') Object.defineProperty(value.libraries[0], 'name', { get: trap });
    expect(holdAdoptedRagVerificationSource(input)).toBeNull();
    expect(trap).not.toHaveBeenCalled();
  });

test('complete 64-row evidence and long optional labels retain numeric authority', async () => {
  const value = await ragRecheckAdviceFixture({ count: 64 });
  value.libraries.pop(); value.libraries[0].name = 'x'.repeat(161);
  const held = hold(value), session = enterAdoptedRagVerification(held.token, invocation(value, held), held.candidate);
  expect(held.signalContext.ranked).toHaveLength(64);
  value.libraries[0].name = 'x'.repeat(160) + 'y';
  expect(() => session.assertCurrent()).not.toThrow(); // The consumed contract label is the 160-unit prefix.
  value.libraries[0].name = 'y' + 'x'.repeat(160);
  refused(() => session.assertCurrent());
});

test.each(['stage copy', 'gate copy', 'not adopted', 'failed', 'candidate copy', 'candidate confidence', 'candidate method',
  'candidate library', 'result copy', 'item copy', 'pool copy'])(
  '%s cannot prepare another stage input', async kind => {
    const value = await ragRecheckAdviceFixture();
    retainAdoptedRagVerificationStage(value.stage, holdAdoptedRagVerificationSource(args(value)));
    let stage = value.stage, input = args(value);
    if (kind === 'stage copy') stage = { ...stage };
    if (kind === 'gate copy') stage.policyGate = { ...stage.policyGate };
    if (kind === 'not adopted') stage.policyGate.shouldAdopt = false;
    if (kind === 'failed') stage.hadError = true;
    if (kind === 'candidate copy') input = { ...input, candidate: { ...value.candidate } };
    if (kind === 'candidate confidence') value.candidate.confidence++;
    if (kind === 'candidate method') value.candidate.method = 'ai_rerun';
    if (kind === 'candidate library') value.candidate.library = { ...value.candidate.library };
    if (kind === 'result copy') input = { ...input, policyResult: { ...value.result } };
    if (kind === 'item copy') input = { ...input, metadata: { ...value.item } };
    if (kind === 'pool copy') input = { ...input, libraries: [...value.libraries] };
    expect(prepareAdoptedRagVerification(stage, input)).toBeNull();
  });

test.each(['item', 'ranking', 'confidence', 'revision', 'pool', 'label', 'stage'])(
  '%s changes latch refusal even after values are restored', async kind => {
    const value = await ragRecheckAdviceFixture(), held = hold(value);
    const session = enterAdoptedRagVerification(held.token, invocation(value, held), held.candidate);
    const [object, key] = kind === 'item' ? [value.item, 'tmdb_id'] : kind === 'ranking' ? [value.result.ranked[0], 'score']
      : kind === 'confidence' ? [value.result, 'confidence'] : kind === 'revision' ? [value.result.ranked[0].policy_intent_read_trace, 'intent_version']
        : kind === 'pool' ? [value.libraries[0], 'is_active'] : kind === 'label' ? [value.libraries[0], 'name'] : [value.stage, 'hadError'];
    const before = object[key];
    object[key] = typeof before === 'number' ? before + 1 : typeof before === 'string' ? before + ' changed' : !before;
    refused(() => session.assertCurrent());
    object[key] = before;
    refused(() => session.assertCurrent());
  });

test.each(['token', 'item', 'pool', 'context', 'candidate'] )('%s substitution refuses entry without shape-based authority', async kind => {
  const value = await ragRecheckAdviceFixture(), held = hold(value), input = invocation(value, held);
  if (kind === 'item') input.metadata = { ...input.metadata };
  if (kind === 'pool') input.libraries = [...input.libraries];
  if (kind === 'context') input.signalContext = { ...input.signalContext };
  refused(() => enterAdoptedRagVerification(kind === 'token' ? {} : held.token, input, kind === 'candidate' ? { ...held.candidate } : held.candidate));
});

test('missing/corrupt stage inspection is a gap and a forged error is not a local refusal', async () => {
  const trap = jest.fn(() => { throw new Error('hostile'); });
  expect(holdAdoptedRagVerificationSource({ policyResult: new Proxy({}, { getOwnPropertyDescriptor: trap }) })).toBeNull();
  expect(trap).not.toHaveBeenCalled();
  expect(retainAdoptedRagVerificationStage({}, {})).toEqual({});
  expect(prepareAdoptedRagVerification({}, {})).toBeNull();
  expect(isAdoptedRagVerificationRefusal(new Error('Fresh verification context is unavailable'))).toBe(false);
  const value = await ragRecheckAdviceFixture();
  retainAdoptedRagVerificationGap(value.candidate, args(value));
  const published = publishCurrentPolicyReviewFrame(value.candidate, { ...value.candidate });
  expect(projectCurrentPolicyReviewFrame(holdCurrentPolicyReviewFrame(published, value.item)))
    .toMatchObject({ status: 'evidence_gap', policy: null });
});
