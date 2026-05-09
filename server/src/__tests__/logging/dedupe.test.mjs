/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  logDedupeCache,
  dedupeWriteCount as _dedupeWriteCount,
  resetDedupeState,
  buildDedupeFingerprint,
  pruneDedupeCache,
  shouldThrottle,
} from '../../utils/logging/dedupe.mjs';

beforeEach(() => {
  resetDedupeState();
});

// ---------------------------------------------------------------------------
// buildDedupeFingerprint
// ---------------------------------------------------------------------------

describe('buildDedupeFingerprint', () => {
  test('returns null when no dedupeKey in options', () => {
    expect(buildDedupeFingerprint('Mod', 'WARN', 'msg', {})).toBe(null);
  });

  test('returns null when dedupeKey is empty string', () => {
    expect(buildDedupeFingerprint('Mod', 'WARN', 'msg', { dedupeKey: '   ' })).toBe(null);
  });

  test('returns pipe-delimited fingerprint', () => {
    const fp = buildDedupeFingerprint('MyMod', 'WARN', 'Some message', { dedupeKey: 'k1' });
    expect(fp).toBe('MyMod|WARN|k1|Some message');
  });
});

// ---------------------------------------------------------------------------
// shouldThrottle
// ---------------------------------------------------------------------------

describe('shouldThrottle', () => {
  test('returns false on first call (no dedupeKey — never throttled)', () => {
    expect(shouldThrottle('M', 'WARN', 'msg')).toBe(false);
  });

  test('returns false on first call with dedupeKey', () => {
    expect(shouldThrottle('M', 'WARN', 'msg', { dedupeKey: 'k' })).toBe(false);
  });

  test('returns true on second call within default window', () => {
    shouldThrottle('M', 'WARN', 'msg', { dedupeKey: 'k' });
    expect(shouldThrottle('M', 'WARN', 'msg', { dedupeKey: 'k' })).toBe(true);
  });

  test('returns false after dedupeWindowMs has elapsed', () => {
    const opts = { dedupeKey: 'k2', dedupeWindowMs: 100 };
    shouldThrottle('M', 'WARN', 'msg', opts);

    // Manually backdate the cache entry to simulate window expiry
    const fp = buildDedupeFingerprint('M', 'WARN', 'msg', opts);
    logDedupeCache.set(fp, Date.now() - 200);

    expect(shouldThrottle('M', 'WARN', 'msg', opts)).toBe(false);
  });

  test('different modules with same key are not throttled by each other', () => {
    shouldThrottle('ModA', 'WARN', 'msg', { dedupeKey: 'k' });
    expect(shouldThrottle('ModB', 'WARN', 'msg', { dedupeKey: 'k' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pruneDedupeCache
// ---------------------------------------------------------------------------

describe('pruneDedupeCache', () => {
  test('removes entries older than maxAge', () => {
    logDedupeCache.set('old', Date.now() - 999_999);
    logDedupeCache.set('recent', Date.now());

    pruneDedupeCache(Date.now(), 60_000);

    expect(logDedupeCache.has('old')).toBe(false);
    expect(logDedupeCache.has('recent')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetDedupeState
// ---------------------------------------------------------------------------

describe('resetDedupeState', () => {
  test('clears cache and resets counter', () => {
    logDedupeCache.set('fp', Date.now());
    shouldThrottle('M', 'W', 'm', { dedupeKey: 'x' });
    resetDedupeState();
    expect(logDedupeCache.size).toBe(0);
  });
});
