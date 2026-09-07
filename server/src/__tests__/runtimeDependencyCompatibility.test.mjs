/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import { z } from 'zod';
import { httpGet } from '../utils/httpClient.mjs';

describe('runtime dependency compatibility', () => {
  test('rate limiting rejects excess requests and provides retry metadata', async () => {
    const app = express();
    app.use(rateLimit({ windowMs: 60_000, limit: 2, standardHeaders: 'draft-7', legacyHeaders: false }));
    app.get('/', (_req, res) => res.json({ ok: true }));
    await request(app).get('/').expect(200);
    await request(app).get('/').expect(200);
    const blocked = await request(app).get('/').expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.headers.ratelimit).toContain('remaining=0');
  });

  test('the custom HTTP transport reads JSON and aborts an active local request', async () => {
    let notifySlowRequest;
    const slowRequest = new Promise(resolve => { notifySlowRequest = resolve; });
    const server = createServer((req, res) => {
      if (req.url === '/slow') { notifySlowRequest(); return; }
      if (req.url === '/denied') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'denied' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    const listening = once(server, 'listening');
    server.listen(0, '127.0.0.1');
    await listening;
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      expect(await httpGet(url, { rejectUnauthorized: false })).toMatchObject({ data: { ok: true }, status: 200 });
      expect(await httpGet(url)).toMatchObject({ data: { ok: true }, status: 200 });
      await expect(httpGet(`${url}/denied`, { rejectUnauthorized: false })).rejects.toMatchObject({
        response: { status: 401, data: { error: 'denied' } },
      });
      const pending = httpGet(`${url}/slow`, { rejectUnauthorized: false, timeout: 500 });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'ETIMEDOUT' });
      await Promise.race([slowRequest, pending]);
      await rejected;
    } finally {
      const closed = new Promise(resolve => { server.close(resolve); });
      server.closeAllConnections();
      await closed;
    }
  });

  test('validation preserves nullable zero and executes default factories only when needed', () => {
    let defaults = 0;
    const schema = z.strictObject({
      rate: z.number().min(0).max(1).nullable(),
      name: z.string().default(() => { defaults += 1; return 'default'; }),
    });
    expect(schema.parse({ rate: 0, name: 'explicit' })).toEqual({ rate: 0, name: 'explicit' });
    expect(defaults).toBe(0);
    expect(schema.parse({ rate: null })).toEqual({ rate: null, name: 'default' });
    expect(defaults).toBe(1);
    expect(schema.safeParse({ rate: '0', name: 'explicit' }).success).toBe(false);
    expect(schema.safeParse({ rate: 2, name: 'explicit' }).success).toBe(false);
    expect(schema.safeParse({ rate: 0, name: 'explicit', extra: true }).success).toBe(false);
  });
});
