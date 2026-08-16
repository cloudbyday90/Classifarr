/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildNativeIntentChangeAdvisoryLockKey,
  formatNativeIntentChangeIdempotencyKey,
  PolicyNativeIntentChangeIdempotencyError,
  readNativeIntentChangeIdempotencyKey,
} from '../../services/policyNativeIntentChangeIdempotency.mjs';

const KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

describe('policyNativeIntentChangeIdempotency', () => {
  test('reads both legal wire forms and produces a stable transaction lock key', () => {
    expect(readNativeIntentChangeIdempotencyKey({ 'idempotency-key': `"${KEY}"` })).toBe(KEY);
    expect(readNativeIntentChangeIdempotencyKey({ 'Idempotency-Key': KEY })).toBe(KEY);
    expect(formatNativeIntentChangeIdempotencyKey(KEY)).toBe(`"${KEY}"`);
    expect(buildNativeIntentChangeAdvisoryLockKey(KEY)).toBe(
      buildNativeIntentChangeAdvisoryLockKey(KEY),
    );
  });

  test('rejects missing, malformed, and repeated header values', () => {
    expect(() => readNativeIntentChangeIdempotencyKey({})).toThrow(
      PolicyNativeIntentChangeIdempotencyError,
    );
    expect(() => readNativeIntentChangeIdempotencyKey({ 'idempotency-key': 'short' })).toThrow(
      PolicyNativeIntentChangeIdempotencyError,
    );
    expect(() => readNativeIntentChangeIdempotencyKey({ 'idempotency-key': [KEY, KEY] })).toThrow(
      PolicyNativeIntentChangeIdempotencyError,
    );
  });
});
