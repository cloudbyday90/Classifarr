/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { once } from 'node:events';
import { request } from 'node:http';

export async function withParserServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    return await run(server);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
  }
}

// Unlike Superagent's JSON serializer, this sends the compressed bytes verbatim.
export function parserRequest(server, { body = Buffer.alloc(0), encoding = 'identity',
  contentType = 'application/json', path = '/echo', headers = {}, method = 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const client = request({
      host: '127.0.0.1', port: server.address().port, path, method, agent: false,
      headers: { 'Content-Type': contentType, 'Content-Encoding': encoding, 'Content-Length': body.length, ...headers },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
        } catch (error) { reject(error); }
      });
    });
    client.on('error', reject);
    client.setTimeout(2000, () => client.destroy(new Error('Parser HTTP fixture timed out')));
    client.end(body);
  });
}
