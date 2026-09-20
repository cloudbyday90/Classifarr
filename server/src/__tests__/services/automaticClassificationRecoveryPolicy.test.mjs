/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getAutomaticRecoveryFailureCode, getAutomaticRecoveryErrorCode, isAutomaticRecoveryDue,
  AUTOMATIC_RECOVERY_FAILURE_CODES, AUTOMATIC_RECOVERY_TASK_SOURCE,
} from '../../services/automaticClassificationRecoveryPolicy.mjs';
import { getClassificationRetryEligibility } from '../../services/classificationRetryEligibility.mjs';
import { resolveRetryReason, isAiTransientAvailabilityError } from '../../services/classificationAiFailureUtils.mjs';

const exhausted = () => ({ status: 'failed', method: 'queued_for_retry', library_id: null,
  retry_after: null, retry_count: 3, max_retries: 3, retry_recovery_attempts: 0,
  retry_failure_code: 'ai_timeout', retry_exhausted_at: new Date(Date.now() - 900001) });

test.each(AUTOMATIC_RECOVERY_FAILURE_CODES)('persists only server-selected transient failure %s', (code) => {
  expect(getAutomaticRecoveryFailureCode({ needs_retry: true, method: 'queued_for_retry', retry_failure_code: code })).toBe(code);
  expect(getAutomaticRecoveryFailureCode({ needs_retry: false, method: 'queued_for_retry', retry_failure_code: code })).toBeNull();
});
test.each([undefined, null, {}, { needs_retry: true, method: 'other' },
  { needs_retry: true, method: 'queued_for_retry', retry_reason_code: 'ai_provider_not_found' }])('rejects unknown failure provenance %#', (result) => {
  expect(getAutomaticRecoveryFailureCode(result)).toBeNull();
});
test.each(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND'])('classifies structured connection error %s', (code) => {
  expect(resolveRetryReason({ code }).code).toBe('ai_connection_error');
});
test('admits eligible exhausted work only after the persisted cooldown', () => {
  expect(getClassificationRetryEligibility(exhausted(), AUTOMATIC_RECOVERY_TASK_SOURCE).eligible).toBe(true);
  expect(isAutomaticRecoveryDue({ ...exhausted(), retry_exhausted_at: new Date() })).toBe(false);
});
test.each([
  { status: 'completed' }, { method: 'ai_analysis' }, { library_id: 9 }, { retry_after: new Date() },
  { retry_recovery_attempts: 1 }, { retry_recovery_attempts: undefined }, { retry_failure_code: null },
  { retry_failure_code: 'ai_stream_aborted' }, { retry_failure_code: 'ai_provider_not_found' },
  { retry_count: 2 }, { max_retries: 0 }, { retry_exhausted_at: null },
  { retry_exhausted_at: 'invalid' }, { retry_exhausted_at: new Date(Date.now() + 999999) },
])('excludes unsafe or exhausted recovery %#', (patch) => {
  expect(getClassificationRetryEligibility({ ...exhausted(), ...patch }, AUTOMATIC_RECOVERY_TASK_SOURCE).eligible).toBe(false);
});
test('undefined rows are not due', () => expect(isAutomaticRecoveryDue()).toBe(false));
test.each([[429, 'ai_rate_limited'], [500, 'ai_server_error'], [502, 'ai_gateway_error'],
  [503, 'ai_unavailable'], [504, 'ai_gateway_error'], [401, null], [403, null], [404, null], [400, null], [501, null]])(
  'structured HTTP status %s takes precedence over incidental timeout text', (status, expected) => {
    expect(getAutomaticRecoveryErrorCode({ response: { status }, code: 'ETIMEDOUT', message: 'timed out' })).toBe(expected);
  });
test.each(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND'])('admits structured network code %s', (code) => {
  expect(getAutomaticRecoveryErrorCode({ code })).toBe('ai_connection_error');
});
test.each(['ETIMEDOUT', 'ECONNABORTED'])('admits structured timeout code %s', (code) => {
  expect(getAutomaticRecoveryErrorCode({ code })).toBe('ai_timeout');
  expect(isAiTransientAvailabilityError({ code })).toBe(true);
});
test.each([null, undefined, { message: 'ollama timed out' }, { code: 'ERR_CANCELED' }, { code: 'MODEL_NOT_FOUND' }])(
  'does not promote ambiguous text or permanent/cancelled errors %#', (error) => {
    expect(getAutomaticRecoveryErrorCode(error)).toBeNull();
  });
