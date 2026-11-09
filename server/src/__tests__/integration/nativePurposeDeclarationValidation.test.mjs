/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { default: db } = await import('../../config/database.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { createNativeIntentPolicyInTransaction } = await import('../../services/policyNativeIntentCreateService.mjs');
const { applyPolicyNativeIntentChange } = await import('../../services/policyNativeIntentChangeService.mjs');
const { buildPolicyNativeIntentChangeAdmission } = await import('../../services/policyNativeIntentChangeAdmission.mjs');
const { buildPolicyNativeIntentChangeCommandFingerprint, buildPolicyNativeIntentChangeReceiptRecord } =
  await import('../../services/policyNativeIntentChangeReceiptContract.mjs');
const { insertPolicyNativeIntentChangeReceipt } = await import('../../services/policyNativeIntentChangeReceiptPersistence.mjs');
const { insertNativeIntentChangeEvent } = await import('../../services/policyNativeIntentChangePersistence.mjs');

const supported = { signal_type: 'genres', operator: 'include', values: { include: ['custom-token'] } };
const unsupported = [
  { signal_type: 'genres', operator: 'exclude', values: { exclude: ['custom-token'] } },
  { ...supported, values: { include: ['custom-token'], exclude: ['other'] } },
  { ...supported, values: { prefer: ['custom-token'] } },
  { signal_type: 'genres', operator: 'max', values: { max: 5 } },
];
const request = rule => ({ schema_version: 1, idempotency_key: randomUUID(), declared_intent: {
  purpose: [rule], hard_limits: [], helpful_hints: [], avoid: [],
} });
function tracingDatabase(statements) {
  return { withTransaction: work => db.withTransaction(client => work({ query: async (sql, params) => {
    statements.push(sql);
    try { return await client.query(sql, params); }
    catch (error) { statements.push(`synthetic_fixture_error: ${error.message}`); throw error; }
  } })) };
}
const assertNoDml = statements => expect(statements.filter(sql => /^\s*(?:INSERT|UPDATE|DELETE)\b/um.test(sql))).toEqual([]);

describe('fresh purpose validation with real PostgreSQL transactions', () => {
  const fixtures = [];
  beforeAll(async () => {
    await db.query("INSERT INTO users(id,username,password_hash,role) VALUES(1,'purpose-fixture-admin','synthetic-not-a-credential','admin') ON CONFLICT(id) DO NOTHING");
  });
  async function fixture() {
    const key = randomUUID();
    const item = await createPolicyEngineIntegrationFixture(db, {
      policyName: `Purpose validation ${key}`, libraryName: `Purpose validation ${key}`,
    });
    fixtures.push(item);
    await db.query('DELETE FROM policy_presets WHERE policy_id=$1', [item.policyId]);
    return item;
  }
  afterAll(async () => { for (const item of fixtures.reverse()) await item.cleanup(); });

  test.each(unsupported)('initial establishment refuses unsupported materialization without DML: %j', async rule => {
    const item = await fixture(), statements = [];
    const result = await applyPolicyInitialIntentEstablishment({ dbClient: tracingDatabase(statements),
      policyId: item.policyId, actorId: 1, request: request(rule) });
    expect(result.validation.issues[0].riskId).toBe('unsupported_purpose_declaration');
    assertNoDml(statements);
    expect((await db.query('SELECT count(*)::int AS count FROM policy_initial_intent_establishments WHERE policy_id=$1', [item.policyId])).rows[0].count).toBe(0);
  });

  test('native create refuses before INSERT and before consuming a policy sequence', async () => {
    const item = await fixture(), statements = [];
    const before = (await db.query('SELECT last_value FROM library_policies_id_seq')).rows[0].last_value;
    await expect(tracingDatabase(statements).withTransaction(client => createNativeIntentPolicyInTransaction({
      client, policy: { libraryId: item.libraryId, name: 'Must never be inserted' }, actorId: 1,
      establishmentRequest: request(unsupported[0]),
    }))).rejects.toMatchObject({ code: 'POLICY_PURPOSE_DECLARATION_UNSUPPORTED', statusCode: 400 });
    assertNoDml(statements);
    expect((await db.query('SELECT last_value FROM library_policies_id_seq')).rows[0].last_value).toBe(before);
  });

  test('fresh change refuses before DML, while a seeded historical receipt recovers before current revision validation', async () => {
    const item = await fixture();
    const initialStatements = [];
    const initial = await applyPolicyInitialIntentEstablishment({ dbClient: tracingDatabase(initialStatements), policyId: item.policyId, actorId: 1, request: request(supported) });
    expect(initialStatements.filter(sql => sql.startsWith('synthetic_fixture_error:'))).toEqual([]);
    expect(initial.establishment.applied).toBe(true);
    const change = { policyId: item.policyId, expectedRevision: 1, actorId: 1, actorRole: 'admin',
      idempotencyKey: randomUUID(), changeCommands: [{ command_id: 'update_purpose', values: [unsupported[0]] }] };
    const statements = [];
    expect((await applyPolicyNativeIntentChange({ ...change, dbClient: tracingDatabase(statements) })).risks[0].riskId)
      .toBe('unsupported_purpose_declaration');
    assertNoDml(statements);
    // Synthetic old-writer receipt: freeze its canonical command binding without running an obsolete writer.
    const admission = buildPolicyNativeIntentChangeAdmission(change);
    const fingerprint = buildPolicyNativeIntentChangeCommandFingerprint({ ...change, changeCommands: admission.admittedCommands });
    await db.withTransaction(async client => {
      await client.query('UPDATE policy_intents SET active=FALSE WHERE id=$1', [initial.establishment.intentId]);
      const { rows: [historical] } = await client.query(`INSERT INTO policy_intents
        (policy_id,library_id,schema_version,intent_version,active,source,inference_state,review_behavior,validation_status)
        VALUES ($1,$2,1,2,TRUE,'native_intent','inferred','{}','valid') RETURNING id`, [item.policyId, item.libraryId]);
      await client.query(`INSERT INTO policy_intent_rules
        (intent_id,intent_role,collection,signal_type,operator,values,constraint_mode,semantics,source,inference_state)
        VALUES ($1,'purpose','purpose','genres','exclude','{"exclude":["custom-token"]}','advisory','identity','native_intent','inferred')`, [historical.id]);
      const eventId = await insertNativeIntentChangeEvent({ client, intentId: historical.id,
        policyId: item.policyId, actorType: 'operator', actorId: 1, sourceVersion: 1, targetVersion: 2,
        reasonCode: 'native_intent_change', summary: 'Synthetic historical receipt fixture', metadata: {} });
      await insertPolicyNativeIntentChangeReceipt({ client, receipt: buildPolicyNativeIntentChangeReceiptRecord({
        policyId: item.policyId, actorId: 1, idempotencyKey: change.idempotencyKey, commandFingerprint: fingerprint,
        sourceIntentVersion: 1, targetIntentId: historical.id, targetIntentVersion: 2,
        migrationEventId: eventId, appliedCommandIds: ['update_purpose'], createdAt: new Date(),
      }) });
    });
    const newer = await applyPolicyNativeIntentChange({ ...change, dbClient: db, expectedRevision: 2,
      idempotencyKey: randomUUID(), changeCommands: [{ command_id: 'update_review_triggers', values: [{}] }] });
    expect(newer.change.newIntentVersion).toBe(3);
    statements.length = 0;
    const replay = await applyPolicyNativeIntentChange({ ...change, dbClient: tracingDatabase(statements) });
    expect(replay.change).toMatchObject({ replayed: true, newIntentVersion: 2 });
    assertNoDml(statements);
    expect((await applyPolicyNativeIntentChange({ ...change, actorId: 2, dbClient: db })).statusId).toBe('idempotency_key_reused');
    expect((await applyPolicyNativeIntentChange({ ...change, idempotencyKey: randomUUID(), dbClient: db })).statusId).toBe('stale_revision');
  });

  test('lost acknowledgement after initial commit recovers exactly without another establishment', async () => {
    const item = await fixture(), payload = request(supported);
    const args = { policyId: item.policyId, actorId: 1, request: payload };
    const result = await applyPolicyInitialIntentEstablishment({ ...args, dbClient: { withTransaction: async work => {
      await db.withTransaction(work); throw Error('Synthetic lost COMMIT acknowledgement');
    } } });
    expect(result.statusId).toBe('initial_intent_establishment_failed_rolled_back');
    const statements = [];
    const replay = await applyPolicyInitialIntentEstablishment({ ...args, dbClient: tracingDatabase(statements) });
    expect(replay.establishment.replayed).toBe(true);
    assertNoDml(statements);
    expect((await db.query('SELECT count(*)::int AS count FROM policy_intents WHERE policy_id=$1', [item.policyId])).rows[0].count).toBe(1);
  });
});
