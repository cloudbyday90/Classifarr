/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Server } from 'engine.io';
import { WebSocket } from 'ws';

const event = (target, name) => once(target, name, { signal: AbortSignal.timeout(3000) });

test('real transport refreshes once per heartbeat, then evicts traffic without a pong', async () => {
  const http = createServer();
  const engine = new Server({ pingInterval: 40, pingTimeout: 1000 });
  engine.attach(http);
  let client;
  let traffic;
  try {
    http.listen(0, '127.0.0.1');
    await event(http, 'listening');
    const connected = event(engine, 'connection');
    client = new WebSocket(`ws://127.0.0.1:${http.address().port}/engine.io/?EIO=4&transport=websocket`);
    const [socket] = await connected;
    // Observe the real timer's refresh calls; no fake clock or timing-race assertion.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      let packet;
      do { [packet] = await event(client, 'message'); } while (packet.toString() !== '2');
      const refreshed = jest.spyOn(socket.pingTimeoutTimer, 'refresh');
      for (const payload of ['first', 'second']) {
        const received = event(socket, 'message');
        client.send(`4${payload}`);
        expect(await received).toEqual([payload]);
      }
      expect(refreshed).toHaveBeenCalledTimes(1);
      refreshed.mockRestore();
      if (cycle === 0) {
        const heartbeat = event(socket, 'heartbeat');
        client.send('3');
        await heartbeat;
        expect(socket.pingTimeoutTimer).toBeNull();
      }
    }
    const closed = event(socket, 'close');
    traffic = setInterval(() => {
      if (client.readyState === WebSocket.OPEN) client.send('4still-no-pong');
    }, 50);
    expect((await closed)[0]).toBe('ping timeout');
    expect(engine.clientsCount).toBe(0);
    expect(socket.pingTimeoutTimer).toBeNull();
  } finally {
    clearInterval(traffic);
    jest.restoreAllMocks();
    client?.terminate();
    engine.close();
    await new Promise(resolve => { http.close(resolve); });
  }
});
