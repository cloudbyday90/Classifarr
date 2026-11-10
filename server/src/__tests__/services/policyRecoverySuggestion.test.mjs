/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { policyRecoveryReferenceFixture, recoveryPolicies } from '../fixtures/policyRecoveryReferenceFixture.mjs';
import { holdPolicyRecoverySuggestion, readPolicyRecoverySuggestion } from '../../services/policyRecoverySuggestionReader.mjs';
import { createLivePolicyRecoveryReference } from '../../services/policyRecoverySuggestionLiveReference.mjs';
import { boundedRecoveryReference, recoveryField, recoveryDecisionSnapshot, recoveryPolicyHeader, recoveryLibraryPool,
  POLICY_RECOVERY_REFERENCE_LIMITS } from '../../services/policyRecoverySuggestionContract.mjs';
import { buildAiUnavailableResult } from '../../services/classificationPathServiceShared.mjs';
import { policyEngine } from '../../services/policyEngine.mjs';
import { buildSignalContext } from '../../services/policyScoringContextBuilder.mjs';

const read = fixture => readPolicyRecoverySuggestion(fixture.token, fixture.args);
afterEach(() => { jest.restoreAllMocks(); });

test.each(['native_intent', 'compatibility_bridge'])('genuine %s advice retains its loaded source without requiring declared contribution', async source => {
  const fixture = await policyRecoveryReferenceFixture({ source, configure: policy => {
    if (source === 'native_intent') policy.preset_weight = 0;
  } });
  expect(() => recoveryPolicyHeader(fixture.policies[0], fixture.item.media_type)).not.toThrow();
  expect(() => recoveryDecisionSnapshot(fixture.result)).not.toThrow();
  expect(read(fixture)).toBe(fixture.libraries[0]);
  expect(Object.getOwnPropertySymbols(fixture.result)).toEqual([]);
  expect(Object.keys(fixture.context)).not.toContain('recoveryReference');
});

test('the production wrapper mints the final diagnostic-retained object through actual evaluation and ranking', async () => {
  const policies = recoveryPolicies(), item = { tmdb_id: 42, media_type: 'movie', genres: ['Animation'] };
  jest.spyOn(policyEngine, 'checkAuthoritativeSignals').mockResolvedValue(null);
  jest.spyOn(policyEngine, 'getActivePolicies').mockResolvedValue(policies);
  jest.spyOn(policyEngine, 'scoreProfileWithDiagnostics').mockResolvedValue({ score: 70, diagnostics: null });
  const result = await policyEngine.evaluateItem(item), libraries = [{ id: 101, media_type: 'movie', is_active: true }];
  // Diagnostic capture loss does not remove this independently minted authority.
  for (const symbol of Object.getOwnPropertySymbols(result)) delete result[symbol];
  const args = { metadata: item, policyResult: result, libraries, signalContext: buildSignalContext(result, libraries, result.ranked) };
  expect(readPolicyRecoverySuggestion(holdPolicyRecoverySuggestion(args), args)).toBe(libraries[0]);
  expect(JSON.stringify(result)).not.toContain('recoveryReference');
});

test('private collection leaves the complete serialized evaluation unchanged', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(123456);
  const live = await policyRecoveryReferenceFixture(), offline = await policyRecoveryReferenceFixture({ live: false });
  expect(JSON.stringify(live.result)).toBe(JSON.stringify(offline.result));
  expect(JSON.stringify(live.context)).toBe(JSON.stringify(offline.context));
  expect(read(live)?.id).toBe(101); expect(read(offline)).toBeNull();
});

test('offline evaluation, copied results, contexts, handles and item objects never acquire live proof', async () => {
  const fixture = await policyRecoveryReferenceFixture();
  expect(read(await policyRecoveryReferenceFixture({ live: false }))).toBeNull();
  for (const result of [{ ...fixture.result }, JSON.parse(JSON.stringify(fixture.result))]) {
    expect(holdPolicyRecoverySuggestion({ ...fixture.args, policyResult: result })).toBeNull();
    expect(readPolicyRecoverySuggestion(fixture.token, { ...fixture.args, policyResult: result })).toBeNull();
  }
  expect(readPolicyRecoverySuggestion({}, fixture.args)).toBeNull();
  expect(readPolicyRecoverySuggestion(structuredClone(fixture.token), fixture.args)).toBeNull();
  expect(readPolicyRecoverySuggestion(fixture.token, { ...fixture.args, metadata: { ...fixture.item } })).toBeNull();
  expect(readPolicyRecoverySuggestion(fixture.token, { ...fixture.args, signalContext: { ...fixture.context } })).toBeNull();
});

test.each(['item id', 'item type', 'context confidence', 'confidence', 'ranking', 'top candidate', 'action', 'threshold',
  'origin', 'revision', 'destination', 'context ranking', 'inactive', 'scope', 'missing', 'duplicate', 'replacement'])(
  '%s change after hold cannot supply recovery advice', async kind => {
    const fixture = await policyRecoveryReferenceFixture(), { item, context, result, libraries } = fixture;
    if (kind === 'item id') item.tmdb_id++;
    if (kind === 'item type') item.media_type = 'tv';
    if (kind === 'context confidence') context.confidence--;
    if (kind === 'confidence') result.confidence--;
    if (kind === 'ranking') result.ranked[0].score--;
    if (kind === 'top candidate') result.topCandidate.policy_id++;
    if (kind === 'action') result.action = 'manual';
    if (kind === 'threshold') result.thresholds.prompt--;
    if (kind === 'origin') result.ranked[0].policy_intent_read_trace.source = 'unknown';
    if (kind === 'revision') result.ranked[0].policy_intent_read_trace.intent_version++;
    if (kind === 'destination') context.suggestedLibrary = { ...libraries[0] };
    if (kind === 'context ranking') context.ranked = [...result.ranked];
    if (kind === 'inactive') libraries[0].is_active = false;
    if (kind === 'scope') libraries[0].media_type = 'tv';
    if (kind === 'missing') libraries.length = 0;
    if (kind === 'duplicate') libraries.push({ ...libraries[0] });
    if (kind === 'replacement') libraries[0] = { ...libraries[0] };
    expect(read(fixture)).toBeNull();
  });

test.each(['unknown origin', 'invalid native', 'revision', 'disabled', 'scope', 'duplicate pair', 'evaluation pair', 'evaluation trace'])(
  '%s cannot be minted from structurally similar producer inputs', async kind => {
    const fixture = await policyRecoveryReferenceFixture({ count: kind === 'duplicate pair' ? 2 : 1,
      configure: (policy, index, all) => {
        if (kind === 'unknown origin') policy.policy_runtime_authority.sourceId = 'unknown';
        if (kind === 'invalid native') policy.policy_runtime_authority.validationOk = false;
        if (kind === 'revision') delete policy.native_intent_version;
        if (kind === 'disabled') policy.enabled = false;
        if (kind === 'scope') policy.library_media_type = 'tv';
        if (kind === 'duplicate pair' && index === 1) Object.assign(policy, structuredClone(all[0]));
      }, afterEvaluate: row => {
        if (kind === 'evaluation pair') row.library_id++;
        if (kind === 'evaluation trace') row.policy_intent_read_trace = { ...row.policy_intent_read_trace, intent_version: 99 };
      } });
    expect(read(fixture)).toBeNull();
  });

test.each(['item', 'revision', 'enabled', 'source'])( '%s mutation during evaluation invalidates the loaded header', async kind => {
  const fixture = await policyRecoveryReferenceFixture({ beforeEvaluate: (policy, item) => {
    if (kind === 'item') item.tmdb_id++;
    if (kind === 'revision') policy.native_intent_version++;
    if (kind === 'enabled') policy.enabled = false;
    if (kind === 'source') policy.policy_runtime_authority.statusId = 'native_intent_invalid';
  } });
  expect(read(fixture)).toBeNull();
});

test('same-ID items in simultaneous requests cannot exchange handles', async () => {
  const [left, right] = await Promise.all([policyRecoveryReferenceFixture(), policyRecoveryReferenceFixture()]);
  expect(readPolicyRecoverySuggestion(left.token, right.args)).toBeNull();
  expect(read(left)).toBe(left.libraries[0]); expect(read(right)).toBe(right.libraries[0]);
});

test('renaming and reordering libraries does not alter identity or reference meaning', async () => {
  const fixture = await policyRecoveryReferenceFixture({ count: 2 });
  fixture.libraries.forEach(library => { library.name = 'Any category'; }); fixture.libraries.reverse();
  fixture.result.ranked[0].library_name = 'Renamed policy label';
  expect(read(fixture)?.id).toBe(101);
});

test('different policies may target the same library without inventing unique ranking authority', async () => {
  const fixture = await policyRecoveryReferenceFixture({ count: 2, configure: policy => { policy.library_id = 101; policy.policy_intent_contract.library_id = 101; } });
  fixture.libraries.pop();
  const token = holdPolicyRecoverySuggestion(fixture.args);
  expect(readPolicyRecoverySuggestion(token, fixture.args)?.id).toBe(101);
});

test.each([0, 49, 50, 70, 85])('overall confidence %s remains distinct from score and unchanged in retry selection', async confidence => {
  const fixture = await policyRecoveryReferenceFixture({ confidence }), buildRetry = jest.fn(() => ({ needs_retry: true }));
  expect(read(fixture)).toBe(fixture.libraries[0]);
  const result = buildAiUnavailableResult({ isTransientAiAvailability: false, confidence: fixture.context.confidence,
    suggestedLibrary: read(fixture), buildPendingRetryResult: buildRetry, libraries: fixture.libraries });
  if (confidence < 50) expect(result.needs_retry).toBe(true);
  else { expect(result.method).toBe('signal_calculation'); expect(result.confidence).toBe(confidence); }
  expect(buildRetry).toHaveBeenCalledTimes(confidence < 50 ? 1 : 0);
});

test('complete collections accept 64 candidates and refuse 65 without truncation', async () => {
  const exact = await policyRecoveryReferenceFixture({ count: 64 });
  expect(read(exact)?.id).toBe(101); expect(exact.result.ranked).toHaveLength(64);
  const overflow = await policyRecoveryReferenceFixture({ count: 65 });
  expect(read(overflow)).toBeNull(); expect(overflow.result.ranked).toHaveLength(65);
});

test('pool bounds and the exact encoded byte boundary are enforced independently', async () => {
  const fixture = await policyRecoveryReferenceFixture();
  fixture.libraries.push(...Array.from({ length: 63 }, (_unused, index) => ({ id: index + 1000, media_type: 'movie', is_active: true })));
  const token = holdPolicyRecoverySuggestion(fixture.args);
  expect(readPolicyRecoverySuggestion(token, fixture.args)?.id).toBe(101);
  fixture.libraries.push({ id: 2000, media_type: 'movie', is_active: true });
  expect(holdPolicyRecoverySuggestion(fixture.args)).toBeNull();
  const exact = { value: 'x'.repeat(POLICY_RECOVERY_REFERENCE_LIMITS.bytes - Buffer.byteLength('{"value":""}')) };
  expect(Buffer.byteLength(boundedRecoveryReference(exact))).toBe(16384);
  expect(boundedRecoveryReference({ value: exact.value + 'x' })).toBeNull();
});

test('a complete valid numeric snapshot that exceeds the combined byte budget is withheld without altering ranking', async () => {
  const fixture = await policyRecoveryReferenceFixture({ count: 64, configure: (policy, index) => {
    policy.id = 2147483647 - index; policy.library_id = 2147483000 - index;
    policy.native_intent_version = 2147483647;
    policy.auto_classify_threshold = 85.12345678901234; policy.prompt_threshold = 60.12345678901234;
    Object.assign(policy.policy_intent_contract, { policy_id: policy.id, library_id: policy.library_id });
    Object.assign(policy.policy_intent_read_trace, { policy_id: policy.id, intent_version: policy.native_intent_version });
  }, afterEvaluate: row => { row.score = 0.0000010000000000000002; } });
  const snapshot = { identity: 'movie:42', headers: fixture.policies.map(policy => recoveryPolicyHeader(policy, 'movie')),
    decision: recoveryDecisionSnapshot(fixture.result), pool: recoveryLibraryPool(fixture.libraries) };
  expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeGreaterThan(16384);
  expect(read(fixture)).toBeNull(); expect(fixture.result.ranked).toHaveLength(64);
});

test('hostile accessors and proxies cannot execute inside the new projection or fabricate advice', async () => {
  const fixture = await policyRecoveryReferenceFixture(), getter = jest.fn(() => { throw new Error('PRIVATE'); });
  Object.defineProperty(fixture.context, 'suggestedLibrary', { get: getter });
  expect(read(fixture)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  const trap = jest.fn(() => { throw new Error('PRIVATE'); });
  expect(() => recoveryField(new Proxy({}, { getOwnPropertyDescriptor: trap }), 'id')).toThrow('policy_recovery_reference');
  expect(trap).not.toHaveBeenCalled();
  const collector = createLivePolicyRecoveryReference(new Proxy({}, { get: trap }));
  expect(collector.finish(fixture.result)).toBe(fixture.result); expect(trap).not.toHaveBeenCalled();
});
