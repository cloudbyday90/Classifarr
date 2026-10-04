/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from 'discord.js';
import { createLoopbackServer, loadDiscordTransport } from './discordTransportSupport.mjs';

const { undici } = await loadDiscordTransport('@discordjs/rest');

test('real Discord REST adapter preserves payloads, bounded failures and cancellation', async () => {
  const requests = [];
  const controller = new AbortController();
  const local = await createLoopbackServer((req, res) => {
    const record = { path: req.url, method: req.method, authorization: req.headers.authorization, body: '' };
    requests.push(record);
    req.setEncoding('utf8');
    req.on('data', chunk => { record.body += chunk; });
    req.on('end', () => {
      if (req.url.endsWith('/hang')) {
        controller.abort();
        return;
      }
      const status = req.url.endsWith('/unavailable') ? 503 : req.url.endsWith('/forbidden') ? 403 : 200;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? { id: '123', content: 'fixture' } : { code: 50013, message: 'fixture failure' }));
    });
  });
  const agent = new undici.Agent({ connections: 1 });
  const client = new Client({
    intents: [],
    rest: { api: local.origin, agent, retries: 1, timeout: 2000 },
  });
  client.rest.setToken('synthetic-discord-fixture');
  try {
    const payload = { content: 'fixture', allowed_mentions: { parse: [] } };
    assert.deepEqual(await client.rest.post('/channels/123/messages', { body: payload }), { id: '123', content: 'fixture' });
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].authorization, 'Bot synthetic-discord-fixture');
    assert.deepEqual(JSON.parse(requests[0].body), payload);

    await assert.rejects(client.rest.get('/forbidden'), { status: 403, code: 50013 });
    assert.equal(requests.filter(req => req.path.endsWith('/forbidden')).length, 1);
    await assert.rejects(client.rest.get('/unavailable'), { status: 503 });
    assert.equal(requests.filter(req => req.path.endsWith('/unavailable')).length, 2);

    // Do not add a RetryAgent or change the adapter: exercise Discord's own policy.
    await assert.rejects(client.rest.get('/hang', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(requests.filter(req => req.path.endsWith('/hang')).length, 1);
    assert.deepEqual(await client.rest.get('/healthy'), { id: '123', content: 'fixture' });
  } finally {
    await client.destroy();
    await agent.destroy();
    await local.close();
  }
});
