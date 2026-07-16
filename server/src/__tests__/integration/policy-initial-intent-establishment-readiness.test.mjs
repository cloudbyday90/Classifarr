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
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  getPolicyInitialIntentEstablishmentReadiness,
} = await import('../../services/policyInitialIntentEstablishmentReadinessService.mjs');

async function createPolicyFixture() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const libraryResult = await db.query(
    `INSERT INTO libraries (external_id, name, media_type)
     VALUES ($1, $2, 'movie')
     RETURNING id`,
    [`initial-readiness-${suffix}`, `Initial Readiness ${suffix}`]
  );
  const libraryId = libraryResult.rows[0].id;
  const policyResult = await db.query(
    `INSERT INTO library_policies (library_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [libraryId, `Initial Readiness Policy ${suffix}`]
  );

  return { libraryId, policyId: policyResult.rows[0].id };
}

async function establishNativeIntent({ policyId, libraryId }) {
  return db.withTransaction(async client => {
    const intentResult = await client.query(
    `INSERT INTO policy_intents (
       policy_id,
       library_id,
       schema_version,
       intent_version,
       active,
       source,
       inference_state,
       review_behavior,
       validation_status
     )
     VALUES ($1, $2, 1, 1, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
     RETURNING id`,
    [policyId, libraryId]
  );
    const intentId = intentResult.rows[0].id;

    await client.query(
    `INSERT INTO policy_intent_rules (
       intent_id,
       intent_role,
       collection,
       signal_type,
       operator,
       values,
       constraint_mode,
       semantics,
       source,
       inference_state,
       sort_order
     )
     VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', $2::jsonb,
       NULL, 'identity', 'operator_declared_intent', 'inferred', 0)`,
    [intentId, JSON.stringify({ require_any: ['Animation'] })]
  );
    const eventResult = await client.query(
    `INSERT INTO policy_intent_migration_events (
       intent_id,
       policy_id,
       event_type,
       actor_type,
       source_version,
       target_version,
       reason_code,
       summary,
       metadata
     )
     VALUES ($1, $2, 'initial_intent_established', 'operator', NULL, 1,
       'integration_test', 'Initial establishment integration fixture.', '{}'::jsonb)
     RETURNING id`,
    [intentId, policyId]
  );
    const snapshotResult = await client.query(
    `INSERT INTO policy_intent_rollback_snapshots (
       intent_id,
       policy_id,
       snapshot_version,
       snapshot_payload,
       payload_redacted,
       restore_path,
       expires_at
     )
     VALUES ($1, $2, 1, '{}'::jsonb, FALSE, $3, NOW() + INTERVAL '14 days')
     RETURNING id`,
    [intentId, policyId, `policy/integration/rollback/${policyId}`]
  );
    const establishmentResult = await client.query(
    `INSERT INTO policy_initial_intent_establishments (
       policy_id,
       library_id,
       intent_id,
       migration_event_id,
       rollback_snapshot_id,
       idempotency_key,
       request_fingerprint,
       authority_source_id,
       accepted_by,
       state,
       established_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'operator_declared_intent', 7, 'established', NOW())
     RETURNING id`,
    [
      policyId,
      libraryId,
      intentId,
      eventResult.rows[0].id,
      snapshotResult.rows[0].id,
      randomUUID().replaceAll('-', ''),
      'a'.repeat(64),
    ]
  );

    return {
      intentId,
      snapshotId: snapshotResult.rows[0].id,
      establishmentId: establishmentResult.rows[0].id,
    };
  });
}

describe('Policy initial intent establishment readiness integration', () => {
  const policyIds = [];
  const libraryIds = [];

  afterEach(async () => {
    while (policyIds.length > 0) {
      await db.query('DELETE FROM library_policies WHERE id = $1', [policyIds.pop()]);
    }
    while (libraryIds.length > 0) {
      await db.query('DELETE FROM libraries WHERE id = $1', [libraryIds.pop()]);
    }
  });

  test('reads a recorded establishment and its declared rule summary without reading audit secrets', async () => {
    const fixture = await createPolicyFixture();
    policyIds.push(fixture.policyId);
    libraryIds.push(fixture.libraryId);
    const established = await establishNativeIntent(fixture);

    const readiness = await getPolicyInitialIntentEstablishmentReadiness({
      dbClient: db,
      policyId: fixture.policyId,
    });

    expect(readiness.statusId).toBe('initial_intent_establishment_recorded');
    expect(readiness.eligibility.canEstablishInitialIntent).toBe(false);
    expect(readiness.establishmentHistory.establishment).toEqual(expect.objectContaining({
      id: established.establishmentId,
      intentId: established.intentId,
    }));
    expect(readiness.establishmentHistory.recovery).toEqual(expect.objectContaining({
      stateId: 'rollback_available',
      rollbackAvailable: true,
      snapshotId: established.snapshotId,
    }));
    expect(readiness.declaredRuleSummary).toEqual({
      stateId: 'available',
      ruleCount: 1,
      declaredIntent: {
        purpose: [{
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
          constraint_mode: null,
          semantics: 'identity',
        }],
        hard_limits: [],
        helpful_hints: [],
        avoid: [],
      },
    });
    expect(JSON.stringify(readiness)).not.toContain('a'.repeat(64));
    expect(JSON.stringify(readiness)).not.toContain('accepted_by');
    expect(JSON.stringify(readiness)).not.toContain('snapshot_payload');
  });
});
