/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';

/** Synthetic loopback only. With no body, hold the response until cancellation. */
export async function createIdentityHttpFixture(body = null) {
  const received = Promise.withResolvers(), disconnected = Promise.withResolvers();
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.once('close', () => disconnected.resolve());
    if (body === null) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{');
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
      response.end(gzipSync(JSON.stringify(body)));
    }
    received.resolve();
  });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    received: received.promise, disconnected: disconnected.promise,
    get requests() { return requests; },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    },
  };
}

export async function withinIdentityTestDeadline(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Identity fixture deadline exceeded')), 3000);
    })]);
  } finally { clearTimeout(timer); }
}
