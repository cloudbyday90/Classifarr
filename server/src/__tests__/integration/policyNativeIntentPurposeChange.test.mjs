/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { waitForRepairBlocking as waitForDatabaseBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  policyNativeIntentPurposeChangeReadService,
} = await import('../../services/policyNativeIntentPurposeChangeReadService.mjs');
const {
  policyNativeIntentChangeRecentReceiptDiscoveryService,
} = await import('../../services/policyNativeIntentChangeRecentReceiptDiscoveryService.mjs');
const {
  applyPolicyNativeIntentChange,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
} = await import('../../services/policyNativeIntentChangeService.mjs');
const { policyEngine } = await import('../../services/policyEngine.mjs');

const savedReview = mode => ({ combination_mode: mode, auto_classify_threshold: 95, prompt_threshold: 90,
  trust_patterns: false, trust_rag: false, trust_history: false });

async function createNativePurposeFixture({
  fixtureKey,
  term,
  intentVersion = 3,
  purposeRuleSource = 'native_intent',
  reviewBehavior = {},
}) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Native Purpose Change Media Server',
    libraryExternalIdPrefix: `native-purpose-change-write-${fixtureKey}`,
    libraryName: `Native Purpose Change ${fixtureKey}`,
    policyName: `Native Purpose Change ${fixtureKey} Policy`,
    presetKeyPrefix: `native-purpose-change-write-${fixtureKey}`,
    presetName: 'Native Purpose Change Write Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, $3, TRUE, 'native_intent', 'inferred', $6::jsonb, 'valid')
      RETURNING id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      native_intent.id,
      'purpose',
      'purpose',
      'genres',
      'require_any',
      jsonb_build_object('require_any', jsonb_build_array($4::text)),
      'advisory',
      'identity',
      $5,
      'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, intentVersion, term, purposeRuleSource, JSON.stringify(reviewBehavior)]);

  return fixture;
}

function purposeCommand(term) {
  return {
    command_id: 'update_purpose',
    values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [term] },
      constraint_mode: 'advisory',
      semantics: 'identity',
    }],
  };
}

const changeRequest = (fixture, overrides = {}) => ({ dbClient: db, policyId: fixture.policyId,
  expectedRevision: 3, actorId: 1, actorRole: 'admin', idempotencyKey: randomUUID(),
  changeCommands: [purposeCommand('replacement-token')], ...overrides });
const readVersions = async fixture => (await db.query(
  'SELECT intent_version,active,review_behavior FROM policy_intents WHERE policy_id=$1 ORDER BY intent_version',
  [fixture.policyId])).rows;
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

describe('native intent purpose change integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test.each(['best_match', 'average', 'weighted_average', 'require_all'])(
    'purpose-only revision preserves stored and loaded %s behavior', async mode => {
      const reviewBehavior = savedReview(mode);
      const fixture = await createNativePurposeFixture({ fixtureKey: `behavior-${mode}`, term: 'original-token', reviewBehavior });
      fixtures.push(fixture);
      const before = (await policyEngine.getActivePolicies()).find(policy => policy.id === fixture.policyId);
      expect(before).toMatchObject({ combination_mode: mode, auto_classify_threshold: 95, prompt_threshold: 90,
        trust_patterns: false, trust_rag: false, trust_history: false });
      const applied = await applyPolicyNativeIntentChange({ dbClient: db, policyId: fixture.policyId,
        expectedRevision: 3, actorId: 1, actorRole: 'admin', idempotencyKey: `purpose-${mode}`.padEnd(32, 'x'),
        changeCommands: [purposeCommand('custom-category-token')],
      });
      expect(applied.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
      const { rows: [active] } = await db.query('SELECT review_behavior FROM policy_intents WHERE policy_id=$1 AND active', [fixture.policyId]);
      expect(active.review_behavior).toEqual(reviewBehavior);
      const after = (await policyEngine.getActivePolicies()).find(policy => policy.id === fixture.policyId);
      expect(after).toMatchObject({ combination_mode: mode, auto_classify_threshold: 95, prompt_threshold: 90,
        trust_patterns: false, trust_rag: false, trust_history: false });
    });

  test.each(['update_hard_limits', 'update_avoid_rules', 'update_helpful_matches', 'update_routing_target'])(
    '%s preserves the same locked review JSON', async command_id => {
      const reviewBehavior = savedReview('require_all');
      const fixture = await createNativePurposeFixture({ fixtureKey: command_id, term: 'unchanged-token', reviewBehavior });
      fixtures.push(fixture);
      const result = await applyPolicyNativeIntentChange(changeRequest(fixture, { changeCommands: [{ command_id, values: [] }] }));
      expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
      expect((await readVersions(fixture)).filter(row => row.active)).toEqual([
        { intent_version: 4, active: true, review_behavior: reviewBehavior },
      ]);
    });

  test('an explicit review command still replaces the JSON when purpose changes in the same revision', async () => {
    const fixture = await createNativePurposeFixture({ fixtureKey: 'explicit-review', term: 'original-token', reviewBehavior: savedReview('require_all') });
    fixtures.push(fixture);
    const replacement = { prompt_threshold: 70 };
    const result = await applyPolicyNativeIntentChange(changeRequest(fixture, {
      changeCommands: [purposeCommand('replacement-token'), { command_id: 'update_review_triggers', values: [replacement] }],
    }));
    expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
    expect((await readVersions(fixture)).find(row => row.active).review_behavior).toEqual(replacement);
  });

  test('a receipt-write failure rolls back the version and preserves original settings', async () => {
    const reviewBehavior = savedReview('weighted_average');
    const fixture = await createNativePurposeFixture({ fixtureKey: 'rollback-review', term: 'original-token', reviewBehavior });
    fixtures.push(fixture);
    await db.query(`CREATE FUNCTION fail_purpose_review_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic receipt failure'; END $$;
      CREATE TRIGGER fail_purpose_review_receipt BEFORE INSERT ON policy_native_intent_change_receipts
        FOR EACH ROW EXECUTE FUNCTION fail_purpose_review_receipt()`);
    try {
      const result = await applyPolicyNativeIntentChange(changeRequest(fixture));
      expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.FAILED_ROLLED_BACK);
      expect(await readVersions(fixture)).toEqual([{ intent_version: 3, active: true, review_behavior: reviewBehavior }]);
      expect((await db.query('SELECT count(*)::int AS count FROM policy_native_intent_change_receipts WHERE policy_id=$1', [fixture.policyId])).rows[0].count).toBe(0);
    } finally { await db.query('DROP TRIGGER fail_purpose_review_receipt ON policy_native_intent_change_receipts; DROP FUNCTION fail_purpose_review_receipt()'); }
  });

  test('serialization rejects a stale purpose writer and the next valid change preserves the winning review revision', async () => {
    const original = savedReview('require_all'), replacement = savedReview('weighted_average');
    const fixture = await createNativePurposeFixture({ fixtureKey: 'serialized-review', term: 'original-token', reviewBehavior: original });
    fixtures.push(fixture);
    const ownerReady = deferred(), releaseOwner = deferred(), waiterReady = deferred();
    let ownerPid, waiter;
    const owner = applyPolicyNativeIntentChange(changeRequest(fixture, {
      changeCommands: [{ command_id: 'update_review_triggers', values: [replacement] }],
      dbClient: { withTransaction: fn => db.withTransaction(async client => {
        ownerPid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const result = await fn(client); ownerReady.resolve(); await releaseOwner.promise; return result;
      }) },
    }));
    try {
      await Promise.race([ownerReady.promise, owner.then(() => { throw Error('Owner settled before its commit hold'); })]);
      waiter = applyPolicyNativeIntentChange(changeRequest(fixture, {
        dbClient: { withTransaction: fn => db.withTransaction(async client => {
          const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          waiterReady.resolve(pid); return fn(client);
        }) },
      }));
      const waiterPid = await Promise.race([waiterReady.promise, waiter.then(() => { throw Error('Waiter settled before acquiring a session'); })]);
      await waitForDatabaseBlocking(getPool(), waiterPid);
      expect((await db.query('SELECT $1::int=ANY(pg_blocking_pids($2)) AS blocked', [ownerPid, waiterPid])).rows[0].blocked).toBe(true);
      releaseOwner.resolve();
      expect((await owner).statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
      expect((await waiter).statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION);
      expect((await readVersions(fixture)).find(row => row.active)).toEqual({ intent_version: 4, active: true, review_behavior: replacement });
      const next = await applyPolicyNativeIntentChange(changeRequest(fixture, { expectedRevision: 4 }));
      expect(next.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
      expect((await readVersions(fixture)).find(row => row.active)).toEqual({ intent_version: 5, active: true, review_behavior: replacement });
    } finally {
      releaseOwner.resolve();
      await Promise.allSettled([owner, waiter].filter(Boolean));
    }
  });

  test('lost acknowledgement after real commit retains settings and exact replay creates no extra version', async () => {
    const reviewBehavior = savedReview('average');
    const fixture = await createNativePurposeFixture({ fixtureKey: 'committed-review', term: 'original-token', reviewBehavior });
    fixtures.push(fixture);
    const request = changeRequest(fixture);
    const uncertain = await applyPolicyNativeIntentChange({ ...request, dbClient: {
      withTransaction: async fn => { await db.withTransaction(fn); throw Error('synthetic lost COMMIT reply'); },
    } });
    // Preserve the current failure result; it is not proof that an uncertain commit rolled back.
    expect(uncertain.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.FAILED_ROLLED_BACK);
    expect((await readVersions(fixture)).find(row => row.active)).toEqual({ intent_version: 4, active: true, review_behavior: reviewBehavior });
    const newerReview = savedReview('require_all');
    const newer = await applyPolicyNativeIntentChange(changeRequest(fixture, { expectedRevision: 4,
      changeCommands: [{ command_id: 'update_review_triggers', values: [newerReview] }],
    }));
    expect(newer.change).toMatchObject({ applied: true, newIntentVersion: 5 });
    const beforeReplay = await readVersions(fixture);
    const recovered = await applyPolicyNativeIntentChange(request);
    expect(recovered.change).toMatchObject({ applied: true, replayed: true, newIntentVersion: 4 });
    expect(await readVersions(fixture)).toEqual(beforeReplay);
    expect(beforeReplay).toHaveLength(3);
    expect(beforeReplay.find(row => row.active)).toEqual({ intent_version: 5, active: true, review_behavior: newerReview });
    expect((await db.query('SELECT count(*)::int AS count FROM policy_native_intent_change_receipts WHERE policy_id=$1', [fixture.policyId])).rows[0].count).toBe(2);
  });

  test('reads aggregate profile provenance, commits an explicit native declaration, and rejects a stale new attempt', async () => {
    const fixture = await createNativePurposeFixture({
      fixtureKey: 'target',
      term: 'existing-purpose-token',
      purposeRuleSource: 'media_server_library_profile',
    });
    fixtures.push(fixture);

    const before = await policyNativeIntentPurposeChangeReadService.getPurposeChange({
      dbClient: db,
      policyId: fixture.policyId,
    });

    expect(before).toEqual(expect.objectContaining({
      statusId: 'native_intent_purpose_change_available',
      revision: 3,
      changeCommand: expect.objectContaining({ command_id: 'update_purpose' }),
    }));
    expect(before.changeCommand.values[0].values).toEqual({ require_any: ['existing-purpose-token'] });
    expect(before.changeCommand.values[0]).not.toHaveProperty('source');
    expect(before.changeCommand.values[0]).not.toHaveProperty('inference_state');
    expect(before.purposeProvenance).toEqual({
      id: 'profile_derived',
      declarationRequired: true,
      rawRuleProvenanceExposed: false,
    });

    const applied = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: before.revision,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'a'.repeat(32),
      changeCommands: [purposeCommand('replacement-purpose-token')],
    });

    expect(applied.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
    expect(applied.change).toEqual(expect.objectContaining({
      applied: true,
      newIntentVersion: 4,
      appliedCommandIds: ['update_purpose'],
    }));

    const replayed = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: before.revision,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'a'.repeat(32),
      changeCommands: [purposeCommand('replacement-purpose-token')],
    });
    expect(replayed).toEqual(expect.objectContaining({
      statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED,
      change: expect.objectContaining({
        applied: true,
        replayed: true,
        newIntentVersion: 4,
      }),
    }));

    const recentReceipt = await policyNativeIntentChangeRecentReceiptDiscoveryService.getRecentReceipt({
      dbClient: db,
      policyId: fixture.policyId,
      actorId: 1,
    });
    expect(recentReceipt).toEqual(expect.objectContaining({
      statusId: 'native_intent_change_recent_receipt_discovery_complete',
      policyId: fixture.policyId,
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 3,
        targetIntentVersion: 4,
      },
      idempotencyKeyExposed: false,
      commandFingerprintExposed: false,
      commandValuesExposed: false,
      receiptHistoryExposed: false,
    }));

    const otherActorReceipt = await policyNativeIntentChangeRecentReceiptDiscoveryService.getRecentReceipt({
      dbClient: db,
      policyId: fixture.policyId,
      actorId: 2,
    });
    expect(otherActorReceipt).toEqual(expect.objectContaining({
      statusId: 'native_intent_change_recent_receipt_discovery_complete',
      recentChange: null,
    }));

    const after = await policyNativeIntentPurposeChangeReadService.getPurposeChange({
      dbClient: db,
      policyId: fixture.policyId,
    });

    expect(after).toEqual(expect.objectContaining({
      statusId: 'native_intent_purpose_change_available',
      revision: 4,
    }));
    expect(after.changeCommand.values[0].values).toEqual({ require_any: ['replacement-purpose-token'] });
    expect(after.purposeProvenance).toEqual({
      id: 'declared_native',
      declarationRequired: false,
      rawRuleProvenanceExposed: false,
    });

    const stale = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: before.revision,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      changeCommands: [purposeCommand('second-replacement-token')],
    });

    expect(stale.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION);

    const persisted = await db.query(`
      SELECT intent_version, active
      FROM policy_intents
      WHERE policy_id = $1
      ORDER BY intent_version
    `, [fixture.policyId]);
    expect(persisted.rows).toEqual([
      expect.objectContaining({ intent_version: 3, active: false }),
      expect.objectContaining({ intent_version: 4, active: true }),
    ]);

    const appliedPurposeRule = await db.query(`
      SELECT rule.source, rule.inference_state
      FROM policy_intents intent
      JOIN policy_intent_rules rule ON rule.intent_id = intent.id
      WHERE intent.policy_id = $1
        AND intent.active = TRUE
        AND rule.intent_role = 'purpose'
    `, [fixture.policyId]);
    expect(appliedPurposeRule.rows).toEqual([{
      source: 'native_intent',
      inference_state: 'inferred',
    }]);

    const receipts = await db.query(`
      SELECT actor_id, source_intent_version, target_intent_version,
        applied_command_ids, result_status_id
      FROM policy_native_intent_change_receipts
      WHERE policy_id = $1
    `, [fixture.policyId]);
    expect(receipts.rows).toEqual([expect.objectContaining({
      actor_id: 1,
      source_intent_version: 3,
      target_intent_version: 4,
      applied_command_ids: ['update_purpose'],
      result_status_id: 'applied',
    })]);

    await expect(db.query(
      'DELETE FROM policy_native_intent_change_receipts WHERE policy_id = $1',
      [fixture.policyId],
    )).rejects.toThrow('Native intent change receipts are append-only');
  });
});
