/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDiscordClient } from '../../services/discordClientFactory.mjs';
import { createDiscordProviderGate } from '../../services/discordProviderGate.mjs';
import { createDiscordDeliveryWriter } from '../../services/discordDeliveryWriter.mjs';
import { createDiscordDeliveryVerificationReader } from '../../services/discordDeliveryVerificationReader.mjs';
import { DiscordDeliveryDeferredError } from '../../services/discordProviderCooldown.mjs';
import { createLoopbackServer, loadDiscordTransport } from './discordTransportSupport.mjs';

const { undici } = await loadDiscordTransport('@discordjs/rest');
const json = (res, body = { ok: true }, headers = {}, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body));
};
async function fixture(t, handler, { timeoutMs = 500, failSave = false } = {}) {
  const requests = []; const delays = []; let waiting = null; let savesFail = failSave; let warnings = 0;
  const local = await createLoopbackServer((req, res) => { requests.push(req.url); req.resume(); handler(req, res); });
  const cooldown = { read: async () => waiting, defer: async value => {
    delays.push(value); if (savesFail) throw new Error('private secret');
    waiting = { code: 'rate_limited', retryAfterSeconds: value }; return waiting;
  } };
  const gate = createDiscordProviderGate({ cooldown, warn: () => { warnings += 1; } });
  const clients = []; const agents = [];
  const createClient = () => {
    const agent = new undici.Agent({ connections: 1 }); agents.push(agent);
    const client = createDiscordClient({ intents: [], rest: { api: local.origin, agent } }, { timeoutMs }, gate);
    client.rest.setToken('synthetic-fixture'); client.token = 'synthetic-fixture'; clients.push(client); return client;
  };
  t.after(async () => { for (const client of clients) await client.destroy(); for (const agent of agents) await agent.destroy(); await local.close(); });
  return { client: createClient(), createClient, gate, requests, delays, local,
    warningCount: () => warnings, repair: () => { savesFail = false; } };
}
test('SDK 429 is durably deferred once and blocks a second client', async t => {
  const f = await fixture(t, (_req, res) => json(res, { retry_after: 95.5 }, {}, 429));
  await assert.rejects(f.client.rest.post('/channels/123/messages', { body: { content: 'fixture' } }), DiscordDeliveryDeferredError);
  await assert.rejects(f.createClient().rest.get('/channels/456'), DiscordDeliveryDeferredError);
  assert.equal(f.requests.length, 1); assert.deepEqual(f.delays, [96]);
});
test('SDK preserves permanent refusal while honoring its exhausted quota', async t => {
  const f = await fixture(t, (_req, res) => json(res, { code: 50013, message: 'fixture refusal' },
    { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '120' }, 403));
  await assert.rejects(f.client.rest.get('/channels/123'), { status: 403, code: 50013 });
  await assert.rejects(f.client.rest.get('/channels/123'), DiscordDeliveryDeferredError);
  assert.equal(f.requests.length, 1); assert.deepEqual(f.delays, [120]);
});
test('successful SDK exhaustion blocks native writer without discarding SDK result', async t => {
  const f = await fixture(t, (_req, res) => json(res, { id: 'proof' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '180.1' }));
  assert.deepEqual(await f.client.rest.get('/channels/123'), { id: 'proof' });
  const writer = createDiscordDeliveryWriter({ gate: f.gate, request: () => assert.fail('writer must not send') });
  await assert.rejects(writer({ client: f.client, channel: { client: f.client }, channelId: '123' }, { content: 'fixture' }), DiscordDeliveryDeferredError);
  assert.deepEqual(f.delays, [181]); assert.equal(f.requests.length, 1);
  // Same SDK bucket must reject without leaving a 181-second sleep timer behind.
  await assert.rejects(f.client.rest.get('/channels/123'), DiscordDeliveryDeferredError);
  const verify = createDiscordDeliveryVerificationReader({ gate: f.gate, request: () => assert.fail('verification must not fetch') });
  assert.deepEqual(await verify({ receipt: {}, config: { bot_token: 'synthetic-fixture' }, messageId: '123' }),
    { code: 'rate_limited', retryAfterSeconds: 181 });
});
test('native exhausted success blocks SDK and retains validated message proof', async t => {
  const bot = '111111111111111111'; const channelId = '222222222222222222';
  const f = await fixture(t, (_req, res) => json(res, { id: '333333333333333333', channel_id: channelId, author: { id: bot, bot: true } },
    { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '60' }));
  f.client.token = 'synthetic-fixture'; f.client.user = { id: bot };
  const writer = createDiscordDeliveryWriter({ gate: f.gate,
    request: (url, init) => fetch(new URL(new URL(url).pathname, f.local.origin), init) });
  assert.equal((await writer({ client: f.client, channel: { client: f.client }, channelId }, { content: 'fixture' })).id, '333333333333333333');
  await assert.rejects(f.createClient().rest.get('/channels/456'), DiscordDeliveryDeferredError);
  assert.equal(f.requests.length, 1);
});

test('queued successor after exhausted success uses the gate without creating an SDK bucket sleep', async t => {
  const entered = Promise.withResolvers(); let finish;
  const f = await fixture(t, (_req, res) => {
    finish = () => json(res, { ok: true }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '180' });
    entered.resolve();
  });
  const first = f.client.rest.get('/channels/123'); await entered.promise;
  const second = assert.rejects(f.client.rest.get('/channels/123'), DiscordDeliveryDeferredError);
  finish(); await Promise.all([first, second]); assert.equal(f.requests.length, 1);
});
test('SDK success survives failed cooldown persistence; later request fails closed then repairs', async t => {
  const f = await fixture(t, (_req, res) => json(res, { id: 'proof' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '0.05' }), { failSave: true });
  assert.deepEqual(await f.client.rest.post('/channels/123/messages', { body: { content: 'fixture' } }), { id: 'proof' });
  await assert.rejects(f.createClient().rest.get('/channels/456'), { code: 'DISCORD_COOLDOWN_UNAVAILABLE' });
  assert.equal(f.warningCount(), 1); f.repair();
  await assert.rejects(f.createClient().rest.get('/channels/789'), DiscordDeliveryDeferredError);
  assert.equal(f.requests.length, 1);
});
test('bot hold does not block interaction acknowledgement and interaction 429 is not replayed', async t => {
  const f = await fixture(t, (req, res) => req.url.includes('/interactions/')
    ? json(res, { retry_after: 0.01 }, {}, 429) : json(res, { ok: true }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '60' }));
  await f.client.rest.get('/channels/123');
  await assert.rejects(f.client.rest.post('/interactions/123/synthetic-token/callback', { auth: false, body: { type: 6 } }), { code: 'DISCORD_REST_RATE_LIMITED' });
  assert.equal(f.requests.length, 2); assert.deepEqual(f.delays, [60]);
});
test('SDK preemptive throttle uses sanitized saved deferral instead of waiting', async t => {
  const f = await fixture(t, (_req, res) => json(res));
  f.client.rest.globalRemaining = 0; f.client.rest.globalReset = Date.now() + 50;
  await assert.rejects(f.client.rest.get('/channels/123'), DiscordDeliveryDeferredError);
  assert.equal(f.requests.length, 0); assert.deepEqual(f.delays, [60]);
});
test('same-route queue wait and active HTTP are cancelled within whole SDK budget', async t => {
  const entered = Promise.withResolvers(); const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.once('close', () => closed.resolve()); entered.resolve(); }, { timeoutMs: 120 });
  const first = f.client.rest.get('/channels/123'); const firstCheck = assert.rejects(first);
  await entered.promise;
  const second = f.client.rest.get('/channels/123'); const secondCheck = assert.rejects(second);
  await Promise.all([firstCheck, secondCheck]); await closed.promise;
  assert.ok(f.requests.length <= 2); // The successor may briefly acquire the queue before its own deadline.
});
test('shutdown aborts queued SDK work and actual sockets; no later requests', async t => {
  const entered = Promise.withResolvers(); const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.once('close', () => closed.resolve()); entered.resolve(); });
  const firstCheck = assert.rejects(f.client.rest.get('/channels/123'));
  await entered.promise; const secondCheck = assert.rejects(f.client.rest.get('/channels/123'));
  await f.client.destroy(); await Promise.all([firstCheck, secondCheck]); await closed.promise;
  await assert.rejects(f.client.rest.get('/channels/456'), { code: 'DISCORD_REST_CANCELLED' });
  assert.equal(f.requests.length, 1);
});

test('explicit cancellation removes a queued request before it can perform HTTP', async t => {
  const entered = Promise.withResolvers(); let finish;
  const f = await fixture(t, (_req, res) => { finish = () => json(res); entered.resolve(); });
  const first = f.client.rest.get('/channels/123'); await entered.promise;
  const controller = new AbortController();
  const second = assert.rejects(f.client.rest.get('/channels/123', { signal: controller.signal }), { code: 'DISCORD_REST_CANCELLED' });
  // Exercise cancellation after the installed SDK has attached its queue listener.
  await new Promise(resolve => { setImmediate(resolve); });
  controller.abort(); await second; finish(); await first;
  assert.equal(f.requests.length, 1);
});

test('cancellation before SDK queue listener attachment still cannot reach HTTP', async t => {
  const entered = Promise.withResolvers(); let finish;
  const f = await fixture(t, (_req, res) => { finish = () => json(res); entered.resolve(); });
  const first = f.client.rest.get('/channels/123'); await entered.promise;
  const controller = new AbortController();
  const second = assert.rejects(f.client.rest.get('/channels/123', { signal: controller.signal }), { code: 'DISCORD_REST_CANCELLED' });
  controller.abort(); finish(); await Promise.all([first, second]);
  assert.equal(f.requests.length, 1);
});

test('SDK outstanding request cap bounds work waiting before the HTTP gate', async t => {
  const entered = Promise.withResolvers();
  const f = await fixture(t, () => entered.resolve(), { timeoutMs: 1000 });
  const requests = Array.from({ length: 16 }, () => assert.rejects(f.client.rest.get('/channels/123')));
  await entered.promise;
  await assert.rejects(f.client.rest.get('/channels/123'), { code: 'DISCORD_REST_BUSY' });
  await f.client.destroy(); await Promise.all(requests); assert.equal(f.requests.length, 1);
});
