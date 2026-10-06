/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import request from 'supertest';
import { z } from 'zod';
import morgan from 'morgan';
import { httpGet } from '../utils/httpClient.mjs';

describe('runtime dependency compatibility', () => {
  test.each(['::ffff:10.0.0.0/8', '::/1', ['::ffff:10.0.0.0/8', '10.0.0.0/8']])(
    'malformed cross-family proxy trust cannot spoof client IP: %j', async (subnets) => {
      const app = express();
      app.set('trust proxy', subnets);
      const trust = app.get('trust proxy fn');
      expect(trust('203.0.113.9', 0)).toBe(false);
      expect(trust('::ffff:203.0.113.9', 0)).toBe(false);
      app.get('/', (req, res) => res.json({ ip: req.ip, peer: req.socket.remoteAddress, ips: req.ips }));
      const response = await request(app).get('/').set('X-Forwarded-For', '203.0.113.9').expect(200);
      expect(response.body.ip).toBe(response.body.peer);
      expect(response.body.ips).toEqual([]);
    }
  );

  test.each(['10.0.0.0/8', '::ffff:10.0.0.0/104', ['::ffff:10.0.0.0/104', '2001:db8::/32']])(
    'valid proxy trust retains IPv4 and mapped-address compatibility: %j', (subnets) => {
      const app = express();
      app.set('trust proxy', subnets);
      const trust = app.get('trust proxy fn');
      expect(trust('10.0.0.1', 0)).toBe(true);
      expect(trust('::ffff:10.0.0.1', 0)).toBe(true);
      expect(trust('203.0.113.9', 0)).toBe(false);
      expect(trust('::1', 0)).toBe(false);
    }
  );

  test('the application default ignores forwarded IP claims', async () => {
    const app = express();
    expect(app.get('trust proxy')).toBe(false);
    app.get('/', (req, res) => res.json({ ip: req.ip, peer: req.socket.remoteAddress }));
    const response = await request(app).get('/').set('X-Forwarded-For', '203.0.113.9').expect(200);
    expect(response.body.ip).toBe(response.body.peer);
  });

  test('request log tokens escape quotes, delimiters and controls without adding a forged line', () => {
    const hostile = 'agent"\\\r\nforged\tline';
    const token = morgan['user-agent']({ headers: { 'user-agent': hostile } }, {});
    expect(token).toBe('agent\\"\\\\\\r\\nforged\\tline');
    expect(token).not.toContain('\n');
    expect(morgan['user-agent']({ headers: {} }, {})).toBeUndefined();
  });

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
