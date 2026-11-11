/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { verificationAdviceFixture, verificationProfile } from '../fixtures/verificationAdviceFixture.mjs';
import { holdPolicyVerificationAdvice, createPolicyVerificationAdviceSession } from '../../services/policyVerificationAdvice.mjs';
import { projectVerificationProfile, projectVerificationAdvice, boundVerificationAdvice, VERIFICATION_ADVICE_BYTES } from '../../services/policyVerificationAdviceProjection.mjs';
import { buildClassificationBasePrompt } from '../../services/classificationBasePrompt.mjs';
import { AIPromptBuilder } from '../../services/aiPromptBuilder.mjs';

const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, () => {}]));
const builder = new AIPromptBuilder({ logger });
const sections = session => session.buildPrompt({}, async context => context);

test.each(['native_intent', 'compatibility_bridge'])('genuine %s selection carries original confidence and only qualified fields', async source => {
  const value = await verificationAdviceFixture({ source, confidence: 73 });
  const lookup = jest.fn(async () => verificationProfile());
  await value.session.readProfile(lookup);
  expect(lookup).toHaveBeenCalledTimes(1); expect(lookup).toHaveBeenCalledWith(value.libraries[0].id);
  const result = await sections(value.session);
  expect(result.policySignals).toEqual({ confidence: 73, suggestedLibrary: { name: value.libraries[0].name } });
  expect(result.libraryProfile.totalItems).toBe(10);
  expect(Object.isFrozen(result.libraryProfile.observation.traits.genres)).toBe(true);
  expect(JSON.stringify(value.adviceToken)).toBe('{}');
});

test('whole raw signal/override packet cannot fall through when scoped proof is missing', async () => {
  const value = await verificationAdviceFixture({ live: false });
  const lookup = jest.fn(); await value.session.readProfile(lookup);
  const prompt = await value.session.buildPrompt({ metadata: value.item, libraries: value.libraries,
    signalContext: value.context, policySignals: { confidence: 99, suggestedLibrary: { name: 'UNBOUND OVERRIDE' } } },
  context => buildClassificationBasePrompt(context, { mode: 'verify', promptBuilder: builder }));
  expect(lookup).not.toHaveBeenCalled();
  expect(prompt).not.toContain('POLICY ENGINE SIGNALS'); expect(prompt).not.toContain('UNBOUND OVERRIDE');
  expect(prompt).toContain('VERIFICATION MODE'); // Verification authority is separate, not claimed by this adapter.
});

test.each(['copy', 'serialized', 'other item', 'other context', 'other pool', 'result copy'])(
  '%s cannot supply private selection/profile proof', async kind => {
    const value = await verificationAdviceFixture(); let token = value.adviceToken, args = value.args;
    if (kind === 'copy') token = { ...token };
    if (kind === 'serialized') token = JSON.parse(JSON.stringify(token));
    if (kind === 'other item') args = { ...args, metadata: { ...value.item } };
    if (kind === 'other context') args = { ...args, signalContext: { ...value.context } };
    if (kind === 'other pool') args = { ...args, libraries: [...value.libraries] };
    if (kind === 'result copy') token = holdPolicyVerificationAdvice({ ...args, policyResult: { ...value.result } });
    const session = createPolicyVerificationAdviceSession(token, args), lookup = jest.fn();
    await session.readProfile(lookup); expect(lookup).not.toHaveBeenCalled();
    expect(await sections(session)).toEqual({ policySignals: {}, libraryProfile: null });
  });

test.each(['name', 'inactive', 'confidence', 'score', 'item', 'revision'])('observed %s mutation during profile lookup invalidates optional material permanently', async kind => {
  const value = await verificationAdviceFixture();
  await value.session.readProfile(async () => {
    if (kind === 'name') value.libraries[0].name += ' changed';
    if (kind === 'inactive') value.libraries[0].is_active = false;
    if (kind === 'confidence') value.context.confidence++;
    if (kind === 'score') value.result.ranked[0].score++;
    if (kind === 'item') value.item.tmdb_id++;
    if (kind === 'revision') value.result.ranked[0].policy_intent_read_trace.intent_version++;
    return verificationProfile();
  });
  // Restoring a name after observed invalidation cannot refill this session's gap.
  value.libraries[0].name = 'Owned destination 0';
  expect(await sections(value.session)).toEqual({ policySignals: {}, libraryProfile: null });
});

test('immutable observation prefixes cannot change during asynchronous prompt assembly', async () => {
  const value = await verificationAdviceFixture(), stats = verificationProfile();
  await value.session.readProfile(async () => stats);
  const calls = [];
  const result = await value.session.buildPrompt({}, async context => {
    calls.push(context); stats.genreDistribution[0].genre = 'later mutation';
    await Promise.resolve(); return context;
  });
  expect(calls).toHaveLength(1);
  expect(result.libraryProfile.genreDistribution[0].genre).toBe('Owned profile observation');
});

test('mutation during awaited formatting causes exactly one omission rebuild while preserving independent context', async () => {
  const value = await verificationAdviceFixture(); await value.session.readProfile(async () => verificationProfile());
  const build = jest.fn(async context => { value.libraries[0].is_active = false; await Promise.resolve(); return context; });
  const result = await value.session.buildPrompt({ signalContext: value.context, verificationContract: { sentinel: true } }, build);
  expect(build).toHaveBeenCalledTimes(2);
  expect(result).toMatchObject({ policySignals: {}, libraryProfile: null, verificationContract: { sentinel: true } });
  expect(result.signalContext).toBe(value.context);
  expect((await sections(value.session)).policySignals).toEqual({});
});

test.each(['missing coverage', 'denominator', 'count', 'percentage', 'label', 'proxy', 'accessor', 'array accessor', 'toJSON'])(
  '%s profile is omitted without invoking hooks or losing proven advice', async kind => {
    const value = await verificationAdviceFixture(), trap = jest.fn(() => { throw new Error('must not run'); });
    let stats = verificationProfile();
    if (kind === 'missing coverage') delete stats.observation;
    if (kind === 'denominator') stats.observation.traits.rating.unknownCount++;
    if (kind === 'count') stats.totalItems = Number.MAX_SAFE_INTEGER + 1;
    if (kind === 'percentage') stats.genreDistribution[0].percentage = NaN;
    if (kind === 'label') stats.genreDistribution[0].genre = 'x'.repeat(161);
    if (kind === 'proxy') stats.observation = new Proxy(stats.observation, { get: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap });
    if (kind === 'accessor') Object.defineProperty(stats, 'totalItems', { get: trap });
    if (kind === 'array accessor') Object.defineProperty(stats.genreDistribution, '0', { get: trap });
    if (kind === 'toJSON') { stats.totalItems = -1; stats.toJSON = trap; }
    await value.session.readProfile(async () => stats);
    const result = await sections(value.session);
    expect(result.libraryProfile).toBeNull(); expect(result.policySignals.confidence).toBe(70); expect(trap).not.toHaveBeenCalled();
  });

test('direct root proxy projection rejects without traps (separate from native Promise assimilation)', () => {
  const trap = jest.fn(() => { throw new Error('must not run'); });
  expect(projectVerificationProfile(new Proxy(verificationProfile(), { get: trap, getOwnPropertyDescriptor: trap, getPrototypeOf: trap }))).toBeNull();
  expect(trap).not.toHaveBeenCalled();
});

test('display limits retain only existing 5/5/3 prefixes; unused rows and fields are not inspected', () => {
  const stats = verificationProfile(), trap = jest.fn(() => { throw new Error('unused'); });
  for (const [key, field, limit] of [['certificationDistribution', 'certification', 5], ['genreDistribution', 'genre', 5], ['studioDistribution', 'studio', 3]]) {
    stats[key] = Array.from({ length: limit }, () => ({ [field]: 'x'.repeat(160), percentage: 100 }));
    Object.defineProperty(stats[key], String(limit), { get: trap });
  }
  Object.defineProperty(stats, 'languageDistribution', { get: trap }); stats.toJSON = trap;
  const result = projectVerificationProfile(stats);
  expect(result.certificationDistribution).toHaveLength(5); expect(result.genreDistribution).toHaveLength(5); expect(result.studioDistribution).toHaveLength(3);
  expect(result.genreDistribution[0].genre).toHaveLength(160); expect(trap).not.toHaveBeenCalled();
});

test.each(['', ' ', 'x'.repeat(161), 'line\nchange', 123])('invalid destination label %p supplies no new advice', async label => {
  const value = await verificationAdviceFixture(); value.libraries[0].name = label;
  expect(holdPolicyVerificationAdvice(value.args)).toBeNull();
});

test('exact encoded data limit retains complete projections or omits a whole section', () => {
  const advice = projectVerificationAdvice({ name: 'x'.repeat(160) }, 73), base = { policySignals: advice, libraryProfile: { sentinel: '' } };
  const room = VERIFICATION_ADVICE_BYTES - Buffer.byteLength(JSON.stringify(base), 'utf8');
  const exact = { sentinel: 'x'.repeat(room) };
  expect(boundVerificationAdvice(advice, exact).libraryProfile).toBe(exact);
  expect(boundVerificationAdvice(advice, { sentinel: 'x'.repeat(room + 1) })).toEqual({ policySignals: advice, libraryProfile: null });
  expect(boundVerificationAdvice({ text: 'x'.repeat(VERIFICATION_ADVICE_BYTES) }, null)).toEqual({ policySignals: {}, libraryProfile: null });
});

test.each([64, 65])('existing live producer limit remains authoritative at %i candidates', async count => {
  const value = await verificationAdviceFixture({ count });
  expect((await sections(value.session)).policySignals.confidence).toBe(count === 64 ? 70 : undefined);
});
