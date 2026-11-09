/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { waitForRepairBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { default: db } = await import('../../config/database.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { applyPolicyNativeIntentChange } = await import('../../services/policyNativeIntentChangeService.mjs');
const { attachActiveNativeIntentForPolicy } = await import('../../services/policyNativePolicyReadService.mjs');
const { buildInitialPolicyIntentContract, buildInitialIntentRequestFingerprint, validatePolicyInitialIntentEstablishmentRequest } =
  await import('../../services/policyInitialIntentEstablishmentContract.mjs');
const persistence = await import('../../services/policyInitialIntentEstablishmentPersistence.mjs');
const { registerPolicyInitialIntentEstablishmentRoutes } = await import('../../routes/policiesRouteInitialIntentEstablishment.mjs');
const { registerPolicyWriteRoutes } = await import('../../routes/policiesRoutePolicyWrite.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');
const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');
const { evaluateNativePolicyIntent } = await import('../../services/policyNativeIntentRuntimeEvaluator.mjs');
const { readNativeIntentContribution } = await import('../../services/policyNativeIntentContribution.mjs');

const payload = semantics => ({ schema_version: 1, idempotency_key: randomUUID(), declared_intent: {
  purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['custom-token'] },
    ...(semantics === undefined ? {} : { semantics }) }],
} });
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
function app(role = 'admin') {
  const server = express(), router = express.Router();
  server.use(express.json()); server.use((req, _res, next) => { req.user = { id: 1, role }; next(); });
  registerPolicyInitialIntentEstablishmentRoutes(router, { db, logger });
  registerPolicyWriteRoutes(router, { db, logger,
    DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD: 85, DEFAULT_POLICY_PROMPT_THRESHOLD: 60 });
  server.use('/api/policies', router); server.use(errorHandler); return server;
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

describe('initial purpose semantics PostgreSQL and HTTP contracts', () => {
  const fixtures = [], createdPolicies = [];
  beforeAll(async () => { await db.query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'semantics-fixture-admin','synthetic-not-a-credential','admin') ON CONFLICT(id) DO NOTHING"); });
  async function fixture() {
    const key = randomUUID(), value = await createPolicyEngineIntegrationFixture(db, { libraryName: `Semantics ${key}`, policyName: `Semantics ${key}` });
    fixtures.push(value); await db.query('DELETE FROM policy_presets WHERE policy_id=$1', [value.policyId]); return value;
  }
  afterAll(async () => {
    for (const id of createdPolicies) await db.query('DELETE FROM library_policies WHERE id=$1', [id]);
    for (const value of fixtures.reverse()) await value.cleanup();
  });
  const load = async policyId => attachActiveNativeIntentForPolicy({ dbClient: db,
    policy: (await db.query('SELECT * FROM library_policies WHERE id=$1', [policyId])).rows[0] });
  const establish = (value, body, database = db) => applyPolicyInitialIntentEstablishment({ dbClient: database, policyId: value.policyId, actorId: 1, request: body });

  test.each([undefined, null, 'identity', 'compatibility'])('initial HTTP persists and loads requested %s with unchanged defaults', async semantics => {
    const value = await fixture(), body = payload(semantics);
    await request(app()).post(`/api/policies/${value.policyId}/native-intent/initial-establishment`).send(body).expect(201);
    expect((await load(value.policyId)).native_intent.contract.purpose[0].semantics).toBe(semantics ?? 'identity');
    const runtimePolicy = (await getActivePolicies({ dbClient: db, throwOnError: true })).find(policy => policy.id === value.policyId);
    const item = { media_type: 'movie', tmdb_id: 42, genres: ['custom-token'] };
    const runtime = evaluateNativePolicyIntent(runtimePolicy, item);
    expect(readNativeIntentContribution(runtime, runtimePolicy, item)).toEqual({ score: 80, evidenceMode: semantics ?? 'identity' });
    await request(app()).post(`/api/policies/${value.policyId}/native-intent/initial-establishment`).send(body).expect(200);
    const other = structuredClone(body); other.declared_intent.purpose[0].semantics = semantics === 'compatibility' ? 'identity' : 'compatibility';
    await request(app()).post(`/api/policies/${value.policyId}/native-intent/initial-establishment`).send(other).expect(409);
  });
  test('native create HTTP preserves compatibility and exact recovery without another policy', async () => {
    const value = await fixture(), key = randomUUID(), body = { library_id: value.libraryId,
      name: `Created ${randomUUID()}`, native_intent_establishment: { declared_intent: payload('compatibility').declared_intent } };
    await db.query('DELETE FROM library_policies WHERE id=$1', [value.policyId]);
    const first = await request(app()).post('/api/policies').set('Idempotency-Key', `"${key}"`).send(body).expect(201);
    const id = first.body.id; createdPolicies.push(id);
    expect((await load(id)).native_intent.contract.purpose[0].semantics).toBe('compatibility');
    const replay = await request(app()).post('/api/policies').set('Idempotency-Key', `"${key}"`).send(body).expect(200);
    expect(replay.body.id).toBe(id);
    await request(app('user')).post('/api/policies').set('Idempotency-Key', `"${randomUUID()}"`).send(body).expect(403);
  });
  test('an old compatibility request recovers its original identity after a later revision without rewriting it', async () => {
    const value = await fixture(), body = validatePolicyInitialIntentEstablishmentRequest(payload('compatibility'));
    const policy = (await db.query('SELECT * FROM library_policies WHERE id=$1', [value.policyId])).rows[0];
    const contract = buildInitialPolicyIntentContract({ policy, declaredIntent: body.declared_intent });
    contract.purpose[0].semantics = 'identity'; // Explicit synthetic pre-fix stored representation.
    const establishedAt = new Date().toISOString(), fingerprint = buildInitialIntentRequestFingerprint(body);
    let oldIntent;
    await db.withTransaction(async client => {
      const establishmentId = await persistence.reserveInitialEstablishment({ client, policyId: policy.id, libraryId: policy.library_id,
        idempotencyKey: body.idempotency_key, requestFingerprint: fingerprint, actorId: 1 });
      oldIntent = await persistence.insertInitialNativeIntentHeader({ client, policy, contract, actorId: 1, establishedAt });
      await persistence.insertInitialIntentRules({ client, intentId: oldIntent, contract });
      await persistence.insertInitialIntentValidationStatus({ client, intentId: oldIntent, contract });
      await persistence.insertInitialIntentRoutingTarget({ client, intentId: oldIntent, policy, routingTarget: null });
      const event = await persistence.insertInitialIntentMigrationEvent({ client, intentId: oldIntent, policyId: policy.id, actorId: 1, requestFingerprint: fingerprint });
      const snapshot = await persistence.insertInitialIntentRollbackSnapshot({ client, intentId: oldIntent, policy, routingTarget: null, establishedAt });
      await persistence.completeInitialEstablishment({ client, establishmentId, intentId: oldIntent, migrationEventId: event, rollbackSnapshotId: snapshot, establishedAt });
    });
    const newer = await applyPolicyNativeIntentChange({ dbClient: db, policyId: value.policyId, actorId: 1, actorRole: 'admin',
      expectedRevision: 1, idempotencyKey: randomUUID(), changeCommands: [{ command_id: 'update_review_triggers', values: [{}] }] });
    expect(newer.change.newIntentVersion).toBe(2);
    const replay = await establish(value, body);
    expect(replay.establishment).toMatchObject({ replayed: true, intentId: Number(oldIntent) });
    expect((await load(value.policyId)).native_intent.contract.purpose[0].semantics).toBe('identity');
    const createReplay = await request(app()).post('/api/policies').set('Idempotency-Key', `"${body.idempotency_key}"`)
      .send({ library_id: policy.library_id, name: policy.name, native_intent_establishment: { declared_intent: body.declared_intent } }).expect(200);
    expect(createReplay.body.id).toBe(value.policyId);
    expect((await db.query('SELECT count(*)::int AS count FROM policy_intents WHERE policy_id=$1', [value.policyId])).rows[0].count).toBe(2);
  });
  test('a queued same-key semantics change cannot replace the committed declaration', async () => {
    const value = await fixture(), firstBody = payload('compatibility'), ready = deferred(), release = deferred(), waiterReady = deferred();
    const first = establish(value, firstBody, { withTransaction: work => db.withTransaction(async client => {
      const result = await work(client); ready.resolve(); await release.promise; return result;
    }) });
    let waiter;
    try {
      await Promise.race([ready.promise, first.then(() => { throw Error('Owner settled before commit hold'); })]);
      const changed = structuredClone(firstBody); changed.declared_intent.purpose[0].semantics = 'identity';
      waiter = establish(value, changed, { withTransaction: work => db.withTransaction(async client => {
        waiterReady.resolve((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid); return work(client);
      }) });
      const pid = await Promise.race([waiterReady.promise, waiter.then(() => { throw Error('Waiter settled before acquiring a session'); })]);
      await waitForRepairBlocking(getPool(), pid); release.resolve();
      expect((await first).establishment.applied).toBe(true);
      expect((await waiter).validation.issues[0].riskId).toBe('idempotency_key_reused');
      expect((await load(value.policyId)).native_intent.contract.purpose[0].semantics).toBe('compatibility');
    } finally { release.resolve(); await Promise.allSettled([first, waiter].filter(Boolean)); }
  });
  test('lost COMMIT acknowledgement preserves compatibility and exact recovery; audit failure rolls back', async () => {
    const value = await fixture(), body = payload('compatibility');
    const uncertain = await establish(value, body, { withTransaction: async work => { await db.withTransaction(work); throw Error('Synthetic lost COMMIT reply'); } });
    expect(uncertain.statusId).toBe('initial_intent_establishment_failed_rolled_back');
    expect((await establish(value, body)).establishment.replayed).toBe(true);
    expect((await load(value.policyId)).native_intent.contract.purpose[0].semantics).toBe('compatibility');
    const rollback = await fixture();
    const refused = await establish(rollback, payload('compatibility'), { withTransaction: work => db.withTransaction(client => work({ query: (sql, params) => {
      if (sql.includes('INSERT INTO policy_intent_migration_events')) throw Error('Synthetic audit failure');
      return client.query(sql, params);
    } })) });
    expect(refused.statusId).toBe('initial_intent_establishment_failed_rolled_back');
    expect((await db.query('SELECT count(*)::int AS count FROM policy_intents WHERE policy_id=$1', [rollback.policyId])).rows[0].count).toBe(0);
    expect((await db.query('SELECT count(*)::int AS count FROM policy_initial_intent_establishments WHERE policy_id=$1', [rollback.policyId])).rows[0].count).toBe(0);
  });
});
