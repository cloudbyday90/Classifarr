/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { once } from 'node:events';
import { get } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const event = (target, name) => once(target, name, { signal: AbortSignal.timeout(3000) });

async function withConnection(run, options = {}) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0, ...options });
  let client;
  try {
    await event(server, 'listening');
    const connected = event(server, 'connection');
    client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
    const opened = event(client, 'open');
    const [peer] = await connected;
    await opened;
    await run(client, peer);
  } finally {
    client?.terminate();
    for (const peer of server.clients) peer.terminate();
    await new Promise(resolve => { server.close(resolve); });
  }
}

test.each([
  ['client', 1005, 'invalid code'], ['server', 1005, 'invalid code'],
  ['client', 1000, 'x'.repeat(124)], ['server', 1000, 'x'.repeat(124)],
])('%s remains usable after invalid close arguments (%i)', async (side, code, reason) => {
  await withConnection(async (client, peer) => {
    const sender = side === 'client' ? client : peer;
    const receiver = side === 'client' ? peer : client;
    expect(() => sender.close(code, reason)).toThrow();
    expect(sender.readyState).toBe(WebSocket.OPEN);
    const received = event(receiver, 'message');
    sender.send(Buffer.from([0, 127, 255]));
    const [payload, binary] = await received;
    expect(payload).toEqual(Buffer.from([0, 127, 255]));
    expect(binary).toBe(true);
    const closed = event(receiver, 'close');
    sender.close(1000, 'done');
    expect(await closed).toEqual([1000, Buffer.from('done')]);
  });
});

test('fragmented messages cannot bypass the configured payload limit', async () => {
  await withConnection(async (client, peer) => {
    const failure = event(peer, 'error');
    const closed = event(client, 'close');
    client.send(Buffer.alloc(8), { fin: false });
    client.send(Buffer.alloc(9), { fin: true });
    expect((await failure)[0].code).toBe('WS_ERR_UNSUPPORTED_MESSAGE_LENGTH');
    expect((await closed)[0]).toBe(1009);
  }, { maxPayload: 16 });
});

test('compression negotiation rejects a window below the server requirement', async () => {
  // Compression is enabled only in this fixture, never in production configuration.
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0,
    perMessageDeflate: { clientMaxWindowBits: 10 } });
  try {
    await event(server, 'listening');
    const status = await new Promise((resolve, reject) => {
      const req = get(`http://127.0.0.1:${server.address().port}/`, {
        signal: AbortSignal.timeout(3000), headers: {
          Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits=8',
        },
      }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
      req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    });
    expect(status).toBe(400);
  } finally {
    for (const peer of server.clients) peer.terminate();
    await new Promise(resolve => { server.close(resolve); });
  }
});
