/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Synthetic, process-isolated probe; DEBUG must be set before importing the package.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const enumerated = new WeakSet();
const observations = [];
const entries = Object.entries;
const app = express();
const respond = (req, res, status) => {
  observations.push(enumerated.has(req.rateLimit));
  res.status(status).json({ used: req.rateLimit.used, remaining: req.rateLimit.remaining });
};
app.use(rateLimit({
  windowMs: 60_000,
  limit: 1,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => respond(req, res, 429),
}));
app.get('/', (req, res) => respond(req, res, 200));
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  // Observe exact object identity only, not the package's private implementation.
  // This global observer exists solely in this disposable child process.
  Object.entries = value => {
    if (value !== null && typeof value === 'object') enumerated.add(value);
    return entries(value);
  };
  const url = `http://127.0.0.1:${server.address().port}/`;
  for (const [index, expectedStatus] of [200, 429].entries()) {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), { used: index + 1, remaining: 0 });
    assert.match(response.headers.get('ratelimit'), /remaining=0/);
    if (expectedStatus === 429) assert.ok(Number(response.headers.get('retry-after')) > 0);
  }
  process.stdout.write(`${JSON.stringify({ requests: observations.length, enumerated: observations.filter(Boolean).length })}\n`);
} finally {
  Object.entries = entries;
  const closed = new Promise(resolve => { server.close(resolve); });
  server.closeAllConnections();
  await closed;
}
