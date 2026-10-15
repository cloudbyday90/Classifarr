/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { gatewayConfig } from '../../ollamaGateway/contract.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { runGatewayRecovery } from '../../ollamaGateway/recoveryRepository.mjs';
import { createGatewayServer } from '../../ollamaGateway/server.mjs';
import { createGatewayClient } from '../../ollamaGateway/client.mjs';
import { createLocalDescriptionBenchmarkClient } from '../../services/localDescriptionBenchmarkClient.mjs';
import { createLocalStudyEmbeddingClient } from '../../services/localStudyEmbeddingClient.mjs';
import { createOllamaGatewayGenerationClient } from '../../services/ollamaGatewayGenerationClient.mjs';
import { createOllamaGatewayProviderContext } from '../../services/ollamaGatewayProviderContext.mjs';
import { createAdapterMethods } from '../../services/embeddingProviderAdapters.mjs';
import { createOllamaVerificationSavedConfigurationClient } from '../../services/ollamaVerificationSavedConfigurationClient.mjs';
import { probeOllamaVerificationCapability } from '../../services/ollamaVerificationCapabilityProbe.mjs';
import { OperationController } from '../../utils/operationController.mjs';

const model = 'synthetic:latest', uuid7 = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const credentials = [ ['local','foreground'],['unraid','foreground'],['local','background'] ].map(([installation,workClass]) =>
  ({ installation,workClass,token: randomBytes(32).toString('base64url') }));
let clients, gateways, provider, config, calls, upstreamHeaders, handler, releaseHeld;
const migration = await readFile(new URL('../../../../database/ollama-gateway/current.sql',import.meta.url),'utf8');
const until = async predicate => { const end = Date.now()+3000; while (!await predicate()) { if (Date.now()>end) throw new Error('fixture_deadline'); await delay(10); } };
const rotatedConfig = entries => gatewayConfig({ upstream: config.upstream,models: [model],credentials: entries,timeoutMs: 1000,queueMs: 300 });
async function connect() { const client = await getPool().connect(); client.on('error',() => {}); clients.push(client); return client; }
async function start(override = {}) {
  const client = await connect(), ledger = await openGatewayLedger(client,config.providerHash,config.providerInstance);
  const gateway = createGatewayServer({ config,ledger: { ...ledger,...override } }); gateways.push(gateway);
  await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
  return { client,ledger,gateway,url: `http://127.0.0.1:${gateway.server.address().port}` };
}
function call(gate, index = 0, options = {}) {
  return fetch(`${gate.url}${options.path ?? '/api/generate'}`, { method: options.method ?? 'POST',
    headers: { Authorization: `Bearer ${credentials[index].token}`,'Content-Type': 'application/json',...options.headers },
    ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.body ?? { model,prompt: 'Synthetic only',stream: false }) }),
    ...(options.signal ? { signal: options.signal } : {}) });
}
beforeEach(async () => {
  clients = []; gateways = []; calls = []; upstreamHeaders = []; releaseHeld = null;
  await getPool().query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); // This suite owns its disposable database.
  await getPool().query(migration);
  handler = (_req,res,body) => res.end(JSON.stringify({ model,done: true,response: body.prompt ?? 'ok' }));
  provider = createServer(async (req,res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    calls.push(req.url); upstreamHeaders.push(req.headers); res.setHeader('Content-Type','application/json'); handler(req,res,body);
  });
  await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
  config = gatewayConfig({ upstream: `http://127.0.0.1:${provider.address().port}`,models: [model],credentials,timeoutMs: 1000,queueMs: 300 });
});
afterEach(async () => {
  releaseHeld?.();
  for (const gateway of gateways) await gateway.stop();
  for (const client of clients) client.release(true);
  provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
});
test('offline maintenance survives startup and refuses compute and provider reads without HTTP side effects', async () => {
  const old = await connect(), ledger = await openGatewayLedger(old,config.providerHash);
  await ledger.claim('local'); await old.query('SELECT pg_advisory_unlock(11435,1)');
  const recovery = await connect(), options = { providerHash: config.providerHash };
  const { expected } = await runGatewayRecovery(recovery,{ ...options,action: 'inspect' }); await delay(2);
  await runGatewayRecovery(recovery,{ ...options,action: 'acknowledge-stop',review: {
    version: 1,action: 'acknowledge-stop',expected,operatorRef: 'fixture',evidenceRef: 'synthetic-only',
    observedAt: new Date().toISOString(),assertions: { ingressIsolated: true,allProviderRunnersStopped: true,
      automaticRestartDisabled: true,administratorVerified: true } } });
  const gate = await start();
  expect((await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json())).toMatchObject({ state: 'maintenance',attempts: '1' });
  expect((await call(gate)).status).toBe(503);
  expect((await call(gate,0,{ path: '/api/ps',method: 'GET' })).status).toBe(503);
  expect(calls).toHaveLength(0);
});

test('credential rotation cancels only the removed installation waiter without an additional claim', async () => {
  const gate = await start();
  handler = (_req,res) => { releaseHeld = () => res.end(JSON.stringify({ model,done: true,response: 'done' })); };
  const active = call(gate,2); await until(() => calls.length === 1);
  const waiting = call(gate,1);
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 1);
  gate.gateway.replaceCredentials(rotatedConfig([credentials[0],credentials[2]]));
  expect((await waiting).status).toBe(503); expect((await call(gate,1)).status).toBe(401);
  releaseHeld(); expect((await active).status).toBe(200);
  expect((await gate.ledger.status()).attempts).toBe('1'); expect(calls).toHaveLength(1);
});

test.each([false,true])('active credential revocation cancels transport and preserves uncertainty (stream=%s)', async stream => {
  const gate = await start(); let disconnected = false, partial = false;
  handler = (_req,res) => {
    res.on('close',() => { disconnected = true; });
    if (stream) { res.setHeader('Content-Type','application/x-ndjson'); res.write(`${JSON.stringify({ model,done: false,response: 'partial' })}\n`); }
  };
  const client = gatewayClient(gate);
  const active = client.request('/api/generate',{ model,prompt: 'Synthetic only',stream },
    { ...(stream ? { onRecord: async () => { partial = true; } } : {}) }).catch(error => error.code);
  await until(() => calls.length === 1 && (!stream || partial));
  const before = await gate.ledger.status(); gate.gateway.replaceCredentials(rotatedConfig([credentials[1],credentials[2]]));
  expect(await active).toMatch(/^gateway_(request_rejected|transport_failed)$/); await until(() => disconnected);
  expect(await gate.ledger.status()).toEqual(before); expect((await call(gate)).status).toBe(401);
  expect((await call(gate,1)).status).toBe(503); expect(calls).toHaveLength(1); client.close();
});

test('revocation during claim safely releases the undispatched marker without refunding its attempt', async () => {
  let gate;
  gate = await start({ claim: async installation => {
    const id = await gate.ledger.claim(installation); gate.gateway.replaceCredentials(rotatedConfig([credentials[1]])); return id;
  } });
  expect((await call(gate)).status).toBe(401); expect(calls).toHaveLength(0);
  expect(await gate.ledger.status()).toMatchObject({ state: 'ready',requestId: null,attempts: '1' });
  expect((await call(gate,1)).status).toBe(200); expect(calls).toHaveLength(1);
  expect((await gate.ledger.status()).attempts).toBe('2');
});

test('failed cleanup of a cancelled undispatched claim remains uncertain', async () => {
  let gate;
  gate = await start({ claim: async installation => {
    const id = await gate.ledger.claim(installation); gate.gateway.replaceCredentials(rotatedConfig([credentials[1]])); return id;
  },complete: async () => { throw new Error('PRIVATE database failure'); } });
  const response = await call(gate); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('PRIVATE'); expect(calls).toHaveLength(0);
  expect(await gate.ledger.status()).toMatchObject({ state: 'uncertain_or_active',attempts: '1' });
  expect((await call(gate,1)).status).toBe(503); expect(calls).toHaveLength(0);
});

test.each(['buffered','stream','embed','warm','overload'])('revocation while persisting verified %s completion retains attempts without delivering success', async kind => {
  let gate;
  gate = await start({ complete: async (id,busy) => {
    gate.gateway.replaceCredentials(rotatedConfig([credentials[1]]));
    await gate.ledger.complete(id,busy);
  } });
  handler = (_req,res) => {
    if (kind === 'overload') { res.writeHead(503); res.end('PRIVATE rejected'); }
    else if (kind === 'stream') {
      res.setHeader('Content-Type','application/x-ndjson'); res.end(`${JSON.stringify({ model,done: true,response: 'PRIVATE final' })}\n`);
    } else res.end(JSON.stringify(kind === 'embed' ? { model,embeddings: [[0,1]] }
      : { model,done: true,response: kind === 'warm' ? '' : 'PRIVATE final' }));
  };
  const response = await call(gate,0,{ path: kind === 'embed' ? '/api/embed' : '/api/generate',
    body: kind === 'embed' ? { model,input: ['synthetic'],truncate: false }
      : { model,prompt: kind === 'warm' ? '' : 'synthetic',stream: kind === 'stream',keep_alive: '5m' } });
  expect(response.status).toBe(401); expect(await response.text()).not.toContain('PRIVATE'); expect(calls).toHaveLength(1);
  expect(await gate.ledger.status()).toMatchObject({ state: kind === 'overload' ? 'cooldown' : 'ready',requestId: null,attempts: '1' });
  if (kind === 'overload') { expect((await call(gate,1)).status).toBe(503); expect(calls).toHaveLength(1); }
});

test.each(['request','owner','provider'])('completion cannot clear a different %s identity', async kind => {
  const gate = await start(), original = await gate.ledger.claim('local');
  if (kind === 'request') { await gate.ledger.complete(original); await gate.ledger.claim('local'); }
  else if (kind === 'owner') await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE singleton');
  else await getPool().query('UPDATE ollama_gateway.admission SET provider_hash=$1 WHERE singleton',['f'.repeat(64)]);
  const before = (await getPool().query('SELECT active_request,attempts,completed_at,cooldown_until FROM ollama_gateway.admission')).rows[0];
  await expect(gate.ledger.complete(original)).rejects.toThrow('gateway_ledger_unavailable');
  expect((await getPool().query('SELECT active_request,attempts,completed_at,cooldown_until FROM ollama_gateway.admission')).rows[0]).toEqual(before);
  expect(calls).toHaveLength(0);
});

test('revocation during proven completion withholds response without undoing the valid ledger write', async () => {
  let gate;
  gate = await start({ complete: async (id,cooldown) => {
    await gate.ledger.complete(id,cooldown); gate.gateway.replaceCredentials(rotatedConfig([credentials[1]]));
  } });
  const response = await call(gate); expect(response.status).toBe(401); expect(await response.text()).not.toContain('Synthetic');
  expect(await gate.ledger.status()).toMatchObject({ state: 'ready',attempts: '1',requestId: null });
});

test('rotation preserves owner, cooldown and successful inspection; old token is denied after removal', async () => {
  const gate = await start(); handler = (_req,res) => { res.writeHead(503); res.end('{}'); };
  expect((await call(gate)).status).toBe(503); const before = await gate.ledger.status();
  const owner = (await getPool().query('SELECT owner_id FROM ollama_gateway.admission')).rows[0].owner_id;
  const fresh = { ...credentials[0],token: randomBytes(32).toString('base64url') };
  gate.gateway.replaceCredentials(rotatedConfig([...credentials,fresh]));
  const options = { path: '/gateway/status',method: 'GET',headers: { Authorization: `Bearer ${fresh.token}` } };
  expect((await call(gate,0,options)).status).toBe(200);
  gate.gateway.replaceCredentials(rotatedConfig([fresh,credentials[1]]));
  expect((await call(gate,0,{ path: '/gateway/status',method: 'GET' })).status).toBe(401);
  expect((await call(gate,0,options)).status).toBe(200); expect(await gate.ledger.status()).toEqual(before);
  expect((await getPool().query('SELECT owner_id FROM ollama_gateway.admission')).rows[0].owner_id).toBe(owner);
  expect(calls).toHaveLength(1);
});

test('revoked inspection disconnects without claiming compute', async () => {
  let disconnected = false; handler = (_req,res) => { res.on('close',() => { disconnected = true; }); };
  const gate = await start(), active = call(gate,0,{ path: '/api/tags',method: 'GET' }); await until(() => calls.length === 1);
  gate.gateway.replaceCredentials(rotatedConfig([credentials[1]]));
  expect((await active).status).toBe(503); await until(() => disconnected);
  expect(await gate.ledger.status()).toMatchObject({ state: 'ready',attempts: '0',requestId: null });
});

test('revocation interrupts incomplete body intake before admission', async () => {
  const gate = await start();
  const received = new Promise(resolve => { gate.gateway.server.once('request',resolve); });
  let req;
  const response = new Promise((resolve,reject) => {
    req = request(`${gate.url}/api/generate`,{ method: 'POST',headers: { Authorization: `Bearer ${credentials[0].token}`,
      'Content-Type': 'application/json','Content-Length': 100 } },res => {
      res.resume(); res.on('end',() => resolve(res.statusCode)); res.on('error',reject);
    });
    req.on('error',reject); req.flushHeaders();
  });
  try {
    await received; gate.gateway.replaceCredentials(rotatedConfig([credentials[1]]));
    expect(await response).toBe(503); expect(calls).toHaveLength(0);
    expect((await gate.ledger.status()).attempts).toBe('0');
  } finally { req.destroy(); }
});

test('overlapping tokens retain one queue slot per installation and completed scopes are released', async () => {
  const gate = await start();
  for (let i = 0; i < 36; i++) expect((await call(gate,0,{ path: '/gateway/status',method: 'GET' })).status).toBe(200);
  const fresh = { ...credentials[1],token: randomBytes(32).toString('base64url') };
  gate.gateway.replaceCredentials(rotatedConfig([...credentials,fresh]));
  handler = (_req,res) => { releaseHeld = () => res.end(JSON.stringify({ model,done: true,response: 'done' })); };
  const active = call(gate,2); await until(() => calls.length === 1);
  const waiting = call(gate,1);
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 1);
  expect((await call(gate,1,{ headers: { Authorization: `Bearer ${fresh.token}` } })).status).toBe(429);
  gate.gateway.replaceCredentials(rotatedConfig([credentials[0],credentials[2],fresh]));
  expect((await waiting).status).toBe(503); releaseHeld(); expect((await active).status).toBe(200);
  expect((await gate.ledger.status()).attempts).toBe('1'); expect(calls).toHaveLength(1);
});

test('UUIDv7 schema, safe status reads and two installations share one durable attempt ledger', async () => {
  const gate = await start();
  expect((await call(gate,0,{ path: '/gateway/status',method: 'GET' })).status).toBe(200); expect(calls).toEqual([]);
  expect((await call(gate)).status).toBe(200); expect((await call(gate,1)).status).toBe(200);
  expect((await gate.ledger.status()).attempts).toBe('2');
  const row = (await getPool().query('SELECT *, uuid_extract_timestamp(id) > now()-interval \'1 minute\' AS recent FROM ollama_gateway.admission')).rows[0];
  expect(row.id).toMatch(uuid7); expect(row.owner_id).toMatch(uuid7); expect(row.recent).toBe(true); expect(row.active_request).toBeNull();
  expect(upstreamHeaders.every(headers => !headers.authorization)).toBe(true);
  await expect(getPool().query('UPDATE ollama_gateway.admission SET id=uuidv4()')).rejects.toMatchObject({ code: '23514' });
  await expect(getPool().query('INSERT INTO ollama_gateway.admission(version) VALUES(5)')).rejects.toMatchObject({ code: '23505' });
});
test('authentication and strict paths/bodies reject work before upstream or reservation', async () => {
  const gate = await start();
  expect((await call(gate,0,{ headers: { Authorization: 'Bearer invalid' } })).status).toBe(401);
  expect((await call(gate,0,{ path: '/api/generate?target=elsewhere' })).status).toBe(404);
  expect((await call(gate,0,{ path: '/api/pull' })).status).toBe(404);
  expect((await call(gate,0,{ body: { model,prompt: 'x',stream: 'true' } })).status).toBe(400);
  expect((await call(gate,0,{ body: { model,prompt: 'x'.repeat(270000),stream: false } })).status).toBe(413);
  expect((await gate.ledger.status()).attempts).toBe('0'); expect(calls).toHaveLength(0);
});
test('queued foreground precedes new background; queue rejects repeated installation', async () => {
  const gate = await start(); let entered = 0;
  handler = (_req,res) => { entered++; if (entered === 1) releaseHeld = () => res.end(JSON.stringify({ model,done: true,response: 'first' }));
    else res.end(JSON.stringify({ model,done: true,response: 'second' })); };
  const active = call(gate,2); await until(() => calls.length === 1);
  const waiting = call(gate,1); await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 1);
  expect((await call(gate,1)).status).toBe(429); expect((await call(gate,2)).status).toBe(429);
  releaseHeld(); expect((await active).status).toBe(200); expect((await waiting).status).toBe(200);
  expect(calls).toHaveLength(2); expect((await gate.ledger.status()).attempts).toBe('2');
});
test('queued disconnect has no upstream effect and active cancellation remains uncertain across gateway recreation', async () => {
  let disconnected = false;
  handler = (_req,res) => { res.on('close',() => { disconnected = true; }); };
  const gate = await start(), activeAbort = new AbortController(), queueAbort = new AbortController();
  const active = call(gate,0,{ signal: activeAbort.signal }).catch(() => null); await until(() => calls.length === 1);
  const pending = call(gate,1,{ signal: queueAbort.signal }).catch(() => null);
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 1);
  queueAbort.abort(); await pending;
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 0);
  activeAbort.abort(); await active; await until(() => disconnected);
  const status = await gate.ledger.status(); expect(status.requestId).toMatch(uuid7); expect(status.attempts).toBe('1');
  await gate.gateway.stop(); gate.client.release(true); clients.splice(clients.indexOf(gate.client),1);
  const replacement = await start();
  expect(await replacement.ledger.status()).toMatchObject(status);
  expect((await call(replacement)).status).toBe(503); expect(calls).toHaveLength(1);
});
test.each(['malformed','truncated','redirect','oversized','timeout'])('unknown %s outcome is never retried or expired', async kind => {
  handler = (_req,res) => {
    if (kind === 'timeout') return;
    if (kind === 'redirect') { res.writeHead(302,{ Location: 'http://127.0.0.1:1/private' }); res.end(); }
    else if (kind === 'oversized') res.end('x'.repeat(1024*1024+1));
    else if (kind === 'truncated') { res.writeHead(200,{ 'Content-Length': '9999' }); res.end('{}'); }
    else res.end(JSON.stringify({ model,done: false,response: 'incomplete' }));
  };
  const gate = await start(); expect((await call(gate)).status).toBe(503);
  const status = await gate.ledger.status(); expect(status.state).toBe('uncertain_or_active'); expect(status.attempts).toBe('1');
  expect((await call(gate)).status).toBe(503); expect(calls).toHaveLength(1);
});
test('completed overload persists cooldown and sanitizes errors without holding an uncertain request', async () => {
  handler = (_req,res) => { res.writeHead(503); res.end(JSON.stringify({ error: 'PRIVATE provider message' })); };
  const gate = await start(), response = await call(gate);
  expect(response.status).toBe(503); expect(response.headers.get('retry-after')).toBe('5'); expect(await response.text()).not.toContain('PRIVATE');
  const status = await gate.ledger.status(); expect(status).toMatchObject({ state: 'cooldown',requestId: null,attempts: '1' });
  await gate.gateway.stop(); gate.client.release(true); clients.splice(clients.indexOf(gate.client),1);
  const replacement = await start(); expect((await replacement.ledger.status()).cooldownUntil).toEqual(status.cooldownUntil);
  expect((await call(replacement)).status).toBe(503); expect(calls).toHaveLength(1);
});
test('lost completion write leaves durable uncertainty even after a terminal provider response', async () => {
  const gate = await start({ complete: async () => { throw new Error('PRIVATE database failure'); } });
  expect((await call(gate)).status).toBe(503); expect((await gate.ledger.status()).state).toBe('uncertain_or_active');
  expect((await call(gate)).status).toBe(503); expect(calls).toHaveLength(1);
});
test('single active gateway, changed provider and missing ledger fail closed', async () => {
  const gate = await start(), competitor = await connect();
  await expect(openGatewayLedger(competitor,config.providerHash)).rejects.toThrow('gateway_already_running');
  await gate.gateway.stop(); gate.client.release(true); clients.splice(clients.indexOf(gate.client),1);
  await until(async () => (await competitor.query('SELECT pg_try_advisory_lock(11435,1) AS ok')).rows[0].ok);
  await expect(openGatewayLedger(competitor,'f'.repeat(64))).rejects.toThrow('gateway_ledger_unavailable');
  await getPool().query('DELETE FROM ollama_gateway.admission');
  await expect(openGatewayLedger(competitor,config.providerHash)).rejects.toThrow('gateway_ledger_unavailable');
  expect(calls).toHaveLength(0);
});
test('ledger refuses concurrent claims; UUIDv7 request and attempts survive owner replacement', async () => {
  const gate = await start();
  const results = await Promise.allSettled([gate.ledger.claim('local'),gate.ledger.claim('unraid')]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(result => result.status === 'fulfilled').value).toMatch(uuid7);
  expect((await gate.ledger.status()).attempts).toBe('1'); expect(calls).toHaveLength(0);
});
test('inspection is bounded and embeds validate their terminal batch', async () => {
  handler = (req,res) => res.end(JSON.stringify(req.url === '/api/embed' ? { model,embeddings: [[0,1]] } : { models: [] }));
  const gate = await start();
  expect((await call(gate,0,{ path: '/api/tags',method: 'GET' })).status).toBe(200);
  expect((await gate.ledger.status()).attempts).toBe('0');
  expect((await call(gate,0,{ path: '/api/embed',body: { model,input: ['synthetic'] } })).status).toBe(200);
  expect((await gate.ledger.status()).attempts).toBe('1');
});

test('loss of the dedicated database session never grants another compute request', async () => {
  const gate = await start();
  handler = (_req,res) => { releaseHeld = () => res.end(JSON.stringify({ model,done: true,response: 'done' })); };
  const active = call(gate); await until(() => calls.length === 1);
  await getPool().query('SELECT pg_terminate_backend($1)',[gate.client.processID]);
  await until(async () => { try { await gate.ledger.status(); return false; } catch { return true; } });
  releaseHeld(); expect((await active).status).toBe(503);
  expect((await call(gate)).status).toBe(503); expect(calls).toHaveLength(1);
  expect((await getPool().query('SELECT active_request FROM ollama_gateway.admission')).rows[0].active_request).toMatch(uuid7);
});

test('standalone CLI survives abrupt process death without clearing an admitted request', async () => {
  const directory = await mkdtemp(join(tmpdir(),'classifarr-gateway-test-'));
  const children = [];
  const portProbe = createServer(); await new Promise(resolve => { portProbe.listen(0,'127.0.0.1',resolve); });
  const port = portProbe.address().port; await new Promise(resolve => { portProbe.close(resolve); });
  const options = getPool().options;
  // Only the integration runner's randomly named disposable database is eligible.
  expect(options.database).toMatch(/^classifarr_suite_[a-f0-9]+$/);
  const configFile = join(directory,'config.json');
  await writeFile(configFile,JSON.stringify({ gateway: { upstream: config.upstream,models: [model],credentials,port,
    timeoutMs: 10000,queueMs: 100 },database: { host: options.host,port: options.port,database: options.database,
    user: options.user,password: options.password } }),{ mode: 0o600 });
  async function launch() {
    const child = spawn(process.execPath,[fileURLToPath(new URL('../../scripts/runOllamaGateway.mjs',import.meta.url))],{
      windowsHide: true,env: { ...process.env,CLASSIFARR_GATEWAY_CONFIG_FILE: configFile },stdio: ['ignore','pipe','pipe'] });
    children.push(child);
    let output = ''; child.stdout.on('data',data => { output += data.toString(); }); child.stderr.resume();
    await until(() => output.includes('ollama_gateway_ready'));
    return child;
  }
  async function kill(child) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const done = new Promise(resolve => { child.once('exit',resolve); }); child.kill('SIGKILL'); await done;
  }
  try {
    handler = () => {}; const child = await launch(), gate = { url: `http://127.0.0.1:${port}` };
    const active = call(gate).catch(() => null); await until(() => calls.length === 1);
    const before = (await getPool().query('SELECT active_request,attempts FROM ollama_gateway.admission')).rows[0];
    expect(before.active_request).toMatch(uuid7);
    await kill(child); await active; await launch();
    expect((await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).requestId).toBe(before.active_request);
    expect((await call(gate)).status).toBe(503); expect(calls).toHaveLength(1);
    expect((await getPool().query('SELECT active_request,attempts FROM ollama_gateway.admission')).rows[0]).toEqual(before);
  } finally { for (const child of children) await kill(child); await rm(directory,{ recursive: true,force: true }); }
});

function gatewayClient(gate, index = 0) {
  return createGatewayClient({ url: gate.url,upstream: config.upstream,models: [model],token: credentials[index].token },{ expectedUpstream: config.upstream });
}
function streamPart(res, extra = {}) {
  res.write(`${JSON.stringify({ model,response: '',done: false,...extra })}\n`);
}

function generationClient(gate, saved = false, overrides = {}) {
  const gateway = { url: gate.url, upstream: config.upstream, models: [model], token: credentials[0].token, ...overrides };
  const port = Number(new URL(config.upstream).port);
  return saved ? createOllamaVerificationSavedConfigurationClient({
    configuration: { ollama_host: '127.0.0.1', ollama_port: port, ollama_model: 'synthetic' }, gateway,
  }) : createOllamaGatewayGenerationClient({ configuration: { host: '127.0.0.1', port, baseUrl: config.upstream, model: 'synthetic' }, gateway });
}
const digest = 'a'.repeat(64);
function generationProvider(generateHandler) {
  handler = (req,res,body) => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: model, digest }] }));
    if (req.url === '/api/version') return res.end(JSON.stringify({ version: 'synthetic' }));
    return generateHandler(req,res,body);
  };
}

function providerContext(gate) {
  return createOllamaGatewayProviderContext({ configuration: { baseUrl: config.upstream, model, embeddingModel: model },
    gateway: { url: gate.url, upstream: config.upstream, models: [model], token: credentials[0].token } });
}

test('one provider context coordinates generation, adapter embeddings, inspection and both warming operations', async () => {
  const bodies = [];
  generationProvider((req,res,body) => {
    bodies.push(body);
    const data = req.url === '/api/ps' ? { models: [{ name: model }] }
      : req.url === '/api/show' ? { capabilities: ['embedding', 'completion'] }
        : req.url === '/api/embed' ? { model, embeddings: [[0, 1]] } : { model, done: true, response: body.prompt === '' ? '' : 'ok' };
    res.end(JSON.stringify(data));
  });
  const gate = await start(), context = providerContext(gate);
  const directForbidden = () => { throw new Error('direct_or_retry_path_forbidden'); };
  const adapter = createAdapterMethods({ getAdaptiveTimeout: directForbidden, createRetriedOperation: directForbidden,
    recordRetry: directForbidden, ollamaProviderContext: context });
  try {
    expect(await context.getVersion()).toBe('synthetic');
    expect(await context.getModels()).toEqual([{ name: model, digest }]);
    expect(await context.getLoadedModels()).toEqual([{ name: model }]);
    expect(await context.getModelInfo()).toEqual({ capabilities: ['embedding', 'completion'] });
    expect((await gate.ledger.status()).attempts).toBe('0');
    expect(await context.generate('synthetic')).toBe('ok');
    expect(await adapter.getOllamaEmbedding('synthetic', '127.0.0.1', Number(new URL(config.upstream).port), model, {}))
      .toEqual({ embedding: [0, 1], dims: 2, provider: 'ollama', model, cost: 0 });
    expect(await context.warmModel()).toEqual({ success: true, model });
    expect(await context.warmEmbeddingModel()).toEqual({ success: true, model });
    expect(await gate.ledger.status()).toMatchObject({ attempts: '4', state: 'ready', requestId: null });
    expect(bodies.filter(body => body.input).every(body => body.truncate === false && body.keep_alive === '5m')).toBe(true);
    expect(upstreamHeaders.every(headers => !headers.authorization)).toBe(true);
    const before = calls.length;
    await expect(adapter.getOllamaEmbedding('synthetic', '127.0.0.1', 9, model, {})).rejects.toMatchObject({ code: 'gateway_provider_mismatch' });
    expect(calls).toHaveLength(before);
  } finally { context.close(); }
});

test.each(['embed', 'warmModel', 'warmEmbeddingModel'])('missing model refuses %s before admission without pull or retry', async method => {
  handler = (_req,res) => res.end(JSON.stringify({ models: [] }));
  const gate = await start(), context = providerContext(gate);
  try {
    await expect(context[method](...(method === 'embed' ? ['synthetic'] : []))).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    expect(calls).toEqual(['/api/tags']); expect((await gate.ledger.status()).attempts).toBe('0');
  } finally { context.close(); }
});

test.each([{ response: 'unexpected' }, { done_reason: 'unload' }, { done: false }, { thinking: 'unexpected' }])('malformed warm completion retains uncertainty (%j)', async invalid => {
  generationProvider((_req,res) => res.end(JSON.stringify({ model, done: true, response: '', ...invalid })));
  const gate = await start(), context = providerContext(gate);
  try {
    await expect(context.warmModel()).rejects.toMatchObject({ code: 'gateway_request_rejected' });
    expect(await gate.ledger.status()).toMatchObject({ state: 'uncertain_or_active', attempts: '1' });
    expect((await call(gate,1)).status).toBe(503);
    expect(calls).toEqual(['/api/tags', '/api/generate']);
  } finally { context.close(); }
});

test.each([[[0, 0]], [[1e100]], [[1e-100]], [[1, 2], [1]]].map(value => [value]))('invalid float32 or mixed-dimension embedding cannot clear admission (%j)', async embeddings => {
  handler = (_req,res) => res.end(JSON.stringify({ model, embeddings }));
  const gate = await start();
  expect((await call(gate,0,{ path: '/api/embed', body: { model, input: embeddings.map(() => 'synthetic') } })).status).toBe(503);
  expect(await gate.ledger.status()).toMatchObject({ state: 'uncertain_or_active', attempts: '1' });
});

test('context close cancels active embedding and inspection together without admitting queued warming', async () => {
  let disconnected = 0;
  generationProvider((_req,res) => { res.on('close', () => { disconnected++; }); });
  const gate = await start(), context = providerContext(gate);
  const active = context.embed('synthetic').catch(error => error.code);
  await until(() => calls.includes('/api/embed'));
  const before = await gate.ledger.status();
  const inspection = context.getLoadedModels().catch(error => error.code);
  const warm = context.warmModel().catch(error => error.code);
  await until(async () => calls.includes('/api/ps') && (await (await call(gate,0,{ path: '/gateway/status', method: 'GET' })).json()).waiting === 1);
  context.close();
  expect(await active).toBe('gateway_cancelled'); expect(await inspection).toBe('gateway_cancelled'); expect(await warm).toBe('gateway_cancelled');
  await until(() => disconnected === 2);
  expect(await gate.ledger.status()).toEqual(before);
  expect(calls.filter(path => path === '/api/generate')).toHaveLength(0);
  await expect(context.embed('later')).rejects.toMatchObject({ code: 'gateway_client_closed' });
});

test('all context inspections share the 32-request client bound', async () => {
  handler = () => {};
  const gate = await start(), context = providerContext(gate);
  const pending = Array.from({ length: 32 }, (_, index) => (index % 2 ? context.getModels() : context.getLoadedModels()).catch(error => error.code));
  await expect(context.getVersion()).rejects.toMatchObject({ code: 'gateway_busy' });
  context.close(); expect(await Promise.all(pending)).toEqual(Array(32).fill('gateway_cancelled'));
  expect((await gate.ledger.status()).attempts).toBe('0');
});

test('generation and embedding model roles remain distinct through the same gateway', async () => {
  const vectorModel = 'synthetic-vectors:latest';
  config = gatewayConfig({ upstream: config.upstream, models: [model, vectorModel], credentials, timeoutMs: 1000, queueMs: 300 });
  handler = (req,res,body) => res.end(JSON.stringify(req.url === '/api/tags' ? { models: [{ name: model, digest }, { name: vectorModel, digest }] }
    : req.url === '/api/embed' ? { model: body.model, embeddings: [[0, 1]] } : { model: body.model, done: true, response: '' }));
  const gate = await start(), context = createOllamaGatewayProviderContext({ configuration: { baseUrl: config.upstream, model, embeddingModel: vectorModel },
    gateway: { url: gate.url, upstream: config.upstream, models: [model, vectorModel], token: credentials[0].token } });
  try {
    expect(await context.embed('synthetic')).toEqual({ embedding: [0, 1], dims: 2 });
    expect(await context.warmModel()).toEqual({ success: true, model });
    await expect(context.generate('synthetic', vectorModel)).rejects.toMatchObject({ code: 'gateway_model_mismatch' });
    await expect(context.embed('synthetic', model)).rejects.toMatchObject({ code: 'gateway_model_mismatch' });
    expect(await gate.ledger.status()).toMatchObject({ state: 'ready', attempts: '2' });
  } finally { context.close(); }
});

test('gateway embedding refusal is not retried by the existing direct-provider adapter', async () => {
  generationProvider((_req,res) => { res.writeHead(503); res.end('{}'); });
  const gate = await start(), context = providerContext(gate);
  const forbidden = () => { throw new Error('direct_retry_forbidden'); };
  const adapter = createAdapterMethods({ getAdaptiveTimeout: forbidden, createRetriedOperation: forbidden, recordRetry: forbidden, ollamaProviderContext: context });
  try {
    await expect(adapter.getOllamaEmbedding('synthetic', null, null, model, { max_retries: 3 })).rejects.toMatchObject({ code: 'gateway_request_rejected', status: 503 });
    expect(calls).toEqual(['/api/tags', '/api/embed']);
    expect(await gate.ledger.status()).toMatchObject({ attempts: '1', state: 'cooldown' });
  } finally { context.close(); }
});

test('actual generation leaves and saved verification probe use the bound gateway with exact model and schema', async () => {
  const gate = await start(), client = generationClient(gate), saved = generationClient(gate,true), bodies = [];
  generationProvider((_req,res,body) => {
    bodies.push(body);
    if (body.stream) {
      res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'part' });
      streamPart(res,{ done: true,response: 'final' }); res.end();
    } else res.end(JSON.stringify({ model,done: true,response: '{"status":"ready","contract":"candidate-bound-verification"}' }));
  });
  try {
    const progress = [];
    expect(await client.generateWithProgress('synthetic','synthetic',0.3,(count,done) => progress.push([count,done]),null,
      { requireDoneSignal: true,expectedModelDigest: digest,think: 'low' })).toBe('partfinal');
    expect(progress).toEqual([[1,false],[2,false],[2,true]]);
    expect(await saved.getVersion()).toBe('synthetic');
    const outcome = await probeOllamaVerificationCapability({ identity: { applicable: true,model: 'synthetic',configurationRevision: 1,fingerprint: 'fixture' },ollamaClient: saved });
    expect(outcome.statusId).toBe('verification_ready'); expect(outcome.modelDigest).toBe(digest);
    expect(bodies).toHaveLength(2); expect(bodies[0].think).toBe('low'); expect(bodies[1]).toMatchObject({ model,think: false,format: { type: 'object' },options: { temperature: 0 } });
    expect((await gate.ledger.status()).attempts).toBe('2'); expect((await gate.ledger.status()).state).toBe('ready');
    expect(upstreamHeaders.every(headers => !headers.authorization)).toBe(true);
  } finally { client.close(); saved.close(); }
});

test('gateway preflight has no stale success, tag-prefix match, override or direct fallback', async () => {
  const gate = await start(), client = generationClient(gate);
  generationProvider(() => { throw new Error('unexpected_compute'); });
  await expect(client.preflightConnection({ host: 'forbidden.invalid',port: 1,expectedModelDigest: digest })).rejects.toMatchObject({ code: 'gateway_provider_mismatch' });
  for (const models of [[{ name: 'synthetic:other',digest }],[{ name: model,digest: 'b'.repeat(64) }],
    [{ name: model,digest },{ name: model,digest }]]) {
    handler = (_req,res) => res.end(JSON.stringify({ models }));
    await expect(client.generate('test','synthetic',0,{ expectedModelDigest: digest })).rejects.toThrow('Gateway model identity');
  }
  await expect(client.generate('test','other:latest')).rejects.toMatchObject({ code: 'gateway_model_mismatch' });
  expect(calls.every(path => path === '/api/tags')).toBe(true); expect((await gate.ledger.status()).attempts).toBe('0');
  client.close(); const before = calls.length;
  await expect(client.preflightConnection()).rejects.toMatchObject({ code: 'gateway_client_closed' });
  const invalid = generationClient(gate,false,{ token: randomBytes(32).toString('base64url') });
  await expect(invalid.generate('test')).rejects.toMatchObject({ status: 401 }); invalid.close();
  expect(calls).toHaveLength(before);
});

test.each([false,true])('caller cancellation with strict=%s preserves unknown ownership and never emits completion', async strict => {
  const gate = await start(), client = generationClient(gate), abort = new AbortController(), progress = [];
  generationProvider((_req,res) => { res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'partial' }); });
  const pending = client.generateWithProgress('test',model,0,(count,done) => { progress.push(done); abort.abort(); },null,
    { requireDoneSignal: strict,allowPartialOnAbort: true,signal: abort.signal });
  if (strict) await expect(pending).rejects.toMatchObject({ name: 'AbortError' }); else expect(await pending).toBe('partial');
  expect(progress).toEqual([false]); expect((await gate.ledger.status()).attempts).toBe('1');
  expect((await gate.ledger.status()).state).toBe('uncertain_or_active'); client.close();
});

test.each([false,true])('stall with strict=%s cancels transport; no early partial can bypass strict completion', async strict => {
  const gate = await start(), client = generationClient(gate); let disconnected = false;
  generationProvider((_req,res) => {
    res.on('close',() => { disconnected = true; });
    res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'partial' });
  });
  const pending = client.generateWithProgress('test',model,0,null,null,
    { requireDoneSignal: strict,allowPartialOnStall: true,heartbeatTimeout: 20,initialTimeout: 500,hardTimeout: 800 });
  if (strict) await expect(pending).rejects.toMatchObject({ code: 'ESTALL' }); else expect(await pending).toBe('partial');
  await until(() => disconnected); expect((await gate.ledger.status()).state).toBe('uncertain_or_active');
  expect((await gate.ledger.status()).attempts).toBe('1'); client.close();
});

test.each(['broken','lost_write','close','hard_timeout'])('generation %s cannot masquerade as permitted partial success', async failure => {
  const gate = await start(failure === 'lost_write' ? { complete: async () => { throw new Error('PRIVATE'); } } : {});
  const client = generationClient(gate);
  generationProvider((_req,res) => {
    res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'partial' });
    if (failure === 'broken') res.end();
    if (failure === 'lost_write') { streamPart(res,{ done: true }); res.end(); }
  });
  const progress = [];
  await expect(client.generateWithProgress('test',model,0,(_count,done) => {
    progress.push(done); if (failure === 'close') client.close();
  },null,{ hardTimeout: 200 })).rejects.toThrow();
  expect(progress).not.toContain(true); expect((await gate.ledger.status()).state).toBe('uncertain_or_active');
  expect((await gate.ledger.status()).attempts).toBe('1'); client.close();
});

test('preflight cancellation and strict external-controller refusal perform no compute', async () => {
  const gate = await start(), client = generationClient(gate), abort = new AbortController(); abort.abort();
  await expect(client.generate('test',model,0,{ signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  await expect(client.generateWithProgress('test',model,0,null,new OperationController(),{ requireDoneSignal: true }))
    .rejects.toThrow('Gateway generation requires an external controller that rejects partial stalls');
  expect(calls).toHaveLength(0); expect((await gate.ledger.status()).attempts).toBe('0'); client.close();
});

test('cancellation during preflight stops inspection without reserving compute', async () => {
  const gate = await start(), client = generationClient(gate), abort = new AbortController(); let disconnected = false;
  handler = (_req,res) => { res.on('close',() => { disconnected = true; }); };
  const pending = expect(client.generateWithProgress('test',model,0,null,null,{ signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  await until(() => calls.length === 1); abort.abort(); await pending; await until(() => disconnected);
  expect(calls).toEqual(['/api/tags']); expect((await gate.ledger.status()).attempts).toBe('0'); client.close();
});

test('queued primary generation cancellation leaves only the already-dispatched background attempt', async () => {
  const gate = await start(), client = generationClient(gate), abort = new AbortController();
  generationProvider((_req,res) => { releaseHeld = () => res.end(JSON.stringify({ model,done: true,response: 'done' })); });
  const active = call(gate,2); await until(() => calls.length === 1);
  const pending = expect(client.generateWithProgress('test',model,0,null,null,{ signal: abort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 1);
  abort.abort(); await pending;
  await until(async () => (await (await call(gate,0,{ path: '/gateway/status',method: 'GET' })).json()).waiting === 0);
  releaseHeld(); expect((await active).status).toBe(200); expect(calls.filter(path => path === '/api/generate')).toHaveLength(1);
  expect((await gate.ledger.status()).attempts).toBe('1'); expect((await gate.ledger.status()).state).toBe('ready'); client.close();
});
test('streaming client sees partial progress, but final follows clean EOF and persisted completion', async () => {
  let releaseCompletion, receivedPartial = false;
  const realClient = await connect(), realLedger = await openGatewayLedger(realClient,config.providerHash);
  // Use the real owned ledger while deliberately holding only its completion call.
  const gateway = createGatewayServer({ config,ledger: { ...realLedger,complete: async (...args) => {
    await new Promise(resolve => { releaseCompletion = resolve; }); await realLedger.complete(...args);
  } } }); gateways.push(gateway);
  await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
  const gate = { url: `http://127.0.0.1:${gateway.server.address().port}` }, client = gatewayClient(gate);
  handler = (_req,res) => {
    res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'partial' });
    streamPart(res,{ done: true,eval_count: 1 }); releaseHeld = () => res.end();
  };
  let completed = false;
  const result = client.request('/api/generate',{ model,prompt: 'test',stream: true },{ onRecord: async () => { receivedPartial = true; } })
    .then(data => { completed = true; return data; });
  await until(() => receivedPartial); expect(completed).toBe(false);
  expect((await realLedger.status()).state).toBe('uncertain_or_active');
  releaseHeld(); await until(() => Boolean(releaseCompletion)); expect(completed).toBe(false);
  releaseCompletion(); expect(await result).toMatchObject({ done: true,eval_count: 1 });
  expect((await realLedger.status()).state).toBe('ready'); expect(calls).toHaveLength(1); client.close();
});
test.each(['missing_final','after_final','malformed','oversized','truncated','timeout','lost_write'])('stream %s never forwards successful completion or retries', async failure => {
  const gate = await start(failure === 'lost_write' ? { complete: async () => { throw new Error('PRIVATE'); } } : {}), client = gatewayClient(gate);
  handler = (_req,res) => {
    res.setHeader('Content-Type','application/x-ndjson');
    if (failure === 'truncated') res.setHeader('Content-Length','999999');
    streamPart(res,{ response: 'partial' });
    if (failure === 'timeout') return;
    if (failure === 'malformed') res.write('PRIVATE invalid JSON\n');
    else if (failure === 'oversized') streamPart(res,{ response: 'x'.repeat(65537) });
    else if (failure !== 'missing_final') streamPart(res,{ done: true });
    if (failure === 'after_final') streamPart(res);
    res.end();
  };
  const seen = [];
  await expect(client.request('/api/generate',{ model,prompt: 'test',stream: true },{ onRecord: async value => { seen.push(value); } })).rejects.toThrow('gateway_transport_failed');
  expect(seen.some(value => value.done)).toBe(false); expect((await gate.ledger.status()).state).toBe('uncertain_or_active');
  expect((await call(gate)).status).toBe(503); expect(calls).toHaveLength(1); client.close();
});
test('client close cancels streaming and restart preserves the unknown request', async () => {
  const gate = await start(), client = gatewayClient(gate); let partial = false;
  handler = (_req,res) => { res.setHeader('Content-Type','application/x-ndjson'); streamPart(res,{ response: 'partial' }); };
  const pending = client.request('/api/generate',{ model,prompt: 'test',stream: true },{ onRecord: async () => { partial = true; } });
  const checked = expect(pending).rejects.toMatchObject({ name: 'AbortError',message: 'gateway_cancelled' });
  await until(() => partial); client.close(); await checked;
  const before = await gate.ledger.status();
  await gate.gateway.stop(); gate.client.release(true); clients.splice(clients.indexOf(gate.client),1);
  const replacement = await start(); expect(await replacement.ledger.status()).toMatchObject(before);
  expect((await call(replacement)).status).toBe(503); expect(calls).toHaveLength(1);
});
test('client provider binding and credential checks fail before dispatch; rejection does not leak secrets', async () => {
  const gate = await start();
  for (const overrides of [{ upstream: 'http://127.0.0.1:9' },{ token: randomBytes(32).toString('base64url') }]) {
    const raw = { url: gate.url,upstream: config.upstream,models: [model],token: credentials[0].token,...overrides };
    const client = createGatewayClient(raw,{ expectedUpstream: raw.upstream });
    await expect(client.request('/api/tags')).rejects.toMatchObject({ message: 'gateway_request_rejected',status: overrides.upstream ? 409 : 401 });
    client.close();
  }
  expect(calls).toHaveLength(0); expect((await gate.ledger.status()).attempts).toBe('0');
});
test('real description and embedding study adapters preserve model checks and route only through authenticated gateway', async () => {
  const gate = await start(), digest = 'a'.repeat(64), upstream = new URL(config.upstream);
  const settings = { primary_provider: 'ollama',ollama_host: upstream.hostname,ollama_port: Number(upstream.port),ollama_model: model,
    rag_enabled: true,embedding_provider_mode: 'same',embedding_model: model };
  const gateway = { url: gate.url,upstream: config.upstream,models: [model],token: credentials[2].token };
  const directForbidden = async () => { throw new Error('direct_fallback_forbidden'); };
  handler = (req,res) => res.end(JSON.stringify(req.url === '/api/tags' ? { models: [{ name: model,digest }] }
    : req.url === '/api/show' ? { capabilities: ['embedding','completion'],model_info: { 'general.architecture': 'fixture','fixture.context_length': 8192,'fixture.embedding_length': 2 } }
      : req.url === '/api/embed' ? { model,embeddings: [[0,1]] }
        : { model,done: true,response: '{"candidate":1}',done_reason: 'stop',prompt_eval_count: 2,eval_count: 3 }));
  const descriptions = createLocalDescriptionBenchmarkClient(settings,{ gateway,fetchRequest: directForbidden });
  const embeddings = createLocalStudyEmbeddingClient(settings,{ gateway,fetchRequest: directForbidden });
  const identity = await descriptions.inspect(); expect(identity.digest).toBe(digest);
  let reserved = 0;
  expect(await descriptions.generate({ prompt: 'synthetic',count: 2,context: 8192,identity,onGenerationCall: () => { reserved++; } }))
    .toMatchObject({ response: '{"candidate":1}',promptTokens: 2,outputTokens: 3 });
  expect(reserved).toBe(1); expect((await embeddings.inspect()).digest).toBe(digest);
  expect(await embeddings.embedBatch(['synthetic'],{ dimensions: 2 })).toEqual([[0,1]]);
  expect((await gate.ledger.status()).attempts).toBe('2'); expect(upstreamHeaders.every(headers => !headers.authorization)).toBe(true);
  descriptions.close(); embeddings.close();
});

test('client deadlines cancel before admission and during a streaming response without retries', async () => {
  const gate = await start(), client = gatewayClient(gate), cancelled = new AbortController(); cancelled.abort();
  await expect(client.request('/api/generate',{ model,prompt: 'test',stream: false },{ signal: cancelled.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(calls).toHaveLength(0);
  handler = (_req,res) => { res.setHeader('Content-Type','application/x-ndjson'); streamPart(res); };
  await expect(client.request('/api/generate',{ model,prompt: 'test',stream: true },{ timeoutMs: 100,onRecord: async () => {} })).rejects.toMatchObject({ name: 'AbortError' });
  expect(calls).toHaveLength(1); expect((await gate.ledger.status()).state).toBe('uncertain_or_active'); client.close();
});
test('authenticated client rejects redirect destinations without forwarding credentials or falling back', async () => {
  let redirected = 0;
  const gate = await start(), redirect = createServer((_req,res) => { redirected++; res.end('PRIVATE'); });
  await new Promise(resolve => { redirect.listen(0,'127.0.0.1',resolve); });
  const destination = `http://127.0.0.1:${redirect.address().port}`;
  const fakeGateway = createServer((_req,res) => { res.writeHead(307,{ Location: destination }); res.end('PRIVATE'); });
  await new Promise(resolve => { fakeGateway.listen(0,'127.0.0.1',resolve); });
  const client = createGatewayClient({ url: `http://127.0.0.1:${fakeGateway.address().port}`,upstream: config.upstream,models: [model],token: credentials[0].token },{ expectedUpstream: config.upstream });
  try {
    await expect(client.request('/api/tags')).rejects.toMatchObject({ message: 'gateway_request_rejected',status: 307 });
    expect(redirected).toBe(0); expect(calls).toHaveLength(0); expect((await gate.ledger.status()).attempts).toBe('0');
  } finally { client.close(); await Promise.all([redirect,fakeGateway].map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }))); }
});
