/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { getPool } from './setup.mjs';
import { gatewayConfig } from '../../ollamaGateway/contract.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { executeGatewayCompute } from '../../ollamaGateway/execution.mjs';
import { runGatewayRecovery } from '../../ollamaGateway/recoveryRepository.mjs';

const sql = name => readFile(new URL(`../../../../database/ollama-gateway/${name}`,import.meta.url),'utf8');
const pins = { daemonIdHash: 'a'.repeat(64),containerId: 'b'.repeat(64),imageId: `sha256:${'c'.repeat(64)}`,startedAt: '2026-10-15T09:00:00.123456789Z' };
let clients,provider,config,calls,seen,mode;
const connect = async () => { const client = await getPool().connect(); clients.push(client); return client; };
const rows = async () => (await getPool().query('SELECT * FROM ollama_gateway.request_binding ORDER BY attempt')).rows;
const admission = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
const compute = (ledger,options = {}) => executeGatewayCompute({ ledger,installation: 'fixture',config,
  path: '/api/generate',body: { model: 'synthetic:latest',prompt: 'PRIVATE prompt',stream: false },
  signal: new AbortController().signal,onRecord: async () => {},...options });

beforeEach(async () => {
  clients = []; calls = 0; seen = []; mode = 'success';
  await getPool().query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); // This suite owns its isolated database.
  await getPool().query(await sql('current.sql'));
  provider = createServer(async (req,res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks).toString());
    calls++; seen.push(...await rows());
    if (mode === 'unknown') { res.destroy(); return; }
    if (mode === 'busy') { res.writeHead(503); res.end('{}'); return; }
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.url === '/api/embed' ? { model: 'synthetic:latest',embeddings: [[0,1]] } :
      { model: 'synthetic:latest',done: true,response: input.prompt === '' ? '' : 'PRIVATE answer' }));
  });
  await new Promise(resolve => { provider.listen(0,'127.0.0.1',resolve); });
  config = gatewayConfig({ upstream: `http://127.0.0.1:${provider.address().port}`,models: ['synthetic:latest'],timeoutMs: 1000,queueMs: 100,
    providerInstance: pins,credentials: [{ installation: 'fixture',workClass: 'background',token: randomBytes(32).toString('base64url') }] });
});
afterEach(async () => {
  for (const client of clients) client.release(true);
  provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
});

test.each(['generate','embed','warm'])('binding is committed before %s reaches HTTP, preserves UUIDv7 and precision', async kind => {
  const client = await connect(), ledger = await openGatewayLedger(client,config.providerHash,pins);
  expect((await client.query('SHOW synchronous_commit')).rows[0].synchronous_commit).toBe('on');
  await compute(ledger,kind === 'embed' ? { path: '/api/embed',body: { model: 'synthetic:latest',input: ['PRIVATE'] } } :
    kind === 'warm' ? { body: { model: 'synthetic:latest',prompt: '',stream: false,keep_alive: '5m' } } : {});
  expect(calls).toBe(1); expect(seen).toHaveLength(1);
  const binding = (await rows())[0]; expect(binding).toEqual(seen[0]);
  expect(binding).toMatchObject({ evidence_kind: 'administrator_configured',container_id: pins.containerId,
    image_id: pins.imageId,daemon_id_hash: pins.daemonIdHash,provider_started_at: pins.startedAt,attempt: 1 });
  expect(JSON.stringify(binding)).not.toContain('PRIVATE');
  const versions = (await client.query('SELECT uuid_extract_version(id) AS id,uuid_extract_version(request_id) AS request FROM ollama_gateway.request_binding')).rows[0];
  expect(versions).toEqual({ id: 7,request: 7 });
  expect(await ledger.status()).toMatchObject({ state: 'ready',attempts: '1',bindingCount: 1,requestBinding: null });
});

test('no pins is explicitly unbound, not fabricated from latest configuration', async () => {
  const ledger = await openGatewayLedger(await connect(),config.providerHash);
  await compute(ledger); expect((await rows())[0]).toMatchObject({ evidence_kind: 'unbound',container_id: null,provider_started_at: null });
});

test('binding insert failure rolls back the attempt and prevents transport', async () => {
  const ledger = await openGatewayLedger(await connect(),config.providerHash,pins);
  await getPool().query(`CREATE TRIGGER fail_binding BEFORE INSERT ON ollama_gateway.request_binding
    FOR EACH STATEMENT EXECUTE FUNCTION ollama_gateway.reject_receipt_mutation()`);
  await expect(compute(ledger)).rejects.toThrow('gateway_ledger_unavailable');
  expect(calls).toBe(0); expect(await rows()).toHaveLength(0);
  expect(await admission()).toMatchObject({ active_request: null,attempts: 0,binding_count: 0 });
});

test('lost claim acknowledgement retains both writes but never dispatches or retries', async () => {
  const client = await connect(); let claims = 0;
  const wrapper = { on: (...args) => client.on(...args),query: async (...args) => {
    const result = await client.query(...args);
    if (args[0].startsWith('WITH claimed')) { claims++; throw new Error('PRIVATE lost acknowledgement'); }
    return result;
  } };
  const ledger = await openGatewayLedger(wrapper,config.providerHash,pins);
  await expect(compute(ledger)).rejects.toThrow('gateway_ledger_unavailable');
  expect(claims).toBe(1); expect(calls).toBe(0); expect(await rows()).toHaveLength(1);
  expect(await admission()).toMatchObject({ attempts: 1,binding_count: 1 });
  expect((await admission()).active_request).toBe((await rows())[0].request_id);
});

test('cancelled pre-dispatch claim keeps its immutable binding and counted attempt', async () => {
  const ledger = await openGatewayLedger(await connect(),config.providerHash,pins),controller = new AbortController();
  const wrapped = { ...ledger,claim: async installation => { const id = await ledger.claim(installation); controller.abort(); return id; } };
  await expect(compute(wrapped,{ signal: controller.signal })).rejects.toThrow();
  expect(calls).toBe(0); expect(await rows()).toHaveLength(1);
  expect(await ledger.status()).toMatchObject({ state: 'ready',attempts: '1',bindingCount: 1 });
});

test('unknown transport survives restart without replacing historical pins or allowing new-owner completion', async () => {
  const client = await connect(), ledger = await openGatewayLedger(client,config.providerHash,pins); mode = 'unknown';
  await expect(compute(ledger)).rejects.toThrow(); const before = (await rows())[0];
  expect(await ledger.status()).toMatchObject({ state: 'uncertain_or_active',requestBinding: { evidenceKind: 'administrator_configured',recoveryAuthorized: false } });
  await client.query('SELECT pg_advisory_unlock(11435,1)');
  const next = await connect(), restarted = await openGatewayLedger(next,config.providerHash,{ ...pins,startedAt: '2026-10-15T10:00:00Z' });
  await expect(restarted.claim('fixture')).rejects.toThrow('gateway_admission_deferred');
  await expect(restarted.complete(before.request_id)).rejects.toThrow('gateway_ledger_unavailable');
  await expect(ledger.complete(before.request_id)).rejects.toThrow('gateway_ledger_unavailable');
  expect((await rows())[0]).toEqual(before); expect(calls).toBe(1);
  await next.query('SELECT pg_advisory_unlock(11435,1)');
  const inspected = await runGatewayRecovery(await connect(),{ providerHash: config.providerHash,action: 'inspect' });
  expect(inspected.requestBinding).toMatchObject({ providerInstance: pins,evidenceKind: 'administrator_configured',recoveryAuthorized: false });
});

test('busy response preserves cooldown and records only the admitted request', async () => {
  const ledger = await openGatewayLedger(await connect(),config.providerHash,pins); mode = 'busy';
  await compute(ledger); await expect(compute(ledger)).rejects.toThrow('gateway_admission_deferred');
  expect(calls).toBe(1); expect(await rows()).toHaveLength(1);
  expect(await ledger.status()).toMatchObject({ state: 'cooldown',attempts: '1',bindingCount: 1 });
});

test('bounded history refuses new claims without resetting counters or preventing completion', async () => {
  const ledger = await openGatewayLedger(await connect(),config.providerHash,pins);
  // Fixture counter injection tests the boundary without manufacturing 100,000 historical records.
  await getPool().query('UPDATE ollama_gateway.admission SET binding_count=99999');
  await compute(ledger); expect(await ledger.status()).toMatchObject({ state: 'history_full',bindingCount: 100000 });
  await expect(compute(ledger)).rejects.toThrow('gateway_admission_deferred');
  expect(calls).toBe(1); expect((await admission()).attempts).toBe(1);
});

test('runtime can insert bindings but cannot mutate them or recovery holds', async () => {
  await getPool().query(`CREATE ROLE gateway_binding_runtime; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_binding_runtime;
    GRANT SELECT ON ollama_gateway.admission TO gateway_binding_runtime;
    GRANT UPDATE(owner_id,provider_hash,active_request,installation,started_at,attempts,completed_at,cooldown_until,binding_count)
      ON ollama_gateway.admission TO gateway_binding_runtime;
    GRANT SELECT,INSERT ON ollama_gateway.request_binding,ollama_gateway.completion_receipt TO gateway_binding_runtime`);
  const client = await connect(); await client.query('SET ROLE gateway_binding_runtime');
  const ledger = await openGatewayLedger(client,config.providerHash,pins); await compute(ledger);
  for (const query of ['DELETE FROM ollama_gateway.request_binding','TRUNCATE ollama_gateway.request_binding',
    'UPDATE ollama_gateway.request_binding SET provider_started_at=provider_started_at','UPDATE ollama_gateway.admission SET maintenance_receipt=NULL']) {
    await expect(client.query(query)).rejects.toMatchObject({ code: '42501' });
  }
  await expect(getPool().query('UPDATE ollama_gateway.request_binding SET container_id=container_id')).rejects.toMatchObject({ code: '42501' });
});

test('v2 upgrade preserves legacy unknown work with no invented binding and rejects old version claims', async () => {
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  await getPool().query(await sql('20261014_121441_admission.sql'));
  await getPool().query(await sql('20261014_224242_offline_recovery.sql'));
  await getPool().query(`UPDATE ollama_gateway.admission SET owner_id=uuidv7(),provider_hash=$1,active_request=uuidv7(),
    installation='legacy',started_at=clock_timestamp(),attempts=19,cooldown_until=clock_timestamp()+interval '1 hour'`,[config.providerHash]);
  const before = await admission();
  await getPool().query(await sql('20261015_091627_request_binding.sql'));
  await getPool().query(await sql('20261015_095721_provider_stop.sql'));
  await getPool().query(await sql('20261015_104932_upstream_peer.sql'));
  await getPool().query(await sql('20261015_113726_task_source.sql'));
  await getPool().query(await sql('20261015_220007_work_history.sql'));
  expect(await rows()).toHaveLength(0);
  expect(await admission()).toMatchObject({ version: 7,attempts: 19,binding_count: 0,active_request: before.active_request,cooldown_until: before.cooldown_until });
  expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=2')).rowCount).toBe(0);
  const client = await connect(), ledger = await openGatewayLedger(client,config.providerHash,pins);
  expect(await ledger.status()).toMatchObject({ state: 'uncertain_or_active',requestBinding: { id: null,evidenceKind: 'legacy_unbound' } });
  await expect(ledger.complete(before.active_request)).rejects.toThrow('gateway_ledger_unavailable');
  await client.query('SELECT pg_advisory_unlock(11435,1)');
  expect((await runGatewayRecovery(await connect(),{ providerHash: config.providerHash,action: 'inspect' })).requestBinding)
    .toMatchObject({ evidenceKind: 'legacy_unbound',providerInstance: null,recoveryAuthorized: false });
});

test('v3 migration refuses an active v2 gateway lock without changing data', async () => {
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  await getPool().query(await sql('20261014_121441_admission.sql')); await getPool().query(await sql('20261014_224242_offline_recovery.sql'));
  await (await connect()).query('SELECT pg_advisory_lock(11435,1)');
  const upgrader = await connect();
  await expect(upgrader.query(await sql('20261015_091627_request_binding.sql'))).rejects.toThrow('gateway_must_be_stopped');
  await upgrader.query('ROLLBACK'); expect((await admission()).version).toBe(2);
});

test.each(['uuid_version','partial_pins','unbound_pins','invalid_timestamp'])('SQL refuses invalid %s without changing history', async kind => {
  const id = (await getPool().query('SELECT uuidv7() AS id')).rows[0].id;
  await expect(getPool().query(`INSERT INTO ollama_gateway.request_binding
    (id,ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind,
     daemon_id_hash,container_id,image_id,provider_started_at)
    SELECT $1,id,uuidv7(),uuidv7(),$2,'fixture',clock_timestamp(),1,$3,$4,$5,$6,$7 FROM ollama_gateway.admission`,
  [kind === 'uuid_version' ? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' : id,config.providerHash,
    kind === 'unbound_pins' ? 'unbound' : 'administrator_configured',pins.daemonIdHash,
    kind === 'partial_pins' ? null : pins.containerId,pins.imageId,kind === 'invalid_timestamp' ? 'not-a-date' : pins.startedAt])).rejects.toThrow();
  expect(await rows()).toHaveLength(0);
});
