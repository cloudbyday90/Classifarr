/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */


const {
  getSystemContext,
  getRequestContext,
  extractError,
} = await import('../../utils/logging/requestContext.mjs');

// ---------------------------------------------------------------------------
// getSystemContext
// ---------------------------------------------------------------------------

describe('getSystemContext', () => {
  test('returns required top-level fields', () => {
    const ctx = getSystemContext();
    expect(ctx).toHaveProperty('nodeVersion');
    expect(ctx).toHaveProperty('platform');
    expect(ctx).toHaveProperty('arch');
    expect(ctx).toHaveProperty('uptime');
    expect(ctx).toHaveProperty('memory');
    expect(ctx).toHaveProperty('hostname');
  });

  test('memory contains total, free, used', () => {
    const { memory } = getSystemContext();
    expect(memory).toHaveProperty('total');
    expect(memory).toHaveProperty('free');
    expect(memory).toHaveProperty('used');
  });

  test('nodeVersion matches process.version', () => {
    expect(getSystemContext().nodeVersion).toBe(process.version);
  });
});

// ---------------------------------------------------------------------------
// getRequestContext
// ---------------------------------------------------------------------------

describe('getRequestContext', () => {
  test('returns null when req is null', () => {
    expect(getRequestContext(null)).toBe(null);
  });

  test('returns null when req is undefined', () => {
    expect(getRequestContext(undefined)).toBe(null);
  });

  test('extracts method, url, path from req', () => {
    const req = {
      method: 'GET',
      url: '/api/test',
      path: '/api/test',
      params: {},
      query: {},
      get: () => null,
      ip: '127.0.0.1',
    };
    const ctx = getRequestContext(req);
    expect(ctx.method).toBe('GET');
    expect(ctx.url).toBe('/api/test');
    expect(ctx.ip).toBe('127.0.0.1');
  });

  test('redacts sensitive query/header values', () => {
    const req = {
      method: 'POST',
      url: '/auth',
      path: '/auth',
      params: {},
      query: { token: 'secret' },
      get: (h) => h === 'authorization' ? 'Bearer tok' : null,
      ip: '10.0.0.1',
    };
    const ctx = getRequestContext(req);
    expect(ctx.query.token).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// extractError
// ---------------------------------------------------------------------------

describe('extractError', () => {
  test('returns error from options.error', () => {
    const err = new Error('boom');
    expect(extractError({}, { error: err })).toBe(err);
  });

  test('returns error from data.error', () => {
    const err = new Error('data err');
    expect(extractError({ error: err })).toBe(err);
  });

  test('returns error from data.err', () => {
    const err = new Error('data err');
    expect(extractError({ err })).toBe(err);
  });

  test('returns error from data.exception', () => {
    const err = new Error('exception');
    expect(extractError({ exception: err })).toBe(err);
  });

  test('returns error from data.cause', () => {
    const err = new Error('cause');
    expect(extractError({ cause: err })).toBe(err);
  });

  test('re-hydrates a plain object with .stack into an Error', () => {
    const plain = { message: 'Serialised', name: 'TypeError', stack: 'TypeError: Serialised\n at foo' };
    const result = extractError({ error: plain });
    expect(result).toBeInstanceOf(Error);
    expect(result.stack).toBe(plain.stack);
    expect(result.message).toBe('Serialised');
  });

  test('returns null when data has no error fields', () => {
    expect(extractError({ foo: 'bar' })).toBe(null);
  });

  test('returns null when data is null', () => {
    expect(extractError(null)).toBe(null);
  });

  test('returns null when data is a primitive', () => {
    expect(extractError('string')).toBe(null);
  });
});
