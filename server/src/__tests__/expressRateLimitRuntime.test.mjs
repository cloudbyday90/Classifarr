/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { jest } from '@jest/globals';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import {
  loginLimiterConfig,
  passwordChangeLimiterConfig,
  refreshLimiterConfig,
} from '../config/rateLimits.mjs';

const run = promisify(execFile);
const probe = fileURLToPath(new URL('./fixtures/rateLimitDebugProbe.mjs', import.meta.url));

describe('installed HTTP rate-limit contract', () => {
  test.each([
    ['login', loginLimiterConfig, 5, 900],
    ['token refresh', refreshLimiterConfig, 30, 900],
    ['password change', passwordChangeLimiterConfig, 3, 3600],
  ])('%s preserves its production quota, body and retry headers', async (_name, config, quota, windowSeconds) => {
    const app = express();
    const reached = jest.fn((_req, res) => res.sendStatus(204));
    app.post('/', rateLimit(config), reached);
    for (let index = 0; index < quota; index += 1) {
      const accepted = await request(app).post('/').expect(204);
      expect(accepted.headers['ratelimit-limit']).toBe(String(quota));
      expect(accepted.headers['ratelimit-remaining']).toBe(String(quota - index - 1));
      expect(accepted.headers['retry-after']).toBeUndefined();
    }
    const rejected = await request(app).post('/').expect(429);
    expect(rejected.body).toEqual(config.message);
    expect(rejected.headers['ratelimit-policy']).toBe(`${quota};w=${windowSeconds}`);
    expect(rejected.headers['ratelimit-remaining']).toBe('0');
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(rejected.headers['retry-after'])).toBeLessThanOrEqual(windowSeconds);
    expect(rejected.headers['x-ratelimit-limit']).toBeUndefined();
    expect(reached).toHaveBeenCalledTimes(quota);
  });

  test('untrusted forwarded headers cannot create fresh quotas and still produce a diagnostic', async () => {
    const app = express();
    const logger = { error: jest.fn(), warn: jest.fn() };
    app.get('/', rateLimit({ windowMs: 60_000, limit: 1, logger }), (_req, res) => res.sendStatus(204));
    await request(app).get('/').set('X-Forwarded-For', '203.0.113.1').expect(204);
    await request(app).get('/').set('X-Forwarded-For', '203.0.113.2').expect(429);
    expect(app.get('trust proxy')).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR' }));
  });

  test('a failed store does not admit a protected request', async () => {
    const failure = new Error('synthetic store failure');
    const app = express();
    const reached = jest.fn((_req, res) => res.sendStatus(204));
    const errors = jest.fn((error, _req, res, _next) => res.sendStatus(error === failure ? 503 : 500));
    app.get('/', rateLimit({
      store: { increment: async () => { throw failure; }, decrement: async () => {}, resetKey: async () => {} },
    }), reached);
    app.use(errors);
    await request(app).get('/').expect(503);
    expect(reached).not.toHaveBeenCalled();
    expect(errors.mock.calls[0][0]).toBe(failure);
  });

  test.each([
    ['', 0],
    ['express-rate-limit', 2],
  ])('DEBUG=%j enumerates request info only when enabled', async (debug, expectedEnumerations) => {
    const { stdout, stderr } = await run(process.execPath, [probe], {
      env: { ...process.env, DEBUG: debug, DEBUG_COLORS: '0', NODE_OPTIONS: '' },
      timeout: 8_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    expect(JSON.parse(stdout)).toEqual({ requests: 2, enumerated: expectedEnumerations });
    if (debug) expect(stderr).toContain('set request.rateLimit.used to be');
    else expect(stderr).not.toContain('express-rate-limit');
  });
});
