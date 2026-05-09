/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */


// ---------------------------------------------------------------------------
// sanitize.mjs
// ---------------------------------------------------------------------------

import { sanitizeData, safeStringify } from '../../utils/logging/sanitize.mjs';

describe('sanitizeData', () => {
  test('redacts exact sensitive field names', () => {
    const result = sanitizeData({ password: 'secret', username: 'alice' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.username).toBe('alice');
  });

  test('redacts all SENSITIVE_FIELD_PATHS entries', () => {
    const data = {
      token: 'tok',
      api_key: 'key',
      apikey: 'k',
      'api-key': 'k2',
      secret: 's',
      authorization: 'a',
      auth: 'au',
      jwt: 'j',
      session: 'sess',
      cookie: 'c',
      access_token: 'at',
      refresh_token: 'rt',
      private_key: 'pk',
    };
    const result = sanitizeData(data);
    for (const key of Object.keys(data)) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });

  test('redacts fields whose lower-cased name contains a sensitive keyword', () => {
    const result = sanitizeData({ user_token: 'tok', bearerToken: 'b', MY_PASSWORD: 'p' });
    expect(result.user_token).toBe('[REDACTED]');
    expect(result.bearerToken).toBe('[REDACTED]');
    expect(result.MY_PASSWORD).toBe('[REDACTED]');
  });

  test('handles nested objects recursively', () => {
    const result = sanitizeData({ user: { name: 'bob', token: 'secret' } });
    expect(result.user.name).toBe('bob');
    expect(result.user.token).toBe('[REDACTED]');
  });

  test('handles arrays by traversing elements', () => {
    const result = sanitizeData([{ password: 'p' }, { name: 'alice' }]);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].password).toBe('[REDACTED]');
    expect(result[1].name).toBe('alice');
  });

  test('returns primitives unchanged', () => {
    expect(sanitizeData(null)).toBe(null);
    expect(sanitizeData(undefined)).toBe(undefined);
    expect(sanitizeData('string')).toBe('string');
    expect(sanitizeData(123)).toBe(123);
    expect(sanitizeData(true)).toBe(true);
  });

  test('does not mutate the original object', () => {
    const original = { password: 'pw', name: 'alice' };
    sanitizeData(original);
    expect(original.password).toBe('pw');
  });
});

describe('safeStringify', () => {
  test('serialises normal values', () => {
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
  });

  test('falls back to String() for circular references', () => {
    const obj = {};
    obj.self = obj;
    const result = safeStringify(obj);
    expect(typeof result).toBe('string');
    expect(result).not.toBeUndefined();
  });
});
