/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */


import {
  getSystemContext,
  getRequestContext,
  extractError,
} from '../../utils/logging/requestContext.mjs';
import { runInNewContext } from 'node:vm';
import { jest } from '@jest/globals';

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
  test('removes query values from every request-context representation without changing the request', () => {
    const req = {
      method: 'POST', url: '/webhook/request?key=synthetic_secret',
      path: '/webhook/request', params: {},
      query: { key: 'synthetic_secret', 'key[]': ['synthetic_secret'], filter: 'movie', redirect: 'https://example.test/?key=synthetic_secret' },
      get: () => null,
    };
    const before = JSON.stringify(req);
    const context = getRequestContext(req);
    expect(context.url).toBe('/webhook/request');
    expect(context.query).toEqual({ key: '[REDACTED]', 'key[]': '[REDACTED]', filter: '[REDACTED]', redirect: '[REDACTED]' });
    expect(JSON.stringify(context)).not.toContain('synthetic_secret');
    expect(JSON.stringify(req)).toBe(before);
  });

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
  test('uses own data references only, with lazy native-error priority', () => {
    const hook = jest.fn(() => { throw Error('PRIVATE selector'); });
    const selected = new Error('selected'), data = { err: selected };
    Object.defineProperty(data, 'error', { get: hook });
    Object.defineProperty(data, 'exception', { get: hook });
    const options = Object.defineProperty({}, 'error', { get: hook });
    expect(extractError(data, options)).toBe(selected);
    expect(extractError(Object.create({ error: selected }))).toBeNull();
    expect(extractError({}, Object.create({ error: selected }))).toBeNull();
    expect(hook).not.toHaveBeenCalled();
  });

  test('rejects proxy references and source containers without invoking traps', () => {
    const hook = jest.fn(() => { throw Error('PRIVATE proxy'); });
    const proxy = new Proxy(new Error(), { get: hook, getPrototypeOf: hook, getOwnPropertyDescriptor: hook });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const selected = new Error();
    expect(extractError({ error: proxy, err: selected })).toBe(selected);
    expect(extractError({ error: revoked.proxy })).toBeNull();
    expect(extractError(revoked.proxy, revoked.proxy)).toBeNull();
    expect(extractError(proxy, proxy)).toBeNull();
    expect(hook).not.toHaveBeenCalled();
  });

  test('recognizes cross-realm native errors and preserves option/reference priority', () => {
    const original = runInNewContext('new Error("original")');
    expect(original instanceof Error).toBe(false);
    expect(extractError({ error: original })).toBe(original);
    const priority = new Error();
    expect(extractError({ error: original }, { error: priority })).toBe(priority);
    expect(extractError({ error: original, err: priority })).toBe(original);
    const array = []; array.error = priority;
    expect(extractError(array)).toBeNull();
    expect(extractError(array, { error: priority })).toBe(priority);
  });

  test('hydrates only own string fields without invoking plain error accessors', () => {
    const hook = jest.fn(() => { throw Error('PRIVATE getter'); });
    const maybe = { stack: 'Original stack' };
    Object.defineProperties(maybe, { message: { get: hook }, name: { get: hook } });
    const result = extractError({ error: maybe });
    expect(result.message).toBe('Upstream error');
    expect(result.stack).toBe('Original stack');
    expect(extractError({ error: Object.create({ stack: 'Inherited' }) })).toBeNull();
    expect(extractError({ error: Object.defineProperty({}, 'stack', { get: hook }) })).toBeNull();
    expect(hook).not.toHaveBeenCalled();
  });

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
