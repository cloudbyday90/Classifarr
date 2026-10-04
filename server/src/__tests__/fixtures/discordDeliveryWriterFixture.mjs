/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createDiscordClient } from '../../services/discordClientFactory.mjs';
import { createDiscordDeliveryWriter } from '../../services/discordDeliveryWriter.mjs';
import { DiscordDeliveryDeferredError } from '../../services/discordProviderCooldown.mjs';
import { verificationRetrySeconds } from '../../services/discordDeliveryVerificationContract.mjs';
import { createLoopbackServer } from './discordTransportSupport.mjs';

const bot = '111111111111111111'; const channelId = '222222222222222222'; const id = '333333333333333333';
const message = { id, channel_id: channelId, author: { id: bot, bot: true } };
async function fixture(t, handler, { timeoutMs = 1000, cooldown = null } = {}) {
  const requests = []; const delays = [];
  const client = createDiscordClient({ intents: [], allowedMentions: { parse: [] } });
  client.token = 'synthetic-fixture';
  client.user = { id: bot };
  const local = await createLoopbackServer((req, res) => {
    requests.push(req.url);
    assert.equal(req.method, 'POST');
    assert.equal(req.url, `/api/v10/channels/${channelId}/messages`);
    assert.equal(req.headers.authorization, 'Bot synthetic-fixture');
    handler(req, res);
  });
  t.after(async () => { await client.destroy(); await local.close(); });
  const write = createDiscordDeliveryWriter({ timeoutMs,
    cooldown: cooldown ?? { read: async () => null, defer: async value => {
      delays.push(value); return { code: 'rate_limited', retryAfterSeconds: verificationRetrySeconds(value) };
    } },
    request: (url, init) => fetch(new URL(new URL(url).pathname, local.origin), init),
  });
  return { requests, delays, closeClient: () => client.destroy(), write: (payload = { content: 'fixture' }, signal = undefined) =>
    write({ client, channel: { client }, channelId, signal }, payload) };
}
const json = (res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

test('SDK serialization preserves mentions, buttons, footer marker and nonce with exactly one POST', async t => {
  let saved;
  const f = await fixture(t, (req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; });
    req.on('end', () => { saved = JSON.parse(body); json(res, message); });
  });
  assert.equal((await f.write({ nonce: 'cf_abcdefghijklmnopqrstuv', enforceNonce: true,
    embeds: [new EmbedBuilder().setFooter({ text: 'Classifarr receipt v1:91:cf_abcdefghijklmnopqrstuv' })],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fixture').setLabel('Review').setStyle(ButtonStyle.Primary))],
  })).id, id);
  assert.deepEqual(saved.allowed_mentions, { parse: [] });
  assert.equal(saved.enforce_nonce, true); assert.equal(saved.nonce, 'cf_abcdefghijklmnopqrstuv');
  assert.equal(saved.components[0].components[0].custom_id, 'fixture');
  assert.match(saved.embeds[0].footer.text, /^Classifarr receipt/); assert.equal(f.requests.length, 1);
});
for (const [header, body, expected] of [['130.25', '{}', 131], [null, '{"retry_after":90}', 90],
  ['invalid', '{}', null], [null, '{', null]]) {
  test(`429 ${header}/${body} persists delay and never sleeps/retries`, async t => {
    const f = await fixture(t, (_req, res) => { res.writeHead(429, header ? { 'retry-after': header } : {}); res.end(body); });
    await assert.rejects(f.write(), error => error instanceof DiscordDeliveryDeferredError && error.retryAfterSeconds === expected);
    assert.equal(f.requests.length, 1); assert.equal(f.delays.length, 1);
  });
}
for (const status of [400, 401, 403, 404, 500, 503]) {
  test(`HTTP ${status} does not retry`, async t => {
    const f = await fixture(t, (_req, res) => { res.writeHead(status); res.end('private-provider-body'); });
    await assert.rejects(f.write(), error => !(error instanceof DiscordDeliveryDeferredError) && !error.message.includes('private'));
    assert.equal(f.requests.length, 1); assert.equal(f.delays.length, 0);
  });
}
test('known cooldown and cancellation before admission perform zero network writes', async t => {
  const f = await fixture(t, () => assert.fail('unexpected I/O'), { cooldown: { read: async () => ({ retryAfterSeconds: 90 }) } });
  await assert.rejects(f.write(), DiscordDeliveryDeferredError);
  await assert.rejects(f.write({}, AbortSignal.abort()));
  assert.equal(f.requests.length, 0);
});
test('missing durable 429 acknowledgement cannot become safe-to-retry evidence', async t => {
  const f = await fixture(t, (_req, res) => { res.writeHead(429); res.end('{"retry_after":60}'); }, {
    cooldown: { read: async () => null, defer: async () => { throw new Error('database unavailable'); } },
  });
  await assert.rejects(f.write(), error => !(error instanceof DiscordDeliveryDeferredError));
  assert.equal(f.requests.length, 1);
});
test('redirect, malformed, oversized and wrong-scope responses remain uncertain', async t => {
  for (const mode of ['redirect', 'malformed', 'oversized', 'wrong-bot', 'wrong-channel']) {
    const f = await fixture(t, (_req, res) => {
      if (mode === 'redirect') { res.writeHead(307, { location: '/private' }); res.end(); }
      else if (mode === 'malformed' || mode === 'oversized') { res.writeHead(200); res.end(mode === 'malformed' ? '{' : 'x'.repeat(262145)); }
      else json(res, { ...message, ...(mode === 'wrong-bot' ? { author: { id, bot: true } } : { channel_id: id }) });
    });
    await assert.rejects(f.write(), error => !(error instanceof DiscordDeliveryDeferredError));
    assert.equal(f.requests.length, 1);
  }
});
test('deadline aborts actual stalled response and never starts a later POST', async t => {
  const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{'); res.on('close', closed.resolve); }, { timeoutMs: 100 });
  await assert.rejects(f.write(), error => error.code === 'DISCORD_REQUEST_TIMEOUT');
  await closed.promise; assert.equal(f.requests.length, 1);
});
test('caller cancellation aborts actual active response', async t => {
  const entered = Promise.withResolvers(); const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{'); entered.resolve(); res.on('close', closed.resolve); });
  const controller = new AbortController(); const pending = f.write({}, controller.signal);
  await entered.promise; controller.abort(); await assert.rejects(pending);
  await closed.promise; assert.equal(f.requests.length, 1);
});
test('attachments and oversized outgoing JSON fail without external file fetches', async t => {
  const f = await fixture(t, () => assert.fail('unexpected I/O'));
  for (const payload of [{ files: ['https://invalid.example/private'] }, { attachments: [{}] }, { content: 'x'.repeat(262145) }]) {
    await assert.rejects(f.write(payload));
  }
  assert.equal(f.requests.length, 0);
});
test('client shutdown cancels active POST and prevents later writes', async t => {
  const entered = Promise.withResolvers(); const closed = Promise.withResolvers();
  const f = await fixture(t, (_req, res) => { res.writeHead(200); res.write('{'); entered.resolve(); res.on('close', closed.resolve); });
  const pending = f.write();
  await entered.promise; await f.closeClient(); await assert.rejects(pending);
  await closed.promise; await assert.rejects(f.write()); assert.equal(f.requests.length, 1);
});
