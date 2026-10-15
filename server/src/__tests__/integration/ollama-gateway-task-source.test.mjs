/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { QueueTaskProcessorService } from '../../services/queueTaskProcessorService.mjs';
import { runOllamaTaskScope } from '../../services/ollamaTaskScope.mjs';
import { generate } from '../../services/ollamaGeneration.mjs';
import { gatewayTaskSourceHeaders,GATEWAY_TASK_SOURCE_HEADER as header } from '../../ollamaGateway/taskSource.mjs';
import { readGatewayRequestBinding } from '../../ollamaGateway/requestBindingRepository.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { createGatewayClient } from '../../ollamaGateway/client.mjs';

let fixture;
const task = id => ({ id,task_type: 'classification',attempts: 3,claim_token: 'PRIVATE',payload: { taskId: 999,title: 'PRIVATE' } });
const source = id => ({ version: 1,kind: 'queue_task',taskId: String(id),taskType: 'classification',attempt: 3 });
const bindings = async () => (await getPool().query('SELECT * FROM ollama_gateway.request_binding ORDER BY attempt')).rows;
const sql = name => readFile(new URL(`../../../../database/ollama-gateway/${name}`,import.meta.url),'utf8');
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool()); });
afterEach(async () => { await fixture?.close(); });

test('real queue dispatch correlates generation, streaming, embeddings and warming without forwarding source to provider',async () => {
  const { owner,configuration,model,vectorModel } = fixture;
  const client = owner.resolve(configuration,{ workClass: 'foreground' }); // Created outside task scope.
  const processor = { logger: { info() {} },async processClassificationTask() {
    await generate(async () => configuration,'fixture',model);
    await client.generateWithProgress('fixture',model,0,null,null,{ requireDoneSignal: true });
    await client.embed('fixture',vectorModel);
    await client.warmModel();
    await client.request('/api/generate',{ model,prompt: 'fixture',stream: false },{ source: source(999) });
  } };
  await owner.run(() => QueueTaskProcessorService.prototype.processTask.call(processor,task('9223372036854775807')));
  const rows = await bindings(); expect(rows).toHaveLength(5);
  for (const row of rows) {
    expect(row).toMatchObject({ source_kind: 'queue_task',source_task_id: '9223372036854775807',source_task_type: 'classification',source_attempt: 3,installation: 'local' });
    expect((await readGatewayRequestBinding(getPool(),row.request_id)).workIdentity.source)
      .toEqual({ ...source('9223372036854775807'),authority: 'diagnostic_only' });
  }
  expect(new Set(rows.map(row => row.request_id)).size).toBe(5);
  expect(JSON.stringify(rows)).not.toMatch(/PRIVATE|claim_token|payload/);
  expect(fixture.calls.every(call => call.taskSource === undefined && call.authorization === undefined && !call.body?.source)).toBe(true);
  await owner.run(() => client.generate('unscoped'));
  expect((await bindings()).at(-1).source_kind).toBeNull();
  expect(await fixture.ledger.status()).not.toHaveProperty('source');
});

test('concurrent tasks using the same precreated context keep separate references and attempts',async () => {
  const client = fixture.owner.resolve(fixture.configuration,{ workClass: 'foreground' });
  await fixture.owner.run(() => Promise.all([41,42].map(id => runOllamaTaskScope(task(id),() => client.generate('identical')))));
  const rows = await bindings(); expect(rows.map(row => row.source_task_id).sort()).toEqual(['41','42']);
  expect(new Set(rows.map(row => row.request_id)).size).toBe(2); expect((await fixture.ledger.status()).attempts).toBe('2');
});

async function rawCall(value,{ duplicate = false,path = '/api/generate',authenticated = true } = {}) {
  const options = fixture.options(1).foreground;
  return new Promise((resolve,reject) => {
    const compute = path === '/api/generate',body = JSON.stringify({ model: fixture.model,prompt: 'fixture',stream: false });
    const req = request(`${options.url}${path}`,{ method: compute ? 'POST' : 'GET',headers: {
      ...(authenticated ? { Authorization: `Bearer ${options.token}` } : {}),'Content-Type': 'application/json',
      [header]: duplicate ? [value,value] : value } },res => {
      const parts = []; res.on('data',chunk => parts.push(chunk));
      res.on('end',() => resolve({ status: res.statusCode,body: Buffer.concat(parts).toString() }));
    });
    req.on('error',reject); req.end(compute ? body : undefined);
  });
}

test.each(['invalid','oversized','duplicate','inspection','status','unauthorized'])('source %s refuses before admission with no upstream calls',async mode => {
  const value = mode === 'invalid' ? Buffer.from('{"private":"SECRET"}').toString('base64url') :
    mode === 'oversized' ? 'a'.repeat(257) : gatewayTaskSourceHeaders(source(7),true)[header];
  const result = await rawCall(value,{ duplicate: mode === 'duplicate',authenticated: mode !== 'unauthorized',
    path: mode === 'inspection' ? '/api/tags' : mode === 'status' ? '/gateway/status' : undefined });
  expect(result.status).toBe(mode === 'unauthorized' ? 401 : 400); expect(result.body).not.toContain('SECRET');
  expect(fixture.calls).toHaveLength(0); expect(await bindings()).toHaveLength(0);
  expect((await fixture.ledger.status()).attempts).toBe('0');
});

test('raw gateway client rejects invalid source before HTTP and inspection never carries a source',async () => {
  const options = fixture.options(1).foreground,client = createGatewayClient(options,{ expectedUpstream: options.upstream });
  try {
    await expect(client.request('/api/generate',{ model: fixture.model,prompt: 'fixture',stream: false },{ source: { ...source(9),claim_token: 'PRIVATE' } }))
      .rejects.toThrow('gateway_task_source_invalid');
    await expect(client.request('/api/tags',undefined,{ source: source(9) })).rejects.toThrow('gateway_task_source_invalid');
    expect(fixture.classes).toHaveLength(0); expect(await bindings()).toHaveLength(0);
  } finally { client.close(); }
});

test('v6 migration preserves uncertain v5 work without inventing a source or allowing an old writer',async () => {
  await fixture.close(); fixture = null;
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE'); // Owned disposable suite DB only.
  for (const name of ['20261014_121441_admission.sql','20261014_224242_offline_recovery.sql',
    '20261015_091627_request_binding.sql','20261015_095721_provider_stop.sql','20261015_104932_upstream_peer.sql']) await getPool().query(await sql(name));
  const providerHash = 'a'.repeat(64);
  await getPool().query(`UPDATE ollama_gateway.admission SET owner_id=uuidv7(),provider_hash=$1,active_request=uuidv7(),
    installation='legacy',started_at=clock_timestamp(),attempts=8,binding_count=1,cooldown_until=clock_timestamp()+interval '1 hour'`,[providerHash]);
  await getPool().query(`INSERT INTO ollama_gateway.request_binding
    (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind,work_version,operation,model)
    SELECT id,active_request,owner_id,provider_hash,installation,started_at,attempts,'unbound',1,'/api/generate','test:latest' FROM ollama_gateway.admission`);
  const previous = await bindings(),before = (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
  const holder = await getPool().connect(),upgrader = await getPool().connect();
  try {
    await holder.query('SELECT pg_advisory_lock(11435,1)');
    await expect(upgrader.query(await sql('20261015_113726_task_source.sql'))).rejects.toThrow('gateway_must_be_stopped');
    await upgrader.query('ROLLBACK'); await holder.query('SELECT pg_advisory_unlock(11435,1)');
    await upgrader.query(await sql('20261015_113726_task_source.sql'));
    expect(await bindings()).toEqual(previous.map(row => ({ ...row,source_kind: null,source_task_id: null,source_task_type: null,source_attempt: null })));
    expect((await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0]).toEqual({ ...before,version: 6 });
    expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=5')).rowCount).toBe(0);
    const ledger = await openGatewayLedger(holder,providerHash);
    await expect(ledger.claim('legacy')).rejects.toThrow('gateway_admission_deferred');
  } finally { holder.release(true); upgrader.release(true); }
});

test.each([['queue_task','0','classification',1],['queue_task','9223372036854775808','classification',1],
  ['queue_task','42',null,1],['other','42','classification',1],['queue_task','42','other',1],['queue_task','42','classification',-1]])('database refuses incomplete/invalid source %#',async (kind,id,type,attempt) => {
  await fixture.owner.run(() => runOllamaTaskScope(task(42),() => generate(async () => fixture.configuration,'fixture',fixture.model)));
  await expect(getPool().query(`INSERT INTO ollama_gateway.request_binding
    (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind,work_version,operation,model,source_kind,source_task_id,source_task_type,source_attempt)
    SELECT ledger_id,uuidv7(),owner_id,provider_hash,installation,admitted_at,attempt+1,evidence_kind,work_version,operation,model,$1,$2,$3,$4
    FROM ollama_gateway.request_binding LIMIT 1`,[kind,id,type,attempt])).rejects.toMatchObject({ code: '23514' });
  expect(await bindings()).toHaveLength(1);
});
