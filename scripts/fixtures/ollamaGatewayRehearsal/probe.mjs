/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink, rename, chmod, symlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
// This fixture is copied to /tmp, never over packaged source/dependencies.
import pg from '/app/node_modules/pg/lib/index.js';
import { createGatewayClient } from '/app/src/ollamaGateway/client.mjs';
import { createOllamaGatewayGenerationClient } from '/app/src/services/ollamaGatewayGenerationClient.mjs';
import { createOllamaGatewayProviderContext } from '/app/src/services/ollamaGatewayProviderContext.mjs';
import { createOllamaVerificationSavedConfigurationClient } from '/app/src/services/ollamaVerificationSavedConfigurationClient.mjs';
import { probeOllamaVerificationCapability } from '/app/src/services/ollamaVerificationCapabilityProbe.mjs';
import { rehearseApplicationRouting } from './application.mjs';
import { rehearseCompletionRecovery } from './recovery.mjs';
import { rehearseProviderStop } from './providerStop.mjs';
import { rehearseUpstreamIdentity } from './upstreamIdentity.mjs';

if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('isolated_fixture_required');
const admin = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'classifarr' });
const database = new pg.Client({ host: '/var/run/postgresql',user: 'classifarr',database: 'classifarr_gateway_fixture' });
const configFile = '/tmp/isolated-gateway-secret.json', model = 'synthetic:latest', children = [], outputs = new Map();
const credentials = [['local','foreground'],['unraid','foreground'],['local','background']].map(([installation,workClass]) =>
  ({ installation,workClass,token: randomBytes(32).toString('base64url') }));
let hold = false, calls = 0, forbiddenHeader = false, release;
const provider = createServer(async (req,res) => {
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  forbiddenHeader ||= Boolean(req.headers.authorization);
  if (['/api/tags', '/api/ps'].includes(req.url)) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ models: [{ name: model,digest: 'a'.repeat(64) }] })); return; }
  if (req.url === '/api/show') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ capabilities: ['completion', 'embedding'],
    model_info: { 'general.architecture': 'test', 'test.context_length': 8192, 'test.embedding_length': 2 } })); return; }
  if (req.url === '/api/version') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ version: 'synthetic' })); return; }
  if (req.url === '/api/embed') {
    calls++; assert.equal(body.truncate,false); assert.equal(body.keep_alive,'5m');
    res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ model,embeddings: [[0,1]] })); return;
  }
  assert.equal(req.url,'/api/generate'); calls++;
  if (body.stream) { res.setHeader('Content-Type','application/x-ndjson'); res.write(`${JSON.stringify({ model,done: false,response: 'partial' })}\n`); }
  const finish = () => {
    if (!body.stream) res.setHeader('Content-Type','application/json');
    const response = body.prompt === '' ? '' : body.format ? '{"status":"ready","contract":"candidate-bound-verification"}' : 'synthetic';
    res.end(`${JSON.stringify({ model,done: true,response,done_reason: body.prompt ? 'stop' : 'load',prompt_eval_count: 1,eval_count: 1 })}${body.stream ? '\n' : ''}`);
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
  outputs.set(child,{ stdout: '',stderr: '' });
  child.stdout.on('data',data => { output += data.toString(); outputs.get(child).stdout += data.toString(); });
  child.stderr.on('data',data => { outputs.get(child).stderr += data.toString(); });
  await until(() => output.includes('ollama_gateway_ready')); return child;
}
async function kill(child, signal = 'SIGKILL') {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const stopped = new Promise(resolve => { child.once('exit',resolve); }); child.kill(signal); await stopped;
}
async function saveConfiguration(document) {
  await writeFile(`${configFile}.next`,JSON.stringify(document),{ mode: 0o600 });
  await rename(`${configFile}.next`,configFile);
}
async function reload(child) {
  const before = outputs.get(child).stdout;
  child.kill('SIGHUP'); await until(() => outputs.get(child).stdout !== before);
  assert.equal(outputs.get(child).stdout.slice(before.length),'ollama_gateway_credentials_reloaded\n');
}
async function failedReload(child) {
  child.kill('SIGHUP'); await until(() => child.exitCode !== null);
  assert.equal(child.exitCode,1); assert.equal(outputs.get(child).stderr,'ollama_gateway_reload_failed\n');
}
try {
  await admin.connect();
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM libraries')).rows[0].n,0);
  await admin.query('CREATE DATABASE classifarr_gateway_fixture'); // Owned, fresh, network-none fixture only.
  await admin.query('CREATE ROLE gateway_fixture_runtime LOGIN');
  await rehearseUpstreamIdentity(admin);
  await rehearseCompletionRecovery(admin);
  await rehearseProviderStop(admin);
  await database.connect();
  await database.query(await readFile('/app/database/ollama-gateway/current.sql','utf8'));
  await database.query('GRANT USAGE ON SCHEMA ollama_gateway TO gateway_fixture_runtime');
  await database.query(`GRANT SELECT ON ollama_gateway.admission TO gateway_fixture_runtime;
    GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
      ON ollama_gateway.admission TO gateway_fixture_runtime`);
  await database.query('GRANT SELECT, INSERT ON ollama_gateway.request_binding TO gateway_fixture_runtime');
  await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
  const upstream = `http://127.0.0.1:${provider.address().port}`;
  const client = createGatewayClient({ url: base,upstream,models: [model],token: credentials[0].token },{ expectedUpstream: upstream });
  const configuration = { gateway: { upstream,
    port: 11435,models: [model],credentials,timeoutMs: 10000,queueMs: 3000 },
  database: { host: '/var/run/postgresql',user: 'gateway_fixture_runtime',database: 'classifarr_gateway_fixture' } };
  await saveConfiguration(configuration);
  let child = await launch(); assert.equal((await status()).attempts,'0'); assert.equal(calls,0);
  assert.equal((await fetch(`${base}/gateway/status`)).status,401);
  assert.equal((await call(0)).status,200); assert.equal((await call(1)).status,200);
  assert.equal((await status()).attempts,'2');
  const partials = [];
  assert.equal((await client.request('/api/generate',{ model,prompt: 'Synthetic only',stream: true },{ onRecord: async value => { partials.push(value); } })).done,true);
  assert.equal(partials.length,1); assert.equal(partials[0].done,false); assert.equal((await status()).state,'ready');
  const gateway = { url: base,upstream,models: [model],token: credentials[0].token };
  const generation = createOllamaGatewayGenerationClient({ configuration: { baseUrl: upstream,model: 'synthetic' },gateway });
  const verification = createOllamaVerificationSavedConfigurationClient({ configuration: {
    ollama_host: upstream,ollama_model: 'synthetic' },gateway });
  try {
    assert.equal(await generation.generateWithProgress('Synthetic only','synthetic',0,null,null,{ requireDoneSignal: true,expectedModelDigest: 'a'.repeat(64) }),'partialsynthetic');
    assert.equal(await verification.getVersion(),'synthetic');
    const result = await probeOllamaVerificationCapability({ identity: { applicable: true,model: 'synthetic',configurationRevision: 1,fingerprint: 'fixture' },ollamaClient: verification });
    assert.equal(result.statusId,'verification_ready'); assert.equal(result.modelDigest,'a'.repeat(64));
  } finally { generation.close(); verification.close(); }
  assert.equal((await status()).attempts,'5');
  const context = createOllamaGatewayProviderContext({ configuration: { baseUrl: upstream,model,embeddingModel: model },gateway });
  try {
    assert.equal((await context.getModels()).length,1);
    assert.deepEqual(await context.embed('Synthetic only'),{ embedding: [0,1],dims: 2 });
    assert.deepEqual(await context.warmModel(),{ success: true,model });
    assert.deepEqual(await context.warmEmbeddingModel(),{ success: true,model });
    assert.throws(() => context.assertEndpoint('127.0.0.1',9),/gateway_provider_mismatch/);
  } finally { context.close(); }
  assert.equal((await status()).attempts,'8');
  await rehearseApplicationRouting({ gateway, backgroundToken: credentials[2].token, model });
  assert.equal((await status()).attempts,'16');
  hold = true; const active = call(2); await until(() => calls === 17);
  const queued = call(1); await until(async () => (await status()).waiting === 1);
  assert.equal((await call(2)).status,429); hold = false; release();
  assert.equal((await active).status,200); assert.equal((await queued).status,200);
  assert.equal((await status()).attempts,'18');
  const owner = (await database.query('SELECT owner_id FROM ollama_gateway.admission')).rows[0].owner_id;
  const oldToken = credentials[1].token, rotated = { ...credentials[1],token: randomBytes(32).toString('base64url') };
  configuration.gateway.credentials = [...credentials,rotated]; await saveConfiguration(configuration); await reload(child);
  const checkToken = token => fetch(`${base}/gateway/status`,{ headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await checkToken(oldToken)).status,200); assert.equal((await checkToken(rotated.token)).status,200);
  configuration.gateway.credentials = [credentials[0],rotated,credentials[2]];
  await saveConfiguration(configuration); await reload(child);
  assert.equal((await checkToken(oldToken)).status,401); assert.equal((await checkToken(rotated.token)).status,200);
  credentials[1] = rotated;
  assert.equal((await database.query('SELECT owner_id FROM ollama_gateway.admission')).rows[0].owner_id,owner);
  assert.equal((await status()).attempts,'18'); assert.equal(calls,18);
  // Actual Linux file/signal checks, not mocked Windows signal behavior.
  await chmod(configFile,0o644); await failedReload(child); await chmod(configFile,0o600); child = await launch();
  assert.equal((await checkToken(oldToken)).status,401); assert.equal((await status()).attempts,'18');
  await writeFile(configFile,'{ PRIVATE invalid configuration'); await failedReload(child);
  await saveConfiguration(configuration); child = await launch(); assert.equal((await status()).attempts,'18');
  await rename(configFile,`${configFile}.target`); await symlink(`${configFile}.target`,configFile); await failedReload(child);
  await unlink(configFile); await rename(`${configFile}.target`,configFile); child = await launch();
  await kill(child,'SIGTERM'); child = await launch(); assert.equal((await status()).attempts,'18');
  hold = true; let interruptedPartial = false;
  const interrupted = client.request('/api/generate',{ model,prompt: 'Synthetic only',stream: true },{ onRecord: async () => { interruptedPartial = true; } }).catch(error => error.code);
  await until(() => calls === 19 && interruptedPartial);
  const before = await status(); assert.match(before.requestId,/^[a-f0-9-]{14}7[a-f0-9-]{21}$/);
  await kill(child); assert.equal(await interrupted,'gateway_transport_failed'); await launch(); client.close();
  assert.equal((await status()).requestId,before.requestId); assert.equal((await status()).attempts,'19');
  assert.equal((await call(1)).status,503); assert.equal(calls,19); assert.equal(forbiddenHeader,false);
  const ids = (await database.query(`SELECT uuid_extract_version(id) AS id_version,
    uuid_extract_version(owner_id) AS owner_version, uuid_extract_version(active_request) AS request_version
    FROM ollama_gateway.admission`)).rows[0];
  assert.deepEqual(ids,{ id_version: 7,owner_version: 7,request_version: 7 });
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM task_queue WHERE task_type='classification'")).rows[0].n,0);
  for (const output of outputs.values()) for (const token of [oldToken,...credentials.map(entry => entry.token)]) {
    assert.equal(`${output.stdout}${output.stderr}`.includes(token),false);
  }
  process.stdout.write('gateway_packaged_rehearsal_passed: scoped application routing, HTTP/timer inheritance, replacement/close fencing, studies, shared provider context, embeddings, warming, credential overlap/removal, Linux SIGHUP, owner/attempt continuity, private-file/JSON/symlink failure shutdown, restart revocation, primary generation, saved verification, streaming, UUIDv7, abrupt death and preserved uncertainty; 19 synthetic calls\n');
} finally {
  release?.(); for (const child of children) await kill(child);
  provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
  await database.end(); await admin.end();
  for (const path of [configFile,`${configFile}.next`,`${configFile}.target`]) {
    await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
