import {
  POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER,
  PolicyNativeIntentCreateIdempotencyError,
  buildNativePolicyCreateAdvisoryLockKey,
  formatNativePolicyCreateIdempotencyKey,
  readNativePolicyCreateIdempotencyKey,
} from '../../services/policyNativeIntentCreateIdempotency.mjs';

const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

describe('policyNativeIntentCreateIdempotency', () => {
  test('accepts the structured-header form and keeps the durable key unquoted', () => {
    expect(readNativePolicyCreateIdempotencyKey({
      [POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER]: `"${IDEMPOTENCY_KEY}"`,
    })).toBe(IDEMPOTENCY_KEY);
    expect(formatNativePolicyCreateIdempotencyKey(IDEMPOTENCY_KEY))
      .toBe(`"${IDEMPOTENCY_KEY}"`);
  });

  test('rejects missing, ambiguous, and invalid key values without reflecting them', () => {
    expect(() => readNativePolicyCreateIdempotencyKey({}))
      .toThrow(PolicyNativeIntentCreateIdempotencyError);
    expect(() => readNativePolicyCreateIdempotencyKey({
      [POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER]: ['first', 'second'],
    })).toThrow(PolicyNativeIntentCreateIdempotencyError);
    expect(() => readNativePolicyCreateIdempotencyKey({
      [POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER]: 'not-valid',
    })).toThrow(PolicyNativeIntentCreateIdempotencyError);
  });

  test('builds a stable transaction advisory lock key from a valid idempotency key', () => {
    const first = buildNativePolicyCreateAdvisoryLockKey(IDEMPOTENCY_KEY);
    const second = buildNativePolicyCreateAdvisoryLockKey(IDEMPOTENCY_KEY);

    expect(first).toBe(second);
    expect(first).toMatch(/^-?\d+$/u);
    expect(first).not.toBe(buildNativePolicyCreateAdvisoryLockKey(
      '11111111-1111-4111-8111-111111111111'
    ));
  });
});
