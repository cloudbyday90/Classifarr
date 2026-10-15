/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { readOllamaWorkHistory } from '../../services/ollamaWorkHistory.mjs';
import { readGatewayHistory } from '../../ollamaGateway/historyRepository.mjs';
import { runOllamaTaskScope } from '../../services/ollamaTaskScope.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';

let fixture;
beforeEach(async () => { fixture = await createOllamaApplicationFixture(getPool()); });
afterEach(async () => { await fixture?.close(); });
const history = filter => fixture.owner.run(() => readOllamaWorkHistory(filter));
const admission = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
const generate = () => fixture.owner.run(() => runOllamaTaskScope({ id: 42,task_type: 'classification',attempts: 2 },
  () => fixture.owner.resolve(fixture.configuration).generate('PRIVATE prompt')));

test('empty configured and unconfigured states differ and neither calls Ollama',async () => {
  expect(await readOllamaWorkHistory()).toEqual({ state: 'not_configured' });
  const before = await admission();
  expect(await history()).toEqual({ state: 'available',version: 1,installation: 'local',items: [],nextBefore: null });
  expect(await admission()).toEqual(before); expect(fixture.calls).toHaveLength(0);
});

test('actual application request writes a completion and returns only safe local task history',async () => {
  await generate();
  const foreign = await fixture.ledger.claim('unraid'); await fixture.ledger.complete(foreign);
  const before = await admission(),calls = fixture.calls.length;
  const result = await history({ taskId: '42' });
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({ source: { taskId: '42',attempt: 2 },outcome: { state: 'response_completed',httpStatus: 200 } });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|fingerprint|provider_hash|owner_id|unraid/);
  expect((await history()).items).toHaveLength(1); expect(fixture.calls).toHaveLength(calls); expect(await admission()).toEqual(before);
  expect((await getPool().query('SELECT uuid_extract_version(id) AS version FROM ollama_gateway.completion_receipt')).rows.every(row => row.version === 7)).toBe(true);
  for (const sql of ['UPDATE ollama_gateway.completion_receipt SET outcome=outcome','DELETE FROM ollama_gateway.completion_receipt','TRUNCATE ollama_gateway.completion_receipt']) {
    await expect(getPool().query(sql)).rejects.toMatchObject({ code: '42501' });
  }
});

test('keyset pages stay installation scoped with no duplicates after a new admission',async () => {
  for (let index=0;index<29;index++) { const id = await fixture.ledger.claim(index === 5 ? 'unraid' : 'local'); await fixture.ledger.complete(id); }
  const first = await history(); expect(first.items).toHaveLength(25); expect(first.nextBefore).not.toBeNull();
  const newer = await fixture.ledger.claim('local'); await fixture.ledger.complete(newer);
  const next = await history({ before: first.nextBefore }); expect(next.items).toHaveLength(3); expect(next.nextBefore).toBeNull();
  expect(new Set([...first.items,...next.items].map(row => row.requestId)).size).toBe(28);
  expect(first.items[0].outcome.state).toBe('completion_observed'); expect(first.items[0].source).toBeNull();
  expect(fixture.calls).toHaveLength(0);
});

test('active and restarted uncertain requests are not labelled complete',async () => {
  const id = await fixture.ledger.claim('local');
  expect((await history()).items[0]).toMatchObject({ requestId: id,outcome: { state: 'active_or_uncertain',recordedAt: null } });
  await fixture.close(); fixture = null;
  const row = await admission(),client = await getPool().connect();
  try {
    const ledger = await openGatewayLedger(client,row.provider_hash);
    expect((await ledger.history('local')).items[0].outcome.state).toBe('active_or_uncertain');
    expect((await admission()).attempts).toBe(row.attempts);
  } finally { client.release(true); }
});

test('known provider rejection is recorded separately and reading preserves cooldown',async () => {
  fixture.setFailure(); await expect(generate()).rejects.toThrow();
  const before = await admission();
  expect((await history()).items[0].outcome).toMatchObject({ state: 'provider_rejected',httpStatus: 503 });
  expect(before.cooldown_until).not.toBeNull(); expect(await admission()).toEqual(before);
});

test('failed receipt insert rolls back completion and retains attempts/active work',async () => {
  const id = await fixture.ledger.claim('local'),before = await admission();
  await getPool().query(`CREATE FUNCTION ollama_gateway.fixture_refuse_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END; $$;
    CREATE TRIGGER fixture_completion BEFORE INSERT ON ollama_gateway.completion_receipt FOR EACH ROW EXECUTE FUNCTION ollama_gateway.fixture_refuse_completion()`);
  await expect(fixture.ledger.complete(id)).rejects.toThrow('gateway_ledger_unavailable');
  expect(await admission()).toEqual(before); expect((await getPool().query('SELECT * FROM ollama_gateway.completion_receipt')).rows).toHaveLength(0);
});

test('the history query works with SELECT-only grants inside a read-only transaction',async () => {
  await generate(); const before = await admission(),client = await getPool().connect();
  await getPool().query(`CREATE ROLE gateway_history_reader; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_history_reader;
    GRANT SELECT ON ollama_gateway.admission,ollama_gateway.request_binding,ollama_gateway.completion_receipt,ollama_gateway.recovery_receipt TO gateway_history_reader`);
  try {
    await client.query('SET ROLE gateway_history_reader'); await client.query('BEGIN READ ONLY');
    const report = await readGatewayHistory((sql,args) => client.query(sql,args),{ installation: 'local',owner: before.owner_id,providerHash: before.provider_hash });
    expect(report.items).toHaveLength(1); await client.query('COMMIT');
    await expect(client.query('DELETE FROM ollama_gateway.completion_receipt')).rejects.toMatchObject({ code: '42501' });
  } finally { client.release(true); }
  expect(await admission()).toEqual(before);
});

test.each(['installation=unraid','taskId=1&taskId=2','before=0','taskId=9223372036854775808','limit=100','taskId=1%27','before=1e3'])('malformed history query %s makes no provider calls or attempts',async query => {
  const options = fixture.options(1).foreground;
  const response = await fetch(`${options.url}/gateway/history?${query}`,{ headers: { Authorization: `Bearer ${options.token}` } });
  expect(response.status).toBe(400); expect(fixture.calls).toHaveLength(0); expect((await admission()).attempts).toBe(0);
});

test('history requires authentication and closed application contexts cannot fall back',async () => {
  expect((await fetch(`${fixture.options(1).foreground.url}/gateway/history`)).status).toBe(401);
  fixture.owner.close(); expect(() => fixture.owner.run(() => readOllamaWorkHistory())).toThrow('gateway_client_closed');
  expect(fixture.calls).toHaveLength(0);
});

test('owner and provider fences reject stale history readers without changing the ledger',async () => {
  await generate(); const before = await admission();
  for (const binding of [{ owner: '0199ea26-7d80-7000-8000-000000000001',providerHash: before.provider_hash },
    { owner: before.owner_id,providerHash: 'f'.repeat(64) }]) {
    await expect(readGatewayHistory((sql,args) => getPool().query(sql,args),{ installation: 'local',...binding }))
      .rejects.toThrow('gateway_ledger_unavailable');
  }
  expect(await admission()).toEqual(before);
});

test('closing the application owner cancels an in-flight history read with no fallback',async () => {
  let release,entered;
  const gate = new Promise(resolve => { release = resolve; }),started = new Promise(resolve => { entered = resolve; });
  const original = fixture.ledger.history;
  fixture.ledger.history = async (...args) => { entered(); await gate; return original(...args); };
  const pending = history().then(() => 'unexpected_success',error => error.code);
  await started; fixture.owner.close(); release();
  expect(await pending).not.toBe('unexpected_success');
  expect(fixture.calls).toHaveLength(0); expect((await admission()).attempts).toBe(0);
});

test('v6 upgrade preserves old bindings and uncertainty without inventing outcomes',async () => {
  await fixture.close(); fixture = null;
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  const sql = name => readFile(new URL(`../../../../database/ollama-gateway/${name}`,import.meta.url),'utf8');
  for (const name of ['20261014_121441_admission.sql','20261014_224242_offline_recovery.sql','20261015_091627_request_binding.sql',
    '20261015_095721_provider_stop.sql','20261015_104932_upstream_peer.sql','20261015_113726_task_source.sql']) await getPool().query(await sql(name));
  await getPool().query(`UPDATE ollama_gateway.admission SET provider_hash=repeat('a',64),owner_id=uuidv7(),attempts=2,binding_count=1,
    active_request=uuidv7(),installation='local',started_at=clock_timestamp(),cooldown_until=clock_timestamp()+interval '1 hour';
    INSERT INTO ollama_gateway.request_binding (ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
      SELECT id,uuidv7(),owner_id,provider_hash,'local',started_at,1,'unbound' FROM ollama_gateway.admission`);
  const before = await admission(),bindings = (await getPool().query('SELECT * FROM ollama_gateway.request_binding')).rows;
  const holder = await getPool().connect(),upgrader = await getPool().connect();
  try {
    await holder.query('SELECT pg_advisory_lock(11435,1)');
    await expect(upgrader.query(await sql('20261015_220007_work_history.sql'))).rejects.toThrow('gateway_must_be_stopped');
    await upgrader.query('ROLLBACK'); await holder.query('SELECT pg_advisory_unlock(11435,1)');
    await upgrader.query(await sql('20261015_220007_work_history.sql'));
    expect(await admission()).toEqual({ ...before,version: 7 });
    expect((await getPool().query('SELECT * FROM ollama_gateway.request_binding')).rows).toEqual(bindings);
    expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=6')).rowCount).toBe(0);
    const ledger = await openGatewayLedger(holder,before.provider_hash);
    expect((await ledger.history('local')).items[0].outcome.state).toBe('outcome_not_recorded');
    expect((await getPool().query('SELECT * FROM ollama_gateway.completion_receipt')).rows).toHaveLength(0);
  } finally { holder.release(true); upgrader.release(true); }
});
