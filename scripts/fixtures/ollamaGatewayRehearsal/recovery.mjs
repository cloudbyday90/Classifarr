/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { gatewayConfig } from '/app/src/ollamaGateway/contract.mjs';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { createGatewayServer } from '/app/src/ollamaGateway/server.mjs';
import { rehearseOfflineRecovery } from './offlineRecovery.mjs';

/** Fresh database, packaged code, real HTTP; hooks place revocation at exact boundaries. */
export async function rehearseCompletionRecovery(admin) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  await admin.query('CREATE DATABASE classifarr_gateway_recovery_fixture');
  const options = { host: '/var/run/postgresql',database: 'classifarr_gateway_recovery_fixture',
    user: 'gateway_fixture_runtime',query_timeout: 5000,statement_timeout: 4000 };
  const owner = new pg.Client({ ...options,user: 'classifarr' }), client = new pg.Client(options);
  const replacement = new pg.Client(options);
  let gateway, mode = 'before_dispatch', calls = 0;
  const model = 'synthetic:latest';
  const credentials = ['first','second','third'].map(installation =>
    ({ installation,workClass: 'foreground',token: randomBytes(32).toString('base64url') }));
  const provider = createServer(async (req,res) => {
    for await (const _chunk of req) { /* consume bounded fixture body */ }
    assert.equal(req.headers.authorization,undefined); calls++;
    if (mode === 'unknown') return;
    if (mode === 'overload') { res.writeHead(503); res.end('PRIVATE rejected'); return; }
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({ model,done: true,response: 'PRIVATE completed' }));
  });
  try {
    await owner.connect();
    await owner.query(await readFile('/app/database/ollama-gateway/current.sql','utf8'));
    await owner.query('GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_runtime');
    await owner.query(`GRANT SELECT ON ollama_gateway.admission TO gateway_fixture_runtime;
      GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
        ON ollama_gateway.admission TO gateway_fixture_runtime`);
    await owner.query('GRANT SELECT, INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt TO gateway_fixture_runtime');
    await client.connect();
    await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
    const raw = { upstream: `http://127.0.0.1:${provider.address().port}`,models: [model],credentials,timeoutMs: 1000,queueMs: 100 };
    const config = gatewayConfig(raw), ledger = await openGatewayLedger(client,config.providerHash);
    gateway = createGatewayServer({ config,ledger: { ...ledger,
      claim: async installation => {
        const id = await ledger.claim(installation);
        if (mode === 'before_dispatch') gateway.replaceCredentials(gatewayConfig({ ...raw,credentials: credentials.slice(1) }));
        return id;
      },complete: async (id,busy) => {
        if (mode === 'after_response') gateway.replaceCredentials(gatewayConfig({ ...raw,credentials: credentials.slice(2) }));
        await ledger.complete(id,busy);
      } } });
    await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
    const url = `http://127.0.0.1:${gateway.server.address().port}`;
    const call = index => fetch(`${url}/api/generate`,{ method: 'POST',headers: {
      Authorization: `Bearer ${credentials[index].token}`,'Content-Type': 'application/json' },
    body: JSON.stringify({ model,prompt: 'synthetic only',stream: false }) });
    assert.equal((await call(0)).status,401); assert.equal(calls,0);
    assert.equal((await ledger.status()).state,'ready'); assert.equal((await ledger.status()).attempts,'1');
    mode = 'success'; assert.equal((await call(1)).status,200); assert.equal(calls,1);
    mode = 'after_response'; const cancelled = await call(1);
    assert.equal(cancelled.status,401); assert.equal((await cancelled.text()).includes('PRIVATE'),false);
    assert.equal((await ledger.status()).state,'ready'); assert.equal((await ledger.status()).attempts,'3');
    mode = 'overload'; assert.equal((await call(2)).status,503);
    assert.equal((await ledger.status()).state,'cooldown'); assert.equal((await ledger.status()).attempts,'4');
    assert.equal((await call(2)).status,503); assert.equal(calls,3);
    // Real elapsed cooldown, no fixture UPDATE or counter reset.
    await delay(5100); mode = 'unknown'; assert.equal((await call(2)).status,503);
    const uncertain = await ledger.status(); assert.equal(uncertain.state,'uncertain_or_active');
    assert.equal(uncertain.attempts,'5'); assert.equal(calls,4);
    await gateway.stop(); await client.end(); await replacement.connect();
    const restarted = await openGatewayLedger(replacement,config.providerHash);
    assert.deepEqual(await restarted.status(),uncertain);
    await assert.rejects(restarted.claim('third'),/gateway_admission_deferred/);
    assert.equal(calls,4);
    // This server is the entire synthetic provider, has no runners/restart manager, and is fully stopped.
    await replacement.end(); provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
    await rehearseOfflineRecovery(owner,options,config.providerHash);
    assert.equal(calls,4);
    process.stdout.write('gateway_completion_recovery_passed: pre-dispatch cancellation, verified completion revocation, retained attempts, real elapsed cooldown, unknown restart fencing; 5 attempts, 4 synthetic calls\n');
  } finally {
    await gateway?.stop(); await client.end(); await replacement.end(); await owner.end();
    provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
  }
}
