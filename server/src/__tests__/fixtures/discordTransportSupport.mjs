/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

// Deliberately test the two locked nested packages, not the root Undici 8.
const packagePaths = {
  'discord.js': '../../../node_modules/discord.js/node_modules/undici/',
  '@discordjs/rest': '../../../node_modules/@discordjs/rest/node_modules/undici/',
};

export async function loadDiscordTransport(consumer) {
  if (!Object.hasOwn(packagePaths, consumer)) throw new Error('unknown_transport_consumer');
  const base = new URL(packagePaths[consumer], import.meta.url);
  const metadata = JSON.parse(await readFile(new URL('package.json', base), 'utf8'));
  const { default: undici } = await import(new URL('index.js', base).href);
  return { undici, version: metadata.version };
}

export async function createLoopbackServer(onRequest) {
  const server = createServer(onRequest);
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      // closeAllConnections does not include upgraded sockets.
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    },
  };
}
