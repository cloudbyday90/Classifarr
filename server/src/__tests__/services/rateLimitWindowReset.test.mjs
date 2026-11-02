/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

test.each(['skipFailedRequests', 'skipSuccessfulRequests'])(
  '%s cannot uncount a late previous-window response from the current window', async option => {
    let clock = Date.now(), entered, release;
    const started = new Promise(resolve => { entered = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
    const limiter = rateLimit({ windowMs: 60000, limit: 1, [option]: true });
    const app = express(); app.use(limiter);
    app.get('/held', async (_req, res) => { entered(); await held; res.sendStatus(option === 'skipFailedRequests' ? 500 : 200); });
    // Current-window responses must remain counted in either skip mode.
    app.get('/counted', (_req, res) => res.sendStatus(option === 'skipSuccessfulRequests' ? 500 : 200));
    let pending;
    try {
      pending = request(app).get('/held').then(response => response); await started;
      clock += 60001;
      expect((await request(app).get('/counted')).status).toBe(option === 'skipSuccessfulRequests' ? 500 : 200);
      release(); await pending;
      expect((await request(app).get('/counted')).status).toBe(429);
    } finally { release(); await pending; now.mockRestore(); limiter.resetKey('127.0.0.1'); }
  });
