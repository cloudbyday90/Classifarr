/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { deflateSync, gzipSync } from 'node:zlib';
import express from 'express';
import { parserRequest, withParserServer } from '../helpers/parserHttpFixture.mjs';

const mode = process.argv[2];
assert.ok(['normal-json', 'normal-form', 'restore-json'].includes(mode));
const form = mode === 'normal-form';
const contentType = form ? 'application/x-www-form-urlencoded' : 'application/json';
const payload = Buffer.from(form ? 'value=synthetic&nested[key]=ok' : '{"value":"synthetic","nested":{"key":"ok"}}');
const expected = { value: 'synthetic', nested: { key: 'ok' } };
const app = express();
let releaseTrailing;
if (form) app.use(express.urlencoded({ extended: true }));
else app.use(express.json(mode === 'restore-json' ? { limit: '100kb' } : undefined));
app.post('/echo', (req, res) => {
  if (releaseTrailing) {
    // Wait for the actual HTTP body, not just the end of the compressed frame.
    req.once('end', () => res.json(req.body));
    releaseTrailing();
  } else res.json(req.body);
});
app.get('/health', (_req, res) => res.json({ healthy: true }));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.type }));

await withParserServer(app, async server => {
  assert.deepEqual((await parserRequest(server, { body: deflateSync(payload), encoding: 'deflate', contentType })).body, expected);
  const first = Buffer.concat([deflateSync(payload), Buffer.from([0])]);
  const remainder = Buffer.alloc(1024);
  const result = await new Promise((resolve, reject) => {
    const client = request({
      host: '127.0.0.1', port: server.address().port, path: '/echo', method: 'POST', agent: false,
      headers: { 'Content-Type': contentType, 'Content-Encoding': 'deflate', 'Content-Length': first.length + remainder.length },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    client.on('error', reject);
    client.setTimeout(2000, () => client.destroy(new Error('Trailing-byte request did not finish')));
    releaseTrailing = () => client.end(remainder);
    client.write(first);
  });
  releaseTrailing = undefined;
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.text), expected);

  // A different decoder and a corrupt frame must also remain request-scoped.
  const trailingGzip = await parserRequest(server, {
    body: Buffer.concat([gzipSync(payload), Buffer.from([0]), Buffer.alloc(100 * 1024, 88)]),
    encoding: 'gzip', contentType,
  });
  assert.equal(trailingGzip.status, 200);
  assert.deepEqual(trailingGzip.body, expected);
  const corruptGzip = await parserRequest(server, { body: Buffer.from('invalid gzip'), encoding: 'gzip', contentType });
  assert.equal(corruptGzip.status, 400);
  await delay(200);
  assert.deepEqual(await parserRequest(server, { path: '/health', method: 'GET' }), { status: 200, body: { healthy: true } });
});
// No uncaughtException handler: a decoder crash must fail the child process.
process.stdout.write(JSON.stringify({ mode, completed: true }));
