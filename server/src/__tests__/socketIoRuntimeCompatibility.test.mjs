/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { createServer, get } from 'node:http';
import { once } from 'node:events';
import { Server } from 'socket.io';

test('real Socket.IO transport releases an unacknowledged timed-out event', async () => {
  const http = createServer();
  const io = new Server(http);
  let client;
  try {
    http.listen(0, '127.0.0.1'); await once(http, 'listening');
    const connected = once(io, 'connection');
    client = new WebSocket(`ws://127.0.0.1:${http.address().port}/socket.io/?EIO=4&transport=websocket`);
    client.addEventListener('message', event => { if (String(event.data).startsWith('0')) client.send('40'); });
    const [socket] = await connected;
    const timeout = await new Promise(resolve => { socket.timeout(50).emit('synthetic-unacknowledged', error => resolve(error)); });
    expect(timeout).toBeInstanceOf(Error);
    expect(socket.acks.size).toBe(0);
  } finally {
    client?.close();
    await new Promise(resolve => { io.close(resolve); });
  }
});

test('dynamic namespaces reject stateful regular expressions', async () => {
  const http = createServer();
  const io = new Server(http);
  try {
    http.listen(0, '127.0.0.1'); await once(http, 'listening');
    expect(() => io.of(/unsafe/g)).toThrow();
    expect(() => io.of(/unsafe/y)).toThrow();
  } finally { await new Promise(resolve => { io.close(resolve); }); }
});

test.each(['3', null, '4'])('transport upgrade validates EIO=%s and preserves service', async revision => {
  const http = createServer(), io = new Server(http);
  try {
    http.listen(0, '127.0.0.1'); await once(http, 'listening');
    const base = `http://127.0.0.1:${http.address().port}/socket.io/`;
    const initial = await fetch(`${base}?EIO=4&transport=polling`, { signal: AbortSignal.timeout(3000) });
    const session = JSON.parse((await initial.text()).slice(1));
    const result = await new Promise((resolve, reject) => {
      const req = get(`${base}?transport=websocket&sid=${encodeURIComponent(session.sid)}${revision ? `&EIO=${revision}` : ''}`, {
        signal: AbortSignal.timeout(3000), headers: { Connection: 'Upgrade', Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' },
      }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
      req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    });
    expect(result).toBe(revision === '4' ? 101 : 400);
    const next = await fetch(`${base}?EIO=4&transport=polling`, { signal: AbortSignal.timeout(3000) });
    expect(next.status).toBe(200); expect(await next.text()).toContain('"sid"');
  } finally { await new Promise(resolve => { io.close(resolve); }); }
});
