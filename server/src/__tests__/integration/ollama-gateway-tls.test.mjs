/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, afterAll, beforeEach, afterEach, test, expect } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPool } from './setup.mjs';
import { gatewayTlsFixture } from '../helpers/gatewayTlsFixture.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { createGatewayClient } from '../../ollamaGateway/client.mjs';
import { gatewayConfig } from '../../ollamaGateway/contract.mjs';
import { startApplication } from '../../bootstrap/startApplication.mjs';
import { getOllamaApplicationBinding } from '../../services/ollamaApplicationScope.mjs';
import { generate } from '../../services/ollamaGeneration.mjs';

let tls, wrong, fixture;
beforeAll(async () => { tls = await gatewayTlsFixture(); wrong = await gatewayTlsFixture('127.0.0.2'); });
afterAll(async () => { await tls?.close(); await wrong?.close(); });
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool(), tls); });
afterEach(async () => { await fixture?.close(); });
const client = overrides => createGatewayClient({ ...fixture.options(1).foreground, ...overrides }, { expectedUpstream: fixture.configuration.baseUrl });

test('HTTPS startup scopes a real listener, timer and compute; shutdown preserves uncertain attempt', async () => {
  const path = join(tls.directory, 'startup.json'), processRef = new EventEmitter();
  await writeFile(path, JSON.stringify(fixture.options(1)), { mode: 0o600 });
  let timer, owner, server;
  try {
    server = await startApplication({ database: {}, environment: { CLASSIFARR_OLLAMA_ROUTING_FILE: path }, processRef,
      onAdmissionLost() {}, acquireAdmission: async () => ({ assertHealthy() {}, release() {} }),
      loadNormal: async () => {
        owner = getOllamaApplicationBinding();
        timer = new Promise(resolve => { setTimeout(() => resolve(getOllamaApplicationBinding()), 5); });
        return { registerServerProcessHandlers() {}, async startServer() {
          const listener = createServer(async (_req, res) => {
            try { res.end(await generate(async () => fixture.configuration, 'synthetic', fixture.model)); }
            catch { res.writeHead(503); res.end('closed'); }
          });
          await new Promise(resolve => { listener.listen(0, '127.0.0.1', resolve); }); return listener;
        } };
      } });
    expect(await timer).toBe(owner);
    const url = `http://127.0.0.1:${server.address().port}`;
    expect(await (await fetch(url)).text()).toBe('answer');
    expect(await fixture.ledger.status()).toMatchObject({ attempts: '1', state: 'ready' });
    fixture.setHold(); const pending = fetch(url);
    const deadline = Date.now() + 2000;
    while (fixture.calls.filter(call => call.path === '/api/generate').length < 2) {
      if (Date.now() > deadline) throw new Error('fixture_deadline'); await delay(10);
    }
    processRef.emit('SIGTERM'); expect((await pending).status).toBe(503);
    expect((await fetch(url)).status).toBe(503);
    expect(await fixture.ledger.status()).toMatchObject({ attempts: '2', state: 'uncertain_or_active' });
    expect(fixture.calls.every(call => !call.authorization)).toBe(true);
  } finally { server?.closeAllConnections(); if (server) await new Promise(resolve => { server.close(resolve); }); }
});
test('untrusted CA never reaches handler even when ambient Node TLS verification is disabled', async () => {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const transport = client({ ca: wrong.cert });
  try { await expect(transport.request('/api/tags')).rejects.toThrow('gateway_transport_failed'); }
  finally {
    transport.close();
    if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
  }
  expect(fixture.calls).toHaveLength(0); expect(fixture.classes).toHaveLength(0);
  expect(await fixture.ledger.status()).toMatchObject({ attempts: '0' });
});
test('certificate IP identity mismatch refuses before HTTP and never downgrades', async () => {
  await fixture.close(); fixture = null;
  const { createServer: httpsServer } = await import('node:https');
  let requests = 0;
  const server = httpsServer({ cert: wrong.cert, key: wrong.key }, (_req, res) => { requests++; res.end('{}'); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  const transport = createGatewayClient({ url: `https://127.0.0.1:${server.address().port}`, upstream: 'http://127.0.0.1:11434',
    models: ['synthetic:latest'], token: 'a'.repeat(43), ca: wrong.cert }, { expectedUpstream: 'http://127.0.0.1:11434' });
  try { await expect(transport.request('/api/tags')).rejects.toThrow('gateway_transport_failed'); expect(requests).toBe(0); }
  finally { transport.close(); server.closeAllConnections(); await new Promise(resolve => { server.close(resolve); }); }
});
test.each(['http://192.168.50.95:11435', 'https://example.com', 'https://8.8.8.8', 'https://127.0.0.1/other'])('refuses unapproved destination %s', url => {
  expect(() => client({ url })).toThrow(); expect(fixture.calls).toHaveLength(0);
});
test('off-loopback HTTP listener and mismatched TLS server identity are refused', () => {
  const raw = { upstream: fixture.configuration.baseUrl, models: [fixture.model],
    credentials: [{ installation: 'test', workClass: 'foreground', token: 'a'.repeat(43) }] };
  expect(() => gatewayConfig({ ...raw, host: '10.0.0.2' })).toThrow('gateway_config_invalid');
  expect(() => gatewayConfig({ ...raw, tls: { cert: wrong.cert, key: wrong.key } })).toThrow('gateway_tls_config_invalid');
});
