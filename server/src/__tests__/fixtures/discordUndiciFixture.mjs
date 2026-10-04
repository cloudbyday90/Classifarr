/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import { once } from 'node:events';
import { test } from 'node:test';
import { createLoopbackServer, loadDiscordTransport } from './discordTransportSupport.mjs';

const { undici, version } = await loadDiscordTransport(process.env.CLASSIFARR_DISCORD_TRANSPORT_FIXTURE);

test('uses the reviewed nested transport version', () => {
  assert.equal(version, '6.29.0');
});

for (const status of [300, 404, 416]) {
  test(`terminal ${status} settles the already exposed retry body`, async () => {
    let initialResponse;
    const ranges = [];
    const local = await createLoopbackServer((req, res) => {
      req.resume();
      ranges.push(req.headers.range);
      if (ranges.length === 1) {
        initialResponse = res;
        res.writeHead(200, { 'content-length': '6', etag: '"fixture"' });
        res.write('abc');
      } else {
        res.writeHead(status, { 'content-length': '0' });
        res.end();
      }
    });
    const agent = new undici.RetryAgent(new undici.Agent({ connections: 1 }), {
      maxRetries: 1, minTimeout: 1, maxTimeout: 1,
    });
    try {
      const response = await undici.request(local.origin, {
        dispatcher: agent, signal: AbortSignal.timeout(2000),
      });
      assert.equal(response.statusCode, 200);
      const chunks = [];
      await assert.rejects(async () => {
        for await (const chunk of response.body) {
          chunks.push(chunk.toString());
          // Break only after the caller owns the initial response and its bytes.
          initialResponse.destroy();
        }
      }, { code: 'UND_ERR_REQ_RETRY', statusCode: status });
      assert.deepEqual(chunks, ['abc']);
      assert.deepEqual(ranges, [undefined, 'bytes=3-5']);
      assert.equal(response.body.destroyed, true);
    } finally {
      await agent.destroy();
      await local.close();
    }
  });
}

for (const accepted of [true, false]) {
  test(`${accepted ? 'accepted' : 'rejected'} upgrade finishes its diagnostic lifecycle`, async () => {
    const local = await createLoopbackServer((_req, res) => res.end());
    local.server.on('upgrade', (_req, socket) => {
      socket.end(accepted
        ? 'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: fixture\r\n\r\n'
        : 'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
    });
    const events = [];
    const subscriptions = ['create', 'bodySent', 'headers', 'trailers', 'error'].map(name => {
      const source = channel(`undici:request:${name}`);
      const listener = ({ request }) => {
        if (request.origin === local.origin) events.push(name);
      };
      source.subscribe(listener);
      return () => source.unsubscribe(listener);
    });
    const client = new undici.Client(local.origin);
    try {
      const result = client.upgrade({ path: '/', protocol: 'fixture', signal: AbortSignal.timeout(2000) });
      if (accepted) {
        const { socket } = await result;
        const closed = once(socket, 'close');
        socket.destroy();
        await closed;
      } else {
        await assert.rejects(result, { code: 'UND_ERR_SOCKET' });
      }
      assert.deepEqual(events, ['create', 'bodySent', 'headers', accepted ? 'trailers' : 'error']);
    } finally {
      subscriptions.forEach(unsubscribe => unsubscribe());
      await client.destroy();
      await local.close();
    }
  });
}
