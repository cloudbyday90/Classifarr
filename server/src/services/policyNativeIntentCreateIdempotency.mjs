/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

export const POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER = 'Idempotency-Key';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{31,127}$/u;

export class PolicyNativeIntentCreateIdempotencyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PolicyNativeIntentCreateIdempotencyError';
    this.code = code;
  }
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value) || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('"') || trimmed.endsWith('"')) {
    const match = /^"([A-Za-z0-9][A-Za-z0-9_-]{31,127})"$/u.exec(trimmed);
    return match?.[1] ?? null;
  }

  return IDEMPOTENCY_KEY_PATTERN.test(trimmed) ? trimmed : null;
}

export function readNativePolicyCreateIdempotencyKey(headers = {}) {
  const rawHeader = headers?.[POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER]
    ?? headers?.[POLICY_NATIVE_CREATE_IDEMPOTENCY_HEADER.toLowerCase()]
    ?? null;

  if (rawHeader === null || rawHeader === undefined || rawHeader === '') {
    throw new PolicyNativeIntentCreateIdempotencyError(
      'Native policy creation requires an Idempotency-Key header.',
      'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_REQUIRED'
    );
  }

  const idempotencyKey = normalizeHeaderValue(rawHeader);
  if (!idempotencyKey) {
    throw new PolicyNativeIntentCreateIdempotencyError(
      'Native policy creation requires a valid Idempotency-Key header.',
      'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_INVALID'
    );
  }

  return idempotencyKey;
}

export function formatNativePolicyCreateIdempotencyKey(idempotencyKey) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey || ''))) {
    throw new TypeError('Cannot format an invalid native policy create idempotency key.');
  }

  return `"${idempotencyKey}"`;
}

export function buildNativePolicyCreateAdvisoryLockKey(idempotencyKey) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey || ''))) {
    throw new TypeError('Cannot create an advisory lock key from an invalid idempotency key.');
  }

  return createHash('sha256')
    .update(`policy-native-create:${idempotencyKey}`, 'utf8')
    .digest()
    .readBigInt64BE(0)
    .toString();
}
