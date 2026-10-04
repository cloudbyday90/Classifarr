/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiscordClient } from '../../services/discordClientFactory.mjs';
import { createLoopbackServer, loadDiscordTransport } from './discordTransportSupport.mjs';

const { undici } = await loadDiscordTransport('@discordjs/rest');
const canary = 'private-provider-content-do-not-log';

for (const mode of ['reset', 'server-error']) {
  test(`message creation is not replayed after ${mode}`, async t => {
    const { client, requests } = await fixture(t, (req, res) => {
      req.resume();
      req.once('end', () => {
        if (mode === 'reset') { req.socket.destroy(); return; }
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: canary }));
      });
    });
    await assert.rejects(client.rest.post('/channels/123/messages', {
      body: { content: 'fixture', nonce: 'cf_abcdefghijklmnopqrstuv', enforce_nonce: true },
    }), { code: 'DISCORD_WRITE_UNCONFIRMED' });
    assert.equal(requests.length, 1);
    assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
  });
}

async function fixture(t, handler, limits = {}) {
  const requests = [];
  const local = await createLoopbackServer((req, res) => {
    requests.push(req.url);
    if (req.url.endsWith('/healthy')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    } else handler(req, res);
  });
  const agent = new undici.Agent({ connections: 1 });
  const client = createDiscordClient({
    intents: [], rest: { api: local.origin, agent, retries: 3 },
  }, { timeoutMs: 1000, ...limits });
  client.rest.setToken('synthetic-discord-fixture');
  t.after(async () => {
    await client.destroy();
    await agent.destroy();
    await local.close();
  });
  return { client, requests, origin: local.origin };
}

test('bounded adapter preserves POST, permanent failures, empty responses and settled 5xx retries', async t => {
  let received;
  const { client, requests } = await fixture(t, (req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url.endsWith('/empty')) { res.writeHead(204); res.end(); return; }
      const status = req.url.endsWith('/forbidden') ? 403 : req.url.endsWith('/unavailable') ? 503 : 200;
      received = { body, authorization: req.headers.authorization, method: req.method };
      res.writeHead(status, { 'content-type': 'application/json' });
      // Larger than the socket's high-water mark: retry must settle this body.
      res.end(JSON.stringify(status === 200 ? { id: '123' }
        : { code: 50013, message: 'fixture failure', padding: 'x'.repeat(128 * 1024) }));
    });
  });
  const payload = { content: 'fixture', allowed_mentions: { parse: [] } };
  assert.deepEqual(await client.rest.post('/channels/123/messages', { body: payload }), { id: '123' });
  assert.deepEqual(received, { body: JSON.stringify(payload), authorization: 'Bot synthetic-discord-fixture', method: 'POST' });
  await assert.rejects(client.rest.get('/forbidden'), { status: 403, code: 50013 });
  assert.equal(requests.filter(path => path.endsWith('/forbidden')).length, 1);
  await assert.rejects(client.rest.get('/unavailable'), { status: 503 });
  assert.equal(requests.filter(path => path.endsWith('/unavailable')).length, 4);
  assert.equal((await client.rest.delete('/empty')).byteLength, 0);
  assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
});

test('SDK still handles rate-limit headers and retry_after', async t => {
  let attempts = 0;
  const { client } = await fixture(t, (_req, res) => {
    attempts += 1;
    res.writeHead(attempts === 1 ? 429 : 200, {
      'content-type': 'application/json', 'retry-after': '0.02', 'x-ratelimit-scope': 'shared',
    });
    res.end(JSON.stringify(attempts === 1 ? { message: 'rate limited', retry_after: 0.02, global: false } : { ok: true }));
  });
  assert.deepEqual(await client.rest.post('/channels/123/messages', {
    body: { nonce: 'cf_abcdefghijklmnopqrstuv', enforce_nonce: true },
  }), { ok: true });
  assert.equal(attempts, 2);
});

for (const mode of ['headers', 'stalled', 'dripping']) {
  test(`${mode} body hits overall deadline without replaying a POST`, async t => {
    const closed = Promise.withResolvers();
    const { client, requests } = await fixture(t, (_req, res) => {
      if (mode !== 'headers') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{');
      }
      const timer = mode === 'dripping' ? setInterval(() => res.write(' '), 20) : null;
      res.once('close', () => { clearInterval(timer); closed.resolve(); });
    }, { timeoutMs: 200 });
    await assert.rejects(client.rest.post('/slow', { body: { content: 'may already be accepted' } }), {
      code: 'DISCORD_REQUEST_TIMEOUT', name: 'DiscordRestError',
    });
    await closed.promise;
    assert.equal(requests.length, 1);
    assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
  });
}

for (const mode of ['declared', 'chunked']) {
  test(`${mode} oversized response closes the connection and frees capacity`, async t => {
    const closed = Promise.withResolvers();
    const { client, requests } = await fixture(t, (_req, res) => {
      res.writeHead(200, mode === 'declared' ? { 'content-length': '1000000' } : {});
      res.write(mode === 'declared' ? 'x' : 'x'.repeat(512));
      res.once('close', () => closed.resolve());
    }, { maxBytes: 256, maxConcurrent: 1 });
    await assert.rejects(client.rest.get('/oversized'), { code: 'DISCORD_RESPONSE_TOO_LARGE' });
    await closed.promise;
    assert.equal(requests.length, 1);
    assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
  });
}

test('malformed JSON does not expose response content or trigger retries', async t => {
  const { client, requests } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(canary);
  });
  await assert.rejects(client.rest.get('/malformed'), error => {
    assert.equal(error.code, 'DISCORD_RESPONSE_INVALID');
    assert.equal(error.cause, undefined);
    assert.ok(!error.stack.includes(canary));
    return true;
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
});

test('caller cancellation before dispatch and during body consumption does not retry', async t => {
  const headers = Promise.withResolvers();
  const controller = new AbortController();
  const { client, requests } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{');
    headers.resolve();
  });
  await assert.rejects(client.rest.get('/pre-cancelled', { signal: AbortSignal.abort(canary) }), {
    code: 'DISCORD_REQUEST_CANCELLED',
  });
  assert.equal(requests.length, 0);
  const pending = assert.rejects(client.rest.get('/cancel', { signal: controller.signal }), {
    code: 'DISCORD_REQUEST_CANCELLED', message: 'Discord request cancelled',
  });
  await headers.promise;
  controller.abort(canary);
  await pending;
  assert.equal(requests.length, 1);
  assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
});

test('client destruction cancels active and SDK-queued work without sending again', async t => {
  const headers = Promise.withResolvers();
  const { client, requests } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{');
    headers.resolve();
  });
  const first = assert.rejects(client.rest.get('/hold'), { code: 'DISCORD_TRANSPORT_CLOSED' });
  await headers.promise;
  const queued = assert.rejects(client.rest.get('/hold'), { code: 'DISCORD_TRANSPORT_CLOSED' });
  await client.destroy();
  await Promise.all([first, queued]);
  assert.equal(requests.length, 1);
});

test('a broken response body does not replay a potentially accepted notification', async t => {
  const { client, requests } = await fixture(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.write('{');
    const timer = setTimeout(() => res.destroy(), 50);
    res.once('close', () => clearTimeout(timer));
  });
  await assert.rejects(client.rest.post('/broken', { body: { content: 'accepted maybe' } }), {
    code: 'DISCORD_TRANSPORT_FAILED',
  });
  assert.equal(requests.length, 1);
  assert.deepEqual(await client.rest.get('/healthy'), { ok: true });
});
