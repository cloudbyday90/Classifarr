/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, chmod } from 'node:fs/promises';
import { connect } from 'node:net';
import { createServer } from 'node:http';
import { EventEmitter } from 'node:events';
import { startApplication } from '/app/src/bootstrap/startApplication.mjs';
import { generate } from '/app/src/services/ollamaGeneration.mjs';
import { getModels } from '/app/src/services/ollamaConnection.mjs';
import { getOllamaApplicationBinding } from '/app/src/services/ollamaApplicationScope.mjs';
if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('fixture_required');
await chmod('/tmp/routing.json', 0o600);
const document = JSON.parse(await readFile('/tmp/routing.json', 'utf8'));
let owner, timer;
const listener = await startApplication({ database: {}, environment: { CLASSIFARR_OLLAMA_ROUTING_FILE: '/tmp/routing.json' },
  processRef: new EventEmitter(), onAdmissionLost() {},
  // This tests packaged composition, not another production database/worker deployment.
  acquireAdmission: async () => ({ assertHealthy() {}, release() {} }),
  loadNormal: async () => {
    owner = getOllamaApplicationBinding(); assert.ok(owner);
    const imported = await import('./networkImport.mjs');
    assert.equal(imported.importedOwner, owner); timer = imported.importedTimer;
    assert.equal((await getModels(async () => document.configuration)).length, 1);
    return { registerServerProcessHandlers() {}, async startServer() {
      const server = createServer(async (_req, res) => {
        try { res.end(await generate(async () => document.configuration, 'synthetic', 'synthetic:latest')); }
        catch { res.writeHead(503); res.end('closed'); }
      });
      await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); }); return server;
    } };
  } });
try {
  assert.equal(await timer, owner);
  const response = await fetch(`http://127.0.0.1:${listener.address().port}`, { signal: AbortSignal.timeout(10000) });
  assert.equal(await response.text(), 'synthetic');
  // A positive gateway result above proves the synthetic provider is running.
  const upstream = new URL(document.configuration.baseUrl);
  const reachable = await new Promise(resolve => {
    const socket = connect({ host: upstream.hostname, port: Number(upstream.port) });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(2500, () => finish(false));
    socket.once('connect', () => finish(true)); socket.once('error', () => finish(false));
  });
  assert.equal(reachable, false, 'application_must_not_reach_provider_directly');
} finally { listener.closeAllConnections(); await new Promise(resolve => { listener.close(resolve); }); }
assert.throws(() => owner.run(() => {}), /gateway_client_closed/);
process.stdout.write('gateway_network_tls_startup_passed direct_provider_blocked compute_calls=1\n');
