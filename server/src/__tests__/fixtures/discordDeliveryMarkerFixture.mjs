/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClientUser, EmbedBuilder } from 'discord.js';
import { createDiscordClient } from '../../services/discordClientFactory.mjs';
import { createDiscordDeliveryService } from '../../services/discordDeliveryService.mjs';
import { getDeliveryProof } from '../../services/discordDeliveryMarker.mjs';
import { setDeliveryFooter } from '../../services/discordDeliveryPayload.mjs';
import { createLoopbackServer, loadDiscordTransport } from './discordTransportSupport.mjs';

const { undici } = await loadDiscordTransport('@discordjs/rest');
const botUserId = '111111111111111111';
const channelId = '222222222222222222';
const messageId = '333333333333333333';
const nonce = 'cf_abcdefghijklmnopqrstuv';
const author = { id: botUserId, username: 'Fixture', discriminator: '0', bot: true, avatar: null };

test('SDK send, uncached read without nonce and footer edit preserve exact receipt proof', async t => {
  const requests = [];
  let saved;
  const local = await createLoopbackServer((req, res) => {
    const record = { method: req.method, path: req.url, body: '' };
    requests.push(record);
    req.setEncoding('utf8');
    req.on('data', chunk => { record.body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      if (req.url.endsWith(`/channels/${channelId}`)) {
        res.end(JSON.stringify({ id: channelId, type: 0, name: 'Fixture', guild_id: '444444444444444444' }));
        return;
      }
      if (req.method === 'POST') saved = JSON.parse(record.body);
      if (req.method === 'PATCH') saved = { ...saved, ...JSON.parse(record.body) };
      // Realistic provider representation; never persist/return the creation nonce.
      const { nonce: _nonce, enforce_nonce: _enforceNonce, ...persisted } = saved;
      res.end(JSON.stringify({ content: '', ...persisted, id: messageId, channel_id: channelId, author,
        type: 0, timestamp: '2026-10-04T00:00:00Z', edited_timestamp: null, flags: 0,
        attachments: [], mentions: [], mention_roles: [], pinned: false, tts: false, mention_everyone: false }));
    });
  });
  const clients = [];
  const agent = new undici.Agent({ connections: 1 });
  const client = () => {
    const instance = createDiscordClient({ intents: [], rest: { api: local.origin, agent, retries: 0 } }, { timeoutMs: 2000 });
    instance.rest.setToken('synthetic-discord-fixture');
    instance.user = new ClientUser(instance, author);
    clients.push(instance);
    return instance;
  };
  t.after(async () => {
    await Promise.all(clients.map(instance => instance.destroy()));
    await agent.destroy();
    await local.close();
  });
  const original = client();
  const channel = await original.channels.fetch(channelId, { allowUnknownGuild: true });
  const failedCompletion = createDiscordDeliveryService({
    claim: async () => ({ admitted: true, nonce }), complete: async () => { throw new Error('database unavailable'); },
    fail: async () => ({ sent: false, reason: 'delivery_unconfirmed' }),
  });
  assert.equal((await failedCompletion.send({ classificationId: '91', kind: 'pending', client: original,
    channel, channelId, payload: { embeds: [new EmbedBuilder().setTitle('Fixture')], allowedMentions: { parse: [] } },
  })).reason, 'delivery_unconfirmed');
  assert.equal(saved.nonce, nonce);
  assert.equal(saved.enforce_nonce, true);
  assert.deepEqual(saved.allowed_mentions, { parse: [] });

  const restarted = client();
  const restartedChannel = await restarted.channels.fetch(channelId, { allowUnknownGuild: true });
  const message = await restartedChannel.messages.fetch({ message: messageId, force: true, cache: false });
  assert.equal(message.nonce, null);
  const proof = { classificationId: '91', nonce, correlationVersion: 1, botUserId, channelId, messageId };
  assert.deepEqual(getDeliveryProof(message, botUserId), proof);
  let completions = 0;
  const recovered = createDiscordDeliveryService({ complete: async received => {
    assert.deepEqual(received, proof); completions += 1; return true;
  } });
  assert.equal(await recovered.observe(message, restarted), true);
  assert.equal(completions, 1);
  const edited = setDeliveryFooter(EmbedBuilder.from(message.embeds[0]), 'Acknowledged');
  await restartedChannel.messages.edit(messageId, { embeds: [edited] });
  const reread = await restartedChannel.messages.fetch({ message: messageId, force: true, cache: false });
  assert.deepEqual(getDeliveryProof(reread, botUserId), proof);
  assert.equal(requests.filter(record => record.method === 'POST').length, 1);
  assert.equal(requests.filter(record => record.method === 'PATCH').length, 1);
  assert.equal(requests.filter(record => record.path.endsWith(`/messages/${messageId}`) && record.method === 'GET').length, 2);
});
