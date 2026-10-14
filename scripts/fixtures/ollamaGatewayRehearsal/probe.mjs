/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
// This fixture is copied to /tmp, never over packaged source/dependencies.
import pg from '/app/node_modules/pg/lib/index.js';
import { createGatewayClient } from '/app/src/ollamaGateway/client.mjs';

if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('isolated_fixture_required');
const admin = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'classifarr' });
const database = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'classifarr_gateway_fixture' });
const configFile = '/tmp/isolated-gateway-secret.json', model = 'synthetic:latest', children = [];
const credentials = [['local','foreground'],['unraid','foreground'],['local','background']].map(([installation,workClass]) =>
  ({ installation,workClass,token: randomBytes(32).toString('base64url') }));
let hold = false, calls = 0, forbiddenHeader = false, release;
const provider = createServer(async (req,res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString()); calls++; forbiddenHeader ||= Boolean(req.headers.authorization);
  if (body.stream) { res.setHeader('Content-Type','application/x-ndjson'); res.write(`${JSON.stringify({ model,done: false,response: 'partial' })}\n`); }
  const finish = () => {
    if (!body.stream) res.setHeader('Content-Type','application/json');
    res.end(`${JSON.stringify({ model,done: true,response: 'synthetic' })}${body.stream ? '\n' : ''}`);
  };
  if (hold) release = finish; else finish();
});
const until = async predicate => { const deadline = Date.now()+10000; while (!await predicate()) {
  if (Date.now()>deadline) throw new Error('fixture_deadline'); await delay(20);
} };
const base = 'http://127.0.0.1:11435';
async function status() {
  const response = await fetch(`${base}/gateway/status`,{ headers: { Authorization: `Bearer ${credentials[0].token}` } });
  assert.equal(response.status,200); return response.json();
}
const call = index => fetch(`${base}/api/generate`,{ method: 'POST',headers: {
  Authorization: `Bearer ${credentials[index].token}`,'Content-Type': 'application/json' },
body: JSON.stringify({ model,prompt: 'Synthetic only',stream: false }) });
async function launch() {
  const child = spawn(process.execPath,['/app/src/scripts/runOllamaGateway.mjs'],{ env: {
    PATH: process.env.PATH,CLASSIFARR_GATEWAY_CONFIG_FILE: configFile },stdio: ['ignore','pipe','pipe'] });
  children.push(child); let output = '';
  child.stdout.on('data',data => { output += data.toString(); }); child.stderr.resume();
  await until(() => output.includes('ollama_gateway_ready')); return child;
}
async function kill(child, signal = 'SIGKILL') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise(resolve => { child.once('exit',resolve); }); child.kill(signal); await stopped;
}
try {
  await admin.connect();
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM libraries')).rows[0].n,0);
  await admin.query('CREATE DATABASE classifarr_gateway_fixture'); // Owned, fresh, network-none fixture only.
  await admin.query('CREATE ROLE gateway_fixture_runtime LOGIN');
  await database.connect();
  await database.query(await readFile('/app/database/ollama-gateway/20261014_121441_admission.sql','utf8'));
  await database.query('GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_runtime');
  await database.query('GRANT SELECT, UPDATE ON ollama_gateway.admission TO gateway_fixture_runtime');
  await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
  const upstream = `http://127.0.0.1:${provider.address().port}`;
  const client = createGatewayClient({ url: base,upstream,models: [model],token: credentials[0].token },{ expectedUpstream: upstream });
  await writeFile(configFile,JSON.stringify({ gateway: { upstream,
    port: 11435,models: [model],credentials,timeoutMs: 10000,queueMs: 3000 },
  database: { host: '/var/run/postgresql',user: 'gateway_fixture_runtime',database: 'classifarr_gateway_fixture' } }),{ mode: 0o600 });
  let child = await launch(); assert.equal((await status()).attempts,'0'); assert.equal(calls,0);
  assert.equal((await fetch(`${base}/gateway/status`)).status,401);
  assert.equal((await call(0)).status,200); assert.equal((await call(1)).status,200);
  assert.equal((await status()).attempts,'2');
  const partials = [];
  assert.equal((await client.request('/api/generate',{ model,prompt: 'Synthetic only',stream: true },{ onRecord: async value => { partials.push(value); } })).done,true);
  assert.equal(partials.length,1); assert.equal(partials[0].done,false); assert.equal((await status()).state,'ready');
  hold = true; const active = call(2); await until(() => calls === 4);
  const queued = call(1); await until(async () => (await status()).waiting === 1);
  assert.equal((await call(2)).status,429); hold = false; release();
  assert.equal((await active).status,200); assert.equal((await queued).status,200);
  assert.equal((await status()).attempts,'5');
  await kill(child,'SIGTERM'); child = await launch(); assert.equal((await status()).attempts,'5');
  hold = true; let interruptedPartial = false;
  const interrupted = client.request('/api/generate',{ model,prompt: 'Synthetic only',stream: true },{ onRecord: async () => { interruptedPartial = true; } }).catch(error => error.code);
  await until(() => calls === 6 && interruptedPartial);
  const before = await status(); assert.match(before.requestId,/^[a-f0-9-]{14}7[a-f0-9-]{21}$/);
  await kill(child); assert.equal(await interrupted,'gateway_transport_failed'); await launch(); client.close();
  assert.equal((await status()).requestId,before.requestId); assert.equal((await status()).attempts,'6');
  assert.equal((await call(1)).status,503); assert.equal(calls,6); assert.equal(forbiddenHeader,false);
  const ids = (await database.query(`SELECT uuid_extract_version(id) AS id_version,
    uuid_extract_version(owner_id) AS owner_version, uuid_extract_version(active_request) AS request_version
    FROM ollama_gateway.admission`)).rows[0];
  assert.deepEqual(ids,{ id_version: 7,owner_version: 7,request_version: 7 });
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM task_queue WHERE task_type='classification'")).rows[0].n,0);
  process.stdout.write('gateway_packaged_rehearsal_passed: authenticated client, streaming completion, two installations, priority, UUIDv7, least-privilege database role, graceful restart, abrupt streaming death, preserved uncertainty; 6 synthetic calls\n');
} finally {
  release?.(); for (const child of children) await kill(child);
  provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
  await database.end(); await admin.end();
  await unlink(configFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
