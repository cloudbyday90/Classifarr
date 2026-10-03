/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

describe('Supertest HTTP lifecycle contract', () => {
  const servers = new Set();

  function fixture(handler) {
    const server = createServer(handler);
    servers.add(server);
    return server;
  }

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all([...servers].map(server => new Promise(resolve => {
      server.close(resolve);
      server.closeAllConnections();
    })));
    servers.clear();
  });

  test('automatically started servers bind only to IPv4 loopback and close after success', async () => {
    const server = fixture((_req, res) => res.end(server.address().address));
    await request(server).get('/').timeout(2000).expect(200, '127.0.0.1');
    expect(server.listening).toBe(false);
    expect(server.address()).toBeNull();
  });

  test('preserves encoded paths and appended query parameters through asynchronous startup', async () => {
    const server = fixture((req, res) => res.end(req.url));
    const response = await request(server)
      .get('/lookup/a%2Fb?existing=1')
      .query({ title: 'a+b & c', page: 0 })
      .timeout(2000)
      .expect(200);
    const url = new URL(response.text, 'http://127.0.0.1');
    expect(url.pathname).toBe('/lookup/a%2Fb');
    expect([...url.searchParams]).toEqual([
      ['existing', '1'], ['title', 'a+b & c'], ['page', '0'],
    ]);
    expect(server.listening).toBe(false);
  });

  test('callback requests complete once and observe an already-closed owned server', async () => {
    const server = fixture((_req, res) => res.end('callback'));
    const callback = jest.fn();
    await new Promise((resolve, reject) => {
      request(server).get('/').timeout(2000).expect(200, 'callback').end((error, response) => {
        callback(error, response, server.listening);
        if (error) reject(error);
        else resolve();
      });
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, expect.objectContaining({ text: 'callback' }), false);
  });

  test('an Express agent retains cookies across independently started requests and redirects', async () => {
    const app = express();
    app.post('/session', (_req, res) => {
      res.cookie('fixture_session', 'local-only', { httpOnly: true, sameSite: 'strict' });
      res.redirect(303, '/session');
    });
    app.get('/session', (req, res) => res.json({ cookie: req.headers.cookie ?? null }));
    const server = fixture(app);
    const agent = request.agent(server);
    await agent.post('/session').redirects(1).timeout(2000)
      .expect(200, { cookie: 'fixture_session=local-only' });
    expect(server.listening).toBe(false);
    await agent.get('/session').timeout(2000).expect(200, { cookie: 'fixture_session=local-only' });
    expect(server.listening).toBe(false);
  });

  test('concurrent requests share startup and close only after both finish', async () => {
    const responses = [];
    const server = fixture((_req, res) => {
      responses.push(res);
      if (responses.length === 2) responses.forEach(response => response.end('shared'));
    });
    const client = request(server);
    await Promise.all([
      client.get('/one').timeout(2000).expect(200, 'shared'),
      client.get('/two').timeout(2000).expect(200, 'shared'),
    ]);
    expect(responses).toHaveLength(2);
    expect(server.listening).toBe(false);
  });

  test('closes an owned server after an assertion failure', async () => {
    const server = fixture((_req, res) => { res.writeHead(503); res.end(); });
    await expect(request(server).get('/').timeout(2000).expect(200))
      .rejects.toThrow('expected 200');
    expect(server.listening).toBe(false);
  });

  test('closes an owned server after a response timeout', async () => {
    const server = fixture(() => {});
    await expect(request(server).get('/').timeout({ response: 100, deadline: 2000 }))
      .rejects.toMatchObject({ code: 'ECONNABORTED', timeout: 100 });
    expect(server.listening).toBe(false);
  });

  test.each(['127.0.0.1', '::1'])('leaves a caller-owned listener on %s open', async host => {
    const server = fixture((_req, res) => res.end('caller-owned'));
    const listening = once(server, 'listening');
    server.listen(0, host);
    await listening;
    const address = server.address();
    await request(server).get('/').timeout(2000).expect(200, 'caller-owned');
    expect(server.listening).toBe(true);
    expect(server.address()).toEqual(address);
    await request(server).get('/').timeout(2000).expect(200, 'caller-owned');
  });

  test('propagates asynchronous startup failure and removes temporary startup listeners', async () => {
    const server = fixture((_req, res) => res.end('unreachable'));
    const baseline = {
      listening: server.listenerCount('listening'),
      error: server.listenerCount('error'),
      close: server.listenerCount('close'),
    };
    const startupError = Object.assign(new Error('fixture listen denied'), { code: 'EACCES' });
    jest.spyOn(server, 'listen').mockImplementation(() => {
      queueMicrotask(() => server.emit('error', startupError));
      return server;
    });
    // Wrap construction too: older Supertest dereferences the not-yet-set address.
    await expect(Promise.resolve().then(() => request(server).get('/').timeout(2000)))
      .rejects.toBe(startupError);
    expect(server.listening).toBe(false);
    for (const [event, count] of Object.entries(baseline)) {
      expect(server.listenerCount(event)).toBe(count);
    }
  });
});
