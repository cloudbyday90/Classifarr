/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildClassificationDependencyKey, createProviderDeferredError, hasProviderConfigurationRevision,
  isProviderDeferredError, PROVIDER_DEFERRAL_REASON } from '../../services/classificationProviderDeferralPolicy.mjs';
import { buildPendingRetryResult, isAiTransientAvailabilityError } from '../../services/classificationAiFailureUtils.mjs';
import { getAutomaticRecoveryFailureCode } from '../../services/automaticClassificationRecoveryPolicy.mjs';

const snapshot = { config: { configuration_revision: 1 } };
const provider = { type: 'custom', config: { model: 'model', api_endpoint: 'https://example.invalid/api', api_key: 'private' } };
test.each([0, 1, '123', '9223372036854775807'])('accepts persisted revision %s', revision => {
  expect(hasProviderConfigurationRevision({ configuration_revision: revision })).toBe(true);
});
test.each([undefined, null, -1, 1.5, '', '01', '1e3', {}, true])('rejects invalid revision %#', revision => {
  expect(hasProviderConfigurationRevision({ configuration_revision: revision })).toBe(false);
});
test('separates provider/model/configuration/legacy endpoints without persisting credentials', () => {
  const key = buildClassificationDependencyKey(snapshot, provider);
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(buildClassificationDependencyKey(snapshot, { ...provider, config: { ...provider.config, api_key: 'different' } })).toBe(key);
  expect(buildClassificationDependencyKey({ config: { configuration_revision: 2 } }, provider)).not.toBe(key);
  expect(buildClassificationDependencyKey(snapshot, { ...provider, type: 'other' })).not.toBe(key);
  expect(buildClassificationDependencyKey(snapshot, { ...provider, config: { ...provider.config, model: 'other' } })).not.toBe(key);
  const local = { type: 'ollama', config: { host: 'local', port: 11434, model: 'model' } };
  expect(buildClassificationDependencyKey(snapshot, local)).not.toBe(buildClassificationDependencyKey({ ...snapshot,
    local: { id: 1, host: 'legacy', port: 1234 } }, local));
});
test.each([[{}, provider], [snapshot, null], [snapshot, { type: 'custom', config: {} }]])('missing provenance does not share a circuit %#', (snap, selected) => {
  expect(buildClassificationDependencyKey(snap, selected)).toBeNull();
});
test.each([0, 1, 2, null, undefined])('waiting preserves the item retry count (%s)', previousRetryCount => {
  const error = createProviderDeferredError();
  const result = buildPendingRetryResult({ transientError: error, previousRetryCount, maxRetries: 3 });
  expect(isAiTransientAvailabilityError(error)).toBe(true);
  expect(result).toMatchObject({ reason: PROVIDER_DEFERRAL_REASON, retry_count: previousRetryCount ?? 0,
    retry_reason_code: 'ai_provider_deferred', retry_failure_code: 'ai_provider_deferred', needs_retry: true });
  expect(getAutomaticRecoveryFailureCode(result)).toBe('ai_provider_deferred');
});
test('only branded internal deferrals preserve retries, not an arbitrary error code or metadata flag', () => {
  const forged = Object.assign(new Error('arbitrary'), { code: 'CLASSIFICATION_PROVIDER_DEFERRED' });
  expect(isProviderDeferredError(forged)).toBe(false);
  expect(isProviderDeferredError(null)).toBe(false);
  expect(isProviderDeferredError('value')).toBe(false);
  expect(buildPendingRetryResult({ transientError: forged, previousRetryCount: 1 }).retry_count).toBe(2);
});
