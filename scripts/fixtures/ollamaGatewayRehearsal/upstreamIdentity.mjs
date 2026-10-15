/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { spawn } from 'node:child_process';
import { readFile,writeFile,unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { gatewayPeerIdentity } from '/app/src/ollamaGateway/upstreamIdentity.mjs';

/** Real packaged gateway, TLS and PG; network-none container, synthetic inference only. */
export async function rehearseUpstreamIdentity(admin) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  const tls = JSON.parse(await readFile('/tmp/upstream-test-tls.json','utf8')),token = randomBytes(32).toString('base64url');
  const workIdentityKey = randomBytes(32).toString('base64url');
  const children = [],output = [],configPath = '/tmp/gateway-upstream-identity-private.json';
  let owner,provider,calls = 0,hold = false;
  const until = async predicate => {
    const deadline = Date.now()+15000;
    while (!await predicate()) { assert.ok(Date.now()<deadline,'upstream fixture deadline'); await delay(20); }
  };
  const kill = async child => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exit = new Promise(resolve => { child.once('exit',resolve); }); child.kill('SIGKILL'); await exit;
  };
  const launch = async () => {
    let ready = false;
    const child = spawn(process.execPath,['/app/src/scripts/runOllamaGateway.mjs'],{
      env: { PATH: process.env.PATH,CLASSIFARR_GATEWAY_CONFIG_FILE: configPath },stdio: ['ignore','pipe','pipe'] });
    children.push(child); child.stdout.on('data',chunk => { output.push(chunk); ready ||= chunk.toString().includes('ollama_gateway_ready'); });
    child.stderr.on('data',chunk => output.push(chunk)); await until(() => ready); return child;
  };
  const status = async () => {
    const response = await fetch('http://127.0.0.1:11437/gateway/status',{ headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status,200); return response.json();
  };
  const call = () => fetch('http://127.0.0.1:11437/api/generate',{ method: 'POST',headers: {
    Authorization: `Bearer ${token}`,'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'synthetic:latest',prompt: 'PRIVATE synthetic prompt',stream: false }) });
  try {
    for (const mismatch of [false,true]) {
      calls = 0; hold = false;
      const database = mismatch ? 'gateway_peer_rejected' : 'gateway_peer_interrupted';
      await admin.query(`CREATE DATABASE ${database}`); // Fixed owned names, disposable container only.
      owner = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database }); await owner.connect();
      await owner.query(await readFile('/app/database/ollama-gateway/current.sql','utf8'));
      await owner.query(`GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_runtime;
        GRANT SELECT ON ollama_gateway.admission TO gateway_fixture_runtime;
        GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
          ON ollama_gateway.admission TO gateway_fixture_runtime;
        GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt,ollama_gateway.upstream_peer_observation TO gateway_fixture_runtime`);
      provider = createServer({ cert: tls.cert,key: tls.key },async (req,res) => {
        calls++; assert.equal(req.headers.authorization,undefined);
        const observation = (await owner.query('SELECT * FROM ollama_gateway.upstream_peer_observation ORDER BY id DESC LIMIT 1')).rows[0];
        assert.equal(observation.public_key_sha256,gatewayPeerIdentity(tls.cert).publicKeySha256);
        assert.equal(observation.certificate_sha256,gatewayPeerIdentity(tls.cert).certificateSha256);
        const binding = (await owner.query('SELECT * FROM ollama_gateway.request_binding WHERE id=$1',[observation.binding_id])).rows[0];
        assert.equal(req.headers['x-classifarr-request-id'],binding.request_id);
        assert.equal(req.headers['x-classifarr-application'],'classifarr'); assert.equal(req.headers['x-classifarr-installation'],'synthetic');
        assert.match(binding.work_fingerprint,/^[a-f0-9]{64}$/); assert.equal(binding.model,'synthetic:latest');
        const parts = []; for await (const chunk of req) parts.push(chunk);
        if (hold) return;
        res.setHeader('Content-Type','application/json'); res.end('{"model":"synthetic:latest","done":true,"response":"fixture"}');
      });
      await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
      await writeFile(configPath,JSON.stringify({ database: { host: '/var/run/postgresql',user: 'gateway_fixture_runtime',database },
        gateway: { upstream: `https://127.0.0.1:${provider.address().port}`,workIdentityKey,port: 11437,models: ['synthetic:latest'],timeoutMs: 10000,queueMs: 100,
          upstreamTls: { ca: tls.cert,publicKeySha256: mismatch ? '0'.repeat(64) : gatewayPeerIdentity(tls.cert).publicKeySha256 },
          credentials: [{ installation: 'synthetic',workClass: 'background',token }] } }),{ mode: 0o600 });
      let child = await launch(); assert.equal((await status()).attempts,'0'); assert.equal(calls,0);
      if (mismatch) { assert.equal((await call()).status,503); assert.equal(calls,0); }
      else {
        assert.equal((await call()).status,200); hold = true;
        const pending = call().catch(() => null); await until(() => calls === 2);
        await until(async () => (await owner.query('SELECT count(*)::int AS n FROM ollama_gateway.upstream_peer_observation')).rows[0].n === 2);
        await kill(child); await pending;
      }
      const before = (await owner.query('SELECT * FROM ollama_gateway.admission')).rows[0];
      assert.equal(Number(before.attempts),mismatch ? 1 : 2); assert.ok(before.active_request);
      const observations = (await owner.query('SELECT *,uuid_extract_version(id) AS v FROM ollama_gateway.upstream_peer_observation ORDER BY id')).rows;
      assert.equal(observations.length,mismatch ? 0 : 2);
      for (const observation of observations) assert.equal(observation.v,7);
      await kill(child); child = await launch();
      assert.equal((await call()).status,503); assert.equal((await status()).requestId,before.active_request);
      assert.equal((await status()).attempts,String(before.attempts)); assert.equal(calls,mismatch ? 0 : 2);
      assert.deepEqual((await owner.query('SELECT *,uuid_extract_version(id) AS v FROM ollama_gateway.upstream_peer_observation ORDER BY id')).rows,observations);
      assert.equal(JSON.stringify(observations).includes('PRIVATE'),false);
      await kill(child); provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); }); provider = null;
      await owner.end(); owner = null;
    }
    assert.equal(Buffer.concat(output).toString().includes(token),false);
    assert.equal(Buffer.concat(output).toString().includes(workIdentityKey),false);
    assert.equal(Buffer.concat(output).toString().includes('PRIVATE'),false);
    process.stdout.write('gateway_upstream_identity_passed: packaged TLS pin, pre-HTTP UUIDv7 evidence, restricted runtime, SIGKILL and restart preserve uncertainty; 2 synthetic requests, 0 wrong-pin requests\n');
  } finally {
    for (const child of children) await kill(child);
    if (provider) { provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); }); }
    await owner?.end();
    await unlink(configPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
