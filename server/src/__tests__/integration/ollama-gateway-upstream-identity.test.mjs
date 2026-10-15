/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:https';
import { createServer as tcpServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { gatewayTlsFixture } from '../helpers/gatewayTlsFixture.mjs';
import { gatewayConfig } from '../../ollamaGateway/contract.mjs';
import { gatewayPeerIdentity } from '../../ollamaGateway/upstreamIdentity.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { executeGatewayCompute } from '../../ollamaGateway/execution.mjs';
import { gatewayUpstream } from '../../ollamaGateway/transport.mjs';
import { readGatewayRequestBinding } from '../../ollamaGateway/requestBindingRepository.mjs';
import { createGatewayClient } from '../../ollamaGateway/client.mjs';
import { createGatewayServer } from '../../ollamaGateway/server.mjs';

let tls,wrong,clients,provider,config,calls,seen,mode,received;
const sql = name => readFile(new URL(`../../../../database/ollama-gateway/${name}`,import.meta.url),'utf8');
const connect = async () => { const c = await getPool().connect(); clients.push(c); return c; };
const rows = async () => (await getPool().query('SELECT * FROM ollama_gateway.upstream_peer_observation')).rows;
const admission = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
const raw = () => ({ upstream: `https://127.0.0.1:${provider.address().port}`,models: ['synthetic:latest'],
  workIdentityKey: Buffer.alloc(32,7).toString('base64url'),
  upstreamTls: { ca: tls.cert,publicKeySha256: gatewayPeerIdentity(tls.cert).publicKeySha256 },
  timeoutMs: 3000,queueMs: 100,credentials: [{ installation: 'fixture',workClass: 'background',token: 'a'.repeat(43) }] });
const compute = (ledger,options = {}) => executeGatewayCompute({ ledger,config,installation: 'fixture',path: '/api/generate',
  body: { model: 'synthetic:latest',prompt: 'PRIVATE prompt',stream: false },signal: AbortSignal.timeout(3000),...options });
const ledger = async () => openGatewayLedger(await connect(),config.providerHash);
beforeAll(async () => { tls = await gatewayTlsFixture(); wrong = await gatewayTlsFixture('127.0.0.2'); });
afterAll(async () => { await tls?.close(); await wrong?.close(); });
beforeEach(async () => {
  clients = []; calls = 0; seen = []; received = []; mode = 'success';
  await getPool().query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); // Owned isolated suite database.
  await getPool().query(await sql('current.sql'));
  provider = createServer({ cert: tls.cert,key: tls.key },async (req,res) => {
    calls++; seen.push(...await rows());
    received.push({ headers: req.headers,bindings: (await getPool().query('SELECT * FROM ollama_gateway.request_binding ORDER BY attempt')).rows });
    if (mode === 'unknown') { res.destroy(); return; }
    if (mode === 'busy') { res.writeHead(503); res.end('{}'); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (['/api/tags','/api/ps'].includes(req.url)) { res.end('{"models":[{"name":"synthetic:latest"}]}'); return; }
    const data = req.url === '/api/embed' ? { model: body.model,embeddings: [[0,1]] } :
      { model: body.model,done: true,response: body.prompt === '' ? '' : 'answer' };
    res.setHeader('Content-Type',body.stream ? 'application/x-ndjson' : 'application/json');
    res.end(`${JSON.stringify(data)}${body.stream ? '\n' : ''}`);
  });
  await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); }); config = gatewayConfig(raw());
});
afterEach(async () => {
  for (const client of clients) client.release(true);
  provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
});

test.each(['generate','embed','warm','stream'])('%s authenticates and commits a UUIDv7 observation before any HTTP',async kind => {
  const held = await ledger();
  const extra = kind === 'embed' ? { path: '/api/embed',body: { model: 'synthetic:latest',input: ['private'] } } :
    kind === 'warm' ? { body: { model: 'synthetic:latest',prompt: '',stream: false,keep_alive: '5m' } } :
      kind === 'stream' ? { body: { model: 'synthetic:latest',prompt: 'private',stream: true },onRecord: async () => {} } : {};
  await compute(held,extra); expect(calls).toBe(1); expect(seen).toHaveLength(1); expect(await rows()).toEqual(seen);
  expect(seen[0]).toMatchObject({ public_key_sha256: gatewayPeerIdentity(tls.cert).publicKeySha256,
    certificate_sha256: gatewayPeerIdentity(tls.cert).certificateSha256 });
  expect((await getPool().query('SELECT uuid_extract_version(id) AS v FROM ollama_gateway.upstream_peer_observation')).rows[0].v).toBe(7);
  expect(JSON.stringify(seen)).not.toMatch(/PRIVATE|BEGIN CERTIFICATE|prompt|answer/);
  expect(await held.status()).toMatchObject({ state: 'ready',attempts: '1' });
  const binding = received[0].bindings[0];
  expect(received[0].headers).toMatchObject({ 'x-classifarr-application': 'classifarr',
    'x-classifarr-request-id': binding.request_id,'x-classifarr-installation': 'fixture' });
  expect(binding.work_fingerprint).toMatch(/^[a-f0-9]{64}$/); expect(binding.model).toBe('synthetic:latest');
  expect(JSON.stringify(binding)).not.toContain('PRIVATE');
});

test('identical work gets distinct attempts; installation scopes fingerprints and ignores spoofed ownership headers',async () => {
  const held = await ledger(),gateway = createGatewayServer({ config,ledger: held });
  await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
  const url = `http://127.0.0.1:${gateway.server.address().port}/api/generate`;
  try {
    for (let i=0;i<2;i++) expect((await fetch(url,{ method: 'POST',headers: { Authorization: `Bearer ${'a'.repeat(43)}`,
      'Content-Type': 'application/json','X-Classifarr-Request-Id': 'foreign-job','X-Classifarr-Installation': 'other-app' },
    body: JSON.stringify({ model: 'synthetic:latest',prompt: 'PRIVATE prompt',stream: false }) })).status).toBe(200);
    await compute(held,{ installation: 'another_classifarr' });
    const bindings = (await getPool().query('SELECT * FROM ollama_gateway.request_binding ORDER BY attempt')).rows;
    expect(new Set(bindings.map(row => row.request_id)).size).toBe(3);
    expect(bindings[0].work_fingerprint).toBe(bindings[1].work_fingerprint);
    expect(bindings[2].work_fingerprint).not.toBe(bindings[0].work_fingerprint);
    expect(received[0].headers['x-classifarr-installation']).toBe('fixture');
    expect(received[0].headers['x-classifarr-request-id']).not.toBe('foreign-job');
    expect(JSON.stringify(received.map(row => row.headers))).not.toContain(bindings[0].work_fingerprint);
  } finally { await gateway.stop(); }
});

test('external requests and loaded models are never adopted as Classifarr work',async () => {
  const held = await ledger();
  // Direct synthetic consumer bypasses Classifarr admission, as other applications do on shared Ollama.
  await gatewayUpstream(config,'/api/generate',{ model: 'synthetic:latest',prompt: 'external',stream: false },AbortSignal.timeout(3000));
  await gatewayUpstream(config,'/api/ps',undefined,AbortSignal.timeout(3000));
  expect(calls).toBe(2); expect(await rows()).toHaveLength(0);
  expect(received.every(row => row.headers['x-classifarr-request-id'] === undefined)).toBe(true);
  expect((await getPool().query('SELECT count(*)::int AS n FROM ollama_gateway.request_binding')).rows[0].n).toBe(0);
  expect(await held.status()).toMatchObject({ state: 'ready',attempts: '0',requestId: null });
});

test.each(['pin','ca','ip'])('%s mismatch sends zero HTTP requests and cannot retry the counted attempt',async mismatch => {
  const input = raw();
  if (mismatch === 'pin') input.upstreamTls.publicKeySha256 = '0'.repeat(64);
  if (mismatch === 'ca') input.upstreamTls.ca = wrong.cert;
  if (mismatch === 'ip') {
    provider.setSecureContext({ cert: wrong.cert,key: wrong.key });
    input.upstreamTls = { ca: wrong.cert,publicKeySha256: gatewayPeerIdentity(wrong.cert).publicKeySha256 };
  }
  config = gatewayConfig(input); const held = await ledger();
  await expect(compute(held)).rejects.toThrow('gateway_upstream_unknown');
  await expect(compute(held)).rejects.toThrow('gateway_admission_deferred');
  expect(calls).toBe(0); expect(await rows()).toHaveLength(0);
  expect(await held.status()).toMatchObject({ state: 'uncertain_or_active',attempts: '1' });
});

test('ambient TLS disabling cannot bypass the explicit CA check',async () => {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED; process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    config = gatewayConfig({ ...raw(),upstreamTls: { ...raw().upstreamTls,ca: wrong.cert } });
    await expect(compute(await ledger())).rejects.toThrow(); expect(calls).toBe(0);
  } finally {
    if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
  }
});

test.each(['denied','lost_ack','cancelled'])('%s evidence persistence sends no HTTP and preserves the claim',async failure => {
  const held = await ledger(),controller = new AbortController();
  if (failure === 'denied') await getPool().query(`CREATE TRIGGER fail_peer BEFORE INSERT ON ollama_gateway.upstream_peer_observation
    FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation()`);
  const wrapped = { ...held,async recordPeer(...args) {
    await held.recordPeer(...args);
    if (failure === 'lost_ack') throw new Error('PRIVATE lost acknowledgement');
    if (failure === 'cancelled') controller.abort();
  } };
  await expect(compute(wrapped,{ signal: AbortSignal.any([controller.signal,AbortSignal.timeout(3000)]) })).rejects.toThrow('gateway_upstream_unknown');
  expect(calls).toBe(0); expect(await rows()).toHaveLength(failure === 'denied' ? 0 : 1);
  expect(await admission()).toMatchObject({ attempts: 1,binding_count: 1 }); expect((await admission()).active_request).not.toBeNull();
});

test('connection closing after authentication preserves peer evidence and restart cannot replay or replace it',async () => {
  const first = await connect(),held = await openGatewayLedger(first,config.providerHash); mode = 'unknown';
  await expect(compute(held)).rejects.toThrow(); const before = await rows(),state = await admission();
  await first.query('SELECT pg_advisory_unlock(11435,1)');
  const next = await ledger(); await expect(compute(next)).rejects.toThrow('gateway_admission_deferred');
  await expect(next.recordPeer(state.active_request,gatewayPeerIdentity(wrong.cert))).rejects.toThrow('gateway_ledger_unavailable');
  await expect(held.recordPeer(state.active_request,gatewayPeerIdentity(wrong.cert))).rejects.toThrow('gateway_ledger_unavailable');
  expect(await rows()).toEqual(before); expect(calls).toBe(1);
  expect(await readGatewayRequestBinding(getPool(),state.active_request)).toMatchObject({ recoveryAuthorized: false,
    evidenceKind: 'unbound',transportEvidence: { evidenceKind: 'tls_peer_authenticated',recoveryAuthorized: false } });
});

test('cancellation while a peer write is pending prevents dispatch after its late acknowledgement',async () => {
  const held = await ledger(),controller = new AbortController(); let release,entered;
  const waiting = new Promise(resolve => { entered = resolve; }),gate = new Promise(resolve => { release = resolve; });
  const pending = compute({ ...held,async recordPeer(...args) { await held.recordPeer(...args); entered(); await gate; } },
    { signal: controller.signal });
  const failed = expect(pending).rejects.toThrow('gateway_upstream_unknown');
  try {
    await waiting; expect(calls).toBe(0); controller.abort(); await failed;
    release(); await delay(20); expect(calls).toBe(0); expect(await rows()).toHaveLength(1);
    expect(await held.status()).toMatchObject({ state: 'uncertain_or_active',attempts: '1' });
  } finally { controller.abort(); release(); }
});

test('busy completion retains the cooldown and blocks another request',async () => {
  const held = await ledger(); mode = 'busy'; await compute(held);
  await expect(compute(held)).rejects.toThrow('gateway_admission_deferred');
  expect(await held.status()).toMatchObject({ state: 'cooldown',attempts: '1' }); expect(calls).toBe(1);
});

test('a replacement TLS peer is checked again, never accepted from a previous connection or session',async () => {
  const held = await ledger(); await compute(held);
  provider.setSecureContext({ cert: wrong.cert,key: wrong.key });
  await expect(compute(held)).rejects.toThrow(); expect(calls).toBe(1); expect(await rows()).toHaveLength(1);
  expect(await held.status()).toMatchObject({ state: 'uncertain_or_active',attempts: '2' });
});

test('inspection is authenticated without compute records; status is database-only',async () => {
  const held = await ledger(); await gatewayUpstream(config,'/api/tags',undefined,AbortSignal.timeout(3000));
  const gateway = createGatewayServer({ config,ledger: held });
  await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
  const client = createGatewayClient({ url: `http://127.0.0.1:${gateway.server.address().port}`,upstream: config.upstream,
    models: config.models,token: 'a'.repeat(43) },{ expectedUpstream: config.upstream });
  try { expect((await client.request('/gateway/status')).attempts).toBe('0'); }
  finally { client.close(); await gateway.stop(); }
  expect(calls).toBe(1); expect(await rows()).toHaveLength(0);
});

test('real client-to-gateway-to-HTTPS compute uses the HTTPS provider identity',async () => {
  const held = await ledger(),gateway = createGatewayServer({ config,ledger: held });
  await new Promise(resolve => { gateway.server.listen(0,'127.0.0.1',resolve); });
  const client = createGatewayClient({ url: `http://127.0.0.1:${gateway.server.address().port}`,upstream: config.upstream,
    models: config.models,token: 'a'.repeat(43) },{ expectedUpstream: config.upstream });
  try { expect((await client.request('/api/generate',{ model: 'synthetic:latest',prompt: 'fixture',stream: false })).done).toBe(true); }
  finally { client.close(); await gateway.stop(); }
  expect(calls).toBe(1); expect(seen).toHaveLength(1);
});

test.each([100,10000])('TLS handshake is bounded by caller cancellation or the five-second cap (%s)',async timeout => {
  const sockets = new Set(),server = tcpServer(socket => { sockets.add(socket); socket.once('close',() => sockets.delete(socket)); });
  await new Promise(resolve => { server.listen(0,'127.0.0.1',resolve); });
  try {
    config = gatewayConfig({ ...raw(),upstream: `https://127.0.0.1:${server.address().port}` });
    const started = Date.now();
    await expect(compute(await ledger(),{ signal: AbortSignal.timeout(timeout) })).rejects.toThrow();
    expect(Date.now()-started).toBeLessThan(timeout === 100 ? 2000 : 8000);
    expect(await rows()).toHaveLength(0); expect(calls).toBe(0);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise(resolve => { server.close(resolve); }); }
});

test('runtime evidence is insert-only, bounded to one per request and not recovery authority',async () => {
  await getPool().query(`CREATE ROLE gateway_peer_runtime; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_peer_runtime;
    GRANT SELECT ON ollama_gateway.admission TO gateway_peer_runtime;
    GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
      ON ollama_gateway.admission TO gateway_peer_runtime;
    GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.upstream_peer_observation TO gateway_peer_runtime`);
  const c = await connect(); await c.query('SET ROLE gateway_peer_runtime'); const held = await openGatewayLedger(c,config.providerHash);
  mode = 'unknown'; await expect(compute(held)).rejects.toThrow();
  await expect(held.recordPeer((await admission()).active_request,gatewayPeerIdentity(tls.cert))).rejects.toThrow();
  for (const statement of ['DELETE FROM ollama_gateway.upstream_peer_observation','TRUNCATE ollama_gateway.upstream_peer_observation',
    'UPDATE ollama_gateway.upstream_peer_observation SET certificate_sha256=certificate_sha256',
    'UPDATE ollama_gateway.admission SET maintenance_receipt=NULL']) {
    await expect(c.query(statement)).rejects.toMatchObject({ code: '42501' });
  }
  await expect(getPool().query('DELETE FROM ollama_gateway.upstream_peer_observation')).rejects.toMatchObject({ code: '42501' });
  expect(await rows()).toHaveLength(1);
});

test.each(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-7000-0000-000000000000'])('rejects non-v7/RFC observation ID %s',async id => {
  const held = await ledger(); await held.claim('fixture');
  await expect(getPool().query(`INSERT INTO ollama_gateway.upstream_peer_observation(id,binding_id,public_key_sha256,certificate_sha256)
    SELECT $1,id,$2,$2 FROM ollama_gateway.request_binding`,[id,'a'.repeat(64)])).rejects.toMatchObject({ code: '23514' });
});

test('v5 upgrade refuses active ownership, preserves v4 unknown state and creates no retrospective evidence',async () => {
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  for (const name of ['20261014_121441_admission.sql','20261014_224242_offline_recovery.sql',
    '20261015_091627_request_binding.sql','20261015_095721_provider_stop.sql']) await getPool().query(await sql(name));
  await getPool().query(`UPDATE ollama_gateway.admission SET owner_id=uuidv7(),provider_hash=$1,active_request=uuidv7(),
    installation='legacy',started_at=clock_timestamp(),attempts=29,binding_count=1,cooldown_until=clock_timestamp()+interval '1 hour'`,[config.providerHash]);
  await getPool().query(`INSERT INTO ollama_gateway.request_binding
    (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,active_request,owner_id,provider_hash,installation,started_at,attempts,'unbound' FROM ollama_gateway.admission`);
  const bindings = (await getPool().query('SELECT * FROM ollama_gateway.request_binding')).rows;
  const before = await admission(),holder = await connect(),upgrader = await connect();
  await holder.query('SELECT pg_advisory_lock(11435,1)');
  await expect(upgrader.query(await sql('20261015_104932_upstream_peer.sql'))).rejects.toThrow('gateway_must_be_stopped');
  await upgrader.query('ROLLBACK'); await holder.query('SELECT pg_advisory_unlock(11435,1)');
  await upgrader.query(await sql('20261015_104932_upstream_peer.sql'));
  expect(await admission()).toEqual({ ...before,version: 5 }); expect(await rows()).toHaveLength(0);
  expect((await getPool().query('SELECT * FROM ollama_gateway.request_binding')).rows).toEqual(bindings.map(row => ({ ...row,
    work_version: null,operation: null,model: null,work_fingerprint: null,fingerprint_key_id: null })));
  expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=4')).rowCount).toBe(0);
  await upgrader.query(await sql('20261015_113726_task_source.sql'));
  await expect(compute(await ledger())).rejects.toThrow('gateway_admission_deferred'); expect(calls).toBe(0);
});
