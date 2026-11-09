/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
const mode = process.argv[2], failure = new Error('synthetic_limit_failure');
let reached = 0, errors = 0;
const config = { windowMs: 60000, limit: 1 };
if (mode === 'handler') config.handler = async () => { throw failure; };
else if (mode === 'message') config.message = async () => { throw failure; };
else if (mode === 'sync-message') config.message = () => { throw failure; };
else if (mode === 'ordinary') config.message = { error: 'synthetic_limit' };
else throw new Error('unknown_probe_mode');
const app = express();
app.get('/', rateLimit(config), (_req, res) => { reached++; res.sendStatus(204); });
app.use((error, _req, res, _next) => { assert.equal(error, failure); errors++; res.sendStatus(503); });
const server = createServer(app);
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
try {
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url, { signal: AbortSignal.timeout(1500) })).status, 204);
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, mode === 'ordinary' ? 429 : 503);
  if (mode === 'ordinary') assert.deepEqual(await response.json(), { error: 'synthetic_limit' });
  else await response.text();
  assert.equal(reached, 1); assert.equal(errors, mode === 'ordinary' ? 0 : 1);
  process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n');
} finally { server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
