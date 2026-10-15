/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { getPool } from './setup.mjs';
import { openGatewayLedger } from '../../ollamaGateway/ledger.mjs';
import { runProviderStopController } from '../../ollamaGateway/providerStopController.mjs';
import { runGatewayRecovery } from '../../ollamaGateway/recoveryRepository.mjs';
import { withDockerStopFixture } from '../helpers/dockerStopFixture.mjs';

const sql = name => readFile(new URL(`../../../../database/ollama-gateway/${name}`,import.meta.url),'utf8');
const providerHash = 'd'.repeat(64);
let clients;
const connect = async () => { const c = await getPool().connect(); clients.push(c); return c; };
const row = async () => (await getPool().query('SELECT * FROM ollama_gateway.admission')).rows[0];
const intents = async () => (await getPool().query('SELECT * FROM ollama_gateway.provider_stop_intent')).rows;
const observations = async () => (await getPool().query('SELECT * FROM ollama_gateway.provider_stop_observation')).rows;
async function fixture(data,bound = true) {
  const { socketPath,...pins } = data.config;
  const c = await connect(),ledger = await openGatewayLedger(c,providerHash,bound ? pins : null);
  const requestId = await ledger.claim('fixture'); await c.query('SELECT pg_advisory_unlock(11435,1)');
  return { database: { host: '127.0.0.1',database: 'synthetic',user: 'synthetic' },providerHash,requestId,
    boundary: { socketPath,...pins },networkId: data.network.Id };
}
const run = async (configuration,action = 'plan',review,client,signal) => runProviderStopController(client ?? await connect(),{ configuration,action,review,signal });
async function reviewed(config) {
  const { expected } = await run(config); await delay(2);
  return { version: 1,expected,operatorRef: 'fixture-admin',evidenceRef: 'fixture-isolation',observedAt: new Date().toISOString(),
    assertions: { dedicatedProvider: true,exclusiveDockerControl: true,allOtherConsumersStopped: true,stopApproved: true } };
}
const wrap = (client,query) => ({ query,on: (...args) => client.on(...args),removeListener: (...args) => client.removeListener(...args) });
beforeEach(async () => {
  clients = [];
  await getPool().query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE'); // Owned isolated suite DB only.
  await getPool().query(await sql('current.sql'));
});
afterEach(() => { for (const client of clients) client.release(true); });

test('one committed intent precedes Docker stop; admission untouched; repeat refused; inspect never contacts Docker',async () => {
  let committed;
  await withDockerStopFixture(async data => {
    const config = await fixture(data),before = await row(),review = await reviewed(config);
    expect(await intents()).toHaveLength(0); expect(data.requests.every(r => r.method === 'GET')).toBe(true);
    const result = await run(config,'stop',review);
    expect(result).toMatchObject({ evidenceKind: 'docker_stop_observed',recoveryAuthorized: false });
    expect(committed).toHaveLength(1); expect(await observations()).toHaveLength(1); expect(await row()).toEqual(before);
    expect((await getPool().query('SELECT uuid_extract_version(id) AS v FROM ollama_gateway.provider_stop_intent UNION ALL SELECT uuid_extract_version(id) FROM ollama_gateway.provider_stop_observation')).rows).toEqual([{ v: 7 },{ v: 7 }]);
    await expect(run(config,'stop',review)).rejects.toThrow('gateway_stop_already_attempted');
    const count = data.requests.length;
    expect((await run(config,'inspect')).history).toMatchObject({ intent_id: result.intentId,observation_id: result.observationId,recoveryAuthorized: false });
    expect(data.requests).toHaveLength(count); expect(data.requests.filter(r => r.method === 'POST')).toHaveLength(1);
    const recovered = await runGatewayRecovery(await connect(),{ providerHash,action: 'inspect' });
    expect(recovered.providerStop).toMatchObject({ intent_id: result.intentId,recoveryAuthorized: false });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  },(req,res,data) => {
    if (req.method !== 'POST') return false;
    void intents().then(rows => {
      committed = rows;
      Object.assign(data.container.State,{ Status: 'exited',Running: false,Pid: 0,FinishedAt: new Date().toISOString() });
      data.network.Containers = {}; res.writeHead(204); res.end();
    });
    return true;
  });
});

test.each(['unbound','wrong_pin','stale_owner','stale_time','revoked_review','changed_network'])('refuses %s without a Docker mutation',async kind => withDockerStopFixture(async data => {
  const config = await fixture(data,kind !== 'unbound');
  if (kind === 'unbound') { await expect(run(config)).rejects.toThrow('gateway_stop_binding_required'); return; }
  const review = await reviewed(config);
  if (kind === 'wrong_pin') config.boundary.containerId = 'e'.repeat(64);
  if (kind === 'stale_owner') await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7()');
  if (kind === 'stale_time') review.observedAt = '2000-01-01T00:00:00.000Z';
  if (kind === 'revoked_review') review.assertions.stopApproved = false;
  if (kind === 'changed_network') data.network.Labels.change = 'new';
  await expect(run(config,'stop',review)).rejects.toThrow();
  expect(data.requests.filter(r => r.method === 'POST')).toHaveLength(0); expect(await intents()).toHaveLength(0);
}));

test.each(['insert_failure','lost_intent_reply','cancel_after_intent','connection_loss'])('%s prevents dispatch and preserves the pending request',async kind => withDockerStopFixture(async data => {
  const config = await fixture(data),review = await reviewed(config),before = await row(),client = await connect(),controller = new AbortController();
  const wrapped = wrap(client,async (...args) => {
    const intent = args[0].startsWith('INSERT INTO ollama_gateway.provider_stop_intent');
    if (intent && kind === 'insert_failure') throw new Error('PRIVATE');
    const result = await client.query(...args);
    if (intent && kind === 'lost_intent_reply') throw new Error('PRIVATE');
    if (intent && kind === 'cancel_after_intent') controller.abort();
    if (intent && kind === 'connection_loss') client.emit('error',new Error('PRIVATE'));
    return result;
  });
  await expect(run(config,'stop',review,wrapped,controller.signal)).rejects.toThrow('gateway_stop_outcome_unknown');
  expect(await intents()).toHaveLength(kind === 'insert_failure' ? 0 : 1);
  expect(await observations()).toHaveLength(0); expect(await row()).toEqual(before);
  expect(data.requests.filter(r => r.method === 'POST')).toHaveLength(0);
  if (kind !== 'insert_failure') await expect(run(config,'stop',review)).rejects.toThrow('gateway_stop_already_attempted');
}));

test.each(['lost_stop_reply','still_running','restarted','new_peer','observation_failure','lost_observation_reply'])('%s leaves the intent and original uncertainty without repeating stop',async kind => {
  await withDockerStopFixture(async data => {
    const config = await fixture(data),review = await reviewed(config),before = await row(),client = await connect();
    const wrapped = wrap(client,async (...args) => {
      const recording = args[0].startsWith('INSERT INTO ollama_gateway.provider_stop_observation');
      if (recording && kind === 'observation_failure') throw new Error('PRIVATE');
      const result = await client.query(...args);
      if (recording && kind === 'lost_observation_reply') throw new Error('PRIVATE');
      return result;
    });
    await expect(run(config,'stop',review,wrapped)).rejects.toThrow('gateway_stop_outcome_unknown');
    expect(await intents()).toHaveLength(1); expect(await observations()).toHaveLength(kind === 'lost_observation_reply' ? 1 : 0);
    await expect(run(config,'stop',review)).rejects.toThrow('gateway_stop_already_attempted');
    expect(data.requests.filter(r => r.method === 'POST')).toHaveLength(1); expect(await row()).toEqual(before);
  },(req,res,data) => {
    if (req.method !== 'POST') return false;
    if (kind === 'lost_stop_reply') { res.destroy(); return true; }
    if (kind === 'still_running') { res.writeHead(204); res.end(); return true; }
    if (kind === 'restarted') data.container.State.StartedAt = new Date().toISOString();
    if (kind === 'new_peer') { data.network.Containers['e'.repeat(64)] = {}; res.writeHead(204); res.end(); return true; }
    return false;
  });
});

test('gateway lock and reentrant sessions cannot be used to stop an active gateway',async () => withDockerStopFixture(async data => {
  const config = await fixture(data),client = await connect();
  await client.query('SELECT pg_advisory_lock(11435,1)');
  await expect(run(config,'plan',undefined,client)).rejects.toThrow('gateway_stop_dedicated_session_required');
  await expect(run(config)).rejects.toThrow('gateway_stop_gateway_running'); expect(data.requests).toHaveLength(0);
}));

test('restricted controller can journal but cannot clear requests, reset attempts or rewrite history',async () => withDockerStopFixture(async data => {
  const config = await fixture(data),review = await reviewed(config),client = await connect();
  await getPool().query(`CREATE ROLE gateway_stop_test; GRANT USAGE ON SCHEMA ollama_gateway TO gateway_stop_test;
    GRANT SELECT ON ollama_gateway.admission,ollama_gateway.request_binding TO gateway_stop_test;
    GRANT SELECT,INSERT ON ollama_gateway.provider_stop_intent,ollama_gateway.provider_stop_observation TO gateway_stop_test`);
  await client.query('SET ROLE gateway_stop_test');
  expect((await run(config,'stop',review,client)).evidenceKind).toBe('docker_stop_observed');
  for (const statement of ['UPDATE ollama_gateway.admission SET active_request=NULL','UPDATE ollama_gateway.admission SET attempts=0',
    'DELETE FROM ollama_gateway.provider_stop_intent','TRUNCATE ollama_gateway.provider_stop_observation']) {
    await expect(client.query(statement)).rejects.toMatchObject({ code: '42501' });
  }
  await expect(getPool().query('UPDATE ollama_gateway.provider_stop_intent SET attempts=attempts')).rejects.toMatchObject({ code: '42501' });
}));

test('v4 migration preserves pending v3 state, refuses a running gateway and fences v3 claims',async () => withDockerStopFixture(async data => {
  await getPool().query('DROP SCHEMA ollama_gateway CASCADE');
  for (const name of ['20261014_121441_admission.sql','20261014_224242_offline_recovery.sql','20261015_091627_request_binding.sql']) await getPool().query(await sql(name));
  await getPool().query(`UPDATE ollama_gateway.admission SET owner_id=uuidv7(),provider_hash=$1,active_request=uuidv7(),
    installation='legacy',started_at=clock_timestamp(),attempts=23,cooldown_until=clock_timestamp()+interval '1 hour'`,[providerHash]);
  const before = await row(),holder = await connect(),upgrader = await connect();
  await holder.query('SELECT pg_advisory_lock(11435,1)');
  await expect(upgrader.query(await sql('20261015_095721_provider_stop.sql'))).rejects.toThrow('gateway_must_be_stopped');
  await upgrader.query('ROLLBACK'); await holder.query('SELECT pg_advisory_unlock(11435,1)');
  await upgrader.query(await sql('20261015_095721_provider_stop.sql'));
  expect(await row()).toEqual({ ...before,version: 4 }); expect(await intents()).toHaveLength(0);
  expect((await getPool().query('UPDATE ollama_gateway.admission SET owner_id=uuidv7() WHERE version=3')).rowCount).toBe(0);
  expect(data.requests).toHaveLength(0);
}));
