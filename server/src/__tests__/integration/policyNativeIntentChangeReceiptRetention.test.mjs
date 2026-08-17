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
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  applyPolicyNativeIntentChange,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
} = await import('../../services/policyNativeIntentChangeService.mjs');
const {
  policyNativeIntentChangeRecentReceiptDiscoveryService,
} = await import('../../services/policyNativeIntentChangeRecentReceiptDiscoveryService.mjs');
const {
  PolicyNativeIntentChangeReceiptRetentionService,
} = await import('../../services/policyNativeIntentChangeReceiptRetentionService.mjs');

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

async function createNativePurposeFixture({ fixtureKey, term }) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Native Intent Change Receipt Retention Media Server',
    libraryExternalIdPrefix: `native-intent-receipt-retention-${fixtureKey}`,
    libraryName: `Native Intent Receipt Retention ${fixtureKey}`,
    policyName: `Native Intent Receipt Retention ${fixtureKey} Policy`,
    presetKeyPrefix: `native-intent-receipt-retention-${fixtureKey}`,
    presetName: 'Native Intent Receipt Retention Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, 3, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
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
      jsonb_build_object('require_any', jsonb_build_array($3::text)),
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, term]);

  return fixture;
}

describe('native intent change receipt retention integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test('prunes only an expired receipt, preserves a recent discovery result, and cannot turn an old key into a second revision', async () => {
    const fixture = await createNativePurposeFixture({
      fixtureKey: 'bounded-retention',
      term: 'existing-purpose-token',
    });
    fixtures.push(fixture);

    const firstKey = 'c'.repeat(32);
    const first = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: 3,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: firstKey,
      changeCommands: [purposeCommand('first-purpose-token')],
    });
    expect(first.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);

    const second = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: 4,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'd'.repeat(32),
      changeCommands: [purposeCommand('second-purpose-token')],
    });
    expect(second.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);

    const receipts = await db.query(`
      SELECT
        id,
        receipt_version,
        policy_id,
        actor_id,
        idempotency_key,
        command_fingerprint,
        source_intent_version,
        target_intent_id,
        target_intent_version,
        migration_event_id,
        applied_command_ids,
        result_status_id
      FROM policy_native_intent_change_receipts
      WHERE policy_id = $1
      ORDER BY target_intent_version ASC
    `, [fixture.policyId]);
    const expiredReceipt = receipts.rows[0];
    const recentReceiptId = receipts.rows[1].id;

    await db.withTransaction(async client => {
      await client.query(
        "SELECT set_config('classifarr.policy_native_intent_change_receipt_maintenance', 'replace_restore', true)",
      );
      await client.query(
        `DELETE FROM policy_native_intent_change_receipts
         WHERE id = $1`,
        [expiredReceipt.id],
      );
      await client.query(
        `INSERT INTO policy_native_intent_change_receipts (
           receipt_version,
           policy_id,
           actor_id,
           idempotency_key,
           command_fingerprint,
           source_intent_version,
           target_intent_id,
           target_intent_version,
           migration_event_id,
           applied_command_ids,
           result_status_id,
           created_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11,
           NOW() - INTERVAL '31 days'
         )`,
        [
          expiredReceipt.receipt_version,
          expiredReceipt.policy_id,
          expiredReceipt.actor_id,
          expiredReceipt.idempotency_key,
          expiredReceipt.command_fingerprint,
          expiredReceipt.source_intent_version,
          expiredReceipt.target_intent_id,
          expiredReceipt.target_intent_version,
          expiredReceipt.migration_event_id,
          JSON.stringify(expiredReceipt.applied_command_ids),
          expiredReceipt.result_status_id,
        ],
      );
    });

    await expect(db.withTransaction(async client => {
      await client.query(
        "SELECT set_config('classifarr.policy_native_intent_change_receipt_maintenance', 'retention_cleanup', true)",
      );
      return client.query(
        'DELETE FROM policy_native_intent_change_receipts WHERE id = $1',
        [recentReceiptId],
      );
    })).rejects.toThrow('Native intent change receipts are append-only');

    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() };
    const retentionService = new PolicyNativeIntentChangeReceiptRetentionService({
      db,
      logger,
      lockKey: 2013,
    });
    const cleanup = await retentionService.cleanup({ batchSize: 100 });

    expect(cleanup).toEqual(expect.objectContaining({
      statusId: 'completed',
      deletedReceiptCount: 1,
      totalReceiptCount: 1,
      expiredReceiptCount: 0,
      receiptHistoryExposed: false,
      idempotencyKeysExposed: false,
    }));

    const persisted = await db.query(`
      SELECT id, target_intent_version
      FROM policy_native_intent_change_receipts
      WHERE policy_id = $1
      ORDER BY target_intent_version ASC
    `, [fixture.policyId]);
    expect(persisted.rows).toEqual([{ id: recentReceiptId, target_intent_version: 5 }]);

    const recent = await policyNativeIntentChangeRecentReceiptDiscoveryService.getRecentReceipt({
      dbClient: db,
      policyId: fixture.policyId,
      actorId: 1,
    });
    expect(recent).toEqual(expect.objectContaining({
      recentChange: {
        resultStatusId: 'applied',
        sourceIntentVersion: 4,
        targetIntentVersion: 5,
      },
    }));

    const oldKeyRetry = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: 3,
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: firstKey,
      changeCommands: [purposeCommand('first-purpose-token')],
    });
    expect(oldKeyRetry.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION);

    const intentVersions = await db.query(
      'SELECT intent_version FROM policy_intents WHERE policy_id = $1 ORDER BY intent_version ASC',
      [fixture.policyId],
    );
    expect(intentVersions.rows.map(row => row.intent_version)).toEqual([3, 4, 5]);
  });
});
