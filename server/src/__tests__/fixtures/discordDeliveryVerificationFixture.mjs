/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiscordDeliveryVerificationReader } from '../../services/discordDeliveryVerificationReader.mjs';
import { createLoopbackServer } from './discordTransportSupport.mjs';

const bot = '111111111111111111'; const channel = '222222222222222222'; const messageId = '333333333333333333';
const nonce = 'cf_abcdefghijklmnopqrstuv';
const receipt = { bot_user_id: bot, channel_id: channel, classification_id: '91', nonce };
const config = { bot_token: 'synthetic-fixture' };
const message = { id: messageId, channel_id: channel, content: '', type: 0, author: { id: bot, bot: true },
  embeds: [{ footer: { text: `Classifarr receipt v1:91:${nonce}` } }] };

async function fixture(t, handler, timeoutMs = 1500) {
  const requests = [];
  const local = await createLoopbackServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    assert.equal(req.headers.authorization, 'Bot synthetic-fixture');
    handler(req, res);
  });
  t.after(() => local.close());
  const read = createDiscordDeliveryVerificationReader({ timeoutMs, request: (url, init) =>
    fetch(new URL(new URL(url).pathname, local.origin), init) });
  return { requests, read: signal => read({ receipt, config, messageId, signal }) };
}
const json = (res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const identity = (req, res) => {
  if (req.url.endsWith('/users/@me')) { json(res, { id: bot, bot: true }); return true; }
  return false;
};
test('one identity and one exact-message GET produce proof without nonce or Gateway', async t => {
  const f = await fixture(t, (req, res) => { if (!identity(req, res)) json(res, message); });
  assert.deepEqual(await f.read(), { code: 'verified', proof: { nonce, classificationId: '91', correlationVersion: 1,
    botUserId: bot, channelId: channel, messageId } });
  assert.deepEqual(f.requests, [{ method: 'GET', url: '/api/v10/users/@me' },
    { method: 'GET', url: `/api/v10/channels/${channel}/messages/${messageId}` }]);
});
test('wrong bot stops before any message read', async t => {
  const f = await fixture(t, (_req, res) => json(res, { id: channel, bot: true }));
  assert.equal((await f.read()).code, 'bot_changed'); assert.equal(f.requests.length, 1);
});
for (const [status, code] of [[401, 'access_denied'], [403, 'access_denied'], [404, 'message_unavailable'], [503, 'provider_unavailable']]) {
  test(`HTTP ${status} does not retry or become proof`, async t => {
    const f = await fixture(t, (req, res) => { if (identity(req, res)) return; res.writeHead(status); res.end('private body'); });
    assert.deepEqual(await f.read(), { code }); assert.equal(f.requests.length, 2);
  });
}
for (const delay of ['130.25', 'invalid', null]) {
  test(`429 ${delay} is returned without sleep or retry`, async t => {
    const f = await fixture(t, (_req, res) => {
      res.writeHead(429, delay ? { 'retry-after': delay } : {}); res.end(JSON.stringify({ retry_after: 90 }));
    });
    assert.deepEqual(await f.read(), { code: 'rate_limited', retryAfterSeconds: delay === 'invalid' ? null : delay ? 131 : 90 });
    assert.equal(f.requests.length, 1);
  });
}
for (const mutation of [{ id: channel }, { channel_id: bot }, { embeds: [] }, { webhook_id: bot },
  { message_reference: {} }, { message_snapshots: [{}] }, { content: null }, { nonce: 'wrong' }]) {
  test(`rejects mismatching or incomplete provider message ${JSON.stringify(mutation)}`, async t => {
    const f = await fixture(t, (req, res) => { if (!identity(req, res)) json(res, { ...message, ...mutation }); });
    assert.equal((await f.read()).code, 'proof_mismatch');
  });
}
test('malformed/oversized JSON and redirects remain unconfirmed without following or retries', async t => {
  for (const mode of ['malformed', 'oversized', 'redirect']) {
    const f = await fixture(t, (_req, res) => {
      if (mode === 'redirect') { res.writeHead(302, { location: '/private' }); res.end(); }
      else { res.writeHead(200); res.end(mode === 'malformed' ? '{' : 'x'.repeat(262145)); }
    });
    assert.equal((await f.read()).code, 'provider_unavailable'); assert.equal(f.requests.length, 1);
  }
});
test('shared deadline covers both GETs and aborts a stalled body', async t => {
  let closed;
  const close = new Promise(resolve => { closed = resolve; });
  const f = await fixture(t, (req, res) => {
    if (req.url.endsWith('/users/@me')) { setTimeout(() => identity(req, res), 80); return; }
    res.writeHead(200); res.write('{'); res.on('close', closed);
  }, 150);
  assert.equal((await f.read()).code, 'timed_out'); await close;
  assert.equal(f.requests.length, 2);
});
test('caller cancellation aborts actual I/O and pre-cancelled calls do no work', async t => {
  const entered = Promise.withResolvers(); const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{'); entered.resolve(); res.on('close', closed.resolve); });
  const controller = new AbortController(); const result = f.read(controller.signal);
  await entered.promise; controller.abort();
  assert.equal((await result).code, 'cancelled'); await closed.promise;
  assert.equal((await f.read(controller.signal)).code, 'cancelled'); assert.equal(f.requests.length, 1);
});
