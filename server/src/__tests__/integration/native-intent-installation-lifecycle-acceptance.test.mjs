/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';

let db;

function uniqueSuffix() {
  return randomUUID().replaceAll('-', '');
}

async function createLibrary({ label, mediaType = 'movie' } = {}) {
  const suffix = uniqueSuffix();
  const result = await db.query(
    `INSERT INTO libraries (external_id, name, media_type)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`lifecycle-${label}-${suffix}`, `Lifecycle ${label} ${suffix}`, mediaType],
  );

  return { id: result.rows[0].id, suffix };
}

async function createPolicy({ libraryId, label } = {}) {
  const result = await db.query(
    `INSERT INTO library_policies (library_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [libraryId, `Lifecycle ${label} Policy ${uniqueSuffix()}`],
  );

  return { id: result.rows[0].id, libraryId };
}

async function attachPreset({ policyId, label, signals } = {}) {
  const suffix = uniqueSuffix();
  const preset = await db.query(
    `INSERT INTO content_presets (
       key, name, description, category, signals, is_system, display_order
     )
     VALUES ($1, $2, $3, 'integration_test', $4::jsonb, TRUE, 0)
     RETURNING id`,
    [
      `lifecycle-${suffix}`,
      `Lifecycle ${label} ${suffix}`,
      'Existing-installation lifecycle acceptance fixture.',
      JSON.stringify(signals),
    ],
  );
  await db.query(
    `INSERT INTO policy_presets (policy_id, preset_id, weight, sort_order)
     VALUES ($1, $2, 1, 0)`,
    [policyId, preset.rows[0].id],
  );
}

async function persistCurrentProfile({ libraryId, genres } = {}) {
  await db.query(
    `INSERT INTO library_profiles (
       library_id, rating_distribution, genre_distribution, studio_distribution,
       keyword_distribution, item_count, last_generated_at
     )
     VALUES ($1, '{}'::jsonb, $2::jsonb, '{}'::jsonb, '{}'::jsonb, 3, NOW())
     ON CONFLICT (library_id) DO UPDATE
       SET genre_distribution = EXCLUDED.genre_distribution,
           item_count = EXCLUDED.item_count,
           last_generated_at = EXCLUDED.last_generated_at`,
    [libraryId, JSON.stringify(genres)],
  );
}

async function createAuthoritativeNativeIntent({ policyId, libraryId } = {}) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const intent = await client.query(
      `INSERT INTO policy_intents (
         policy_id, library_id, schema_version, intent_version, active, source,
         inference_state, review_behavior, validation_status
       )
       VALUES ($1, $2, 1, 1, FALSE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
       RETURNING id`,
      [policyId, libraryId],
    );
    const intentId = intent.rows[0].id;
    await client.query(
      `INSERT INTO policy_intent_rules (
         intent_id, intent_role, collection, signal_type, operator, values,
         constraint_mode, semantics, source, inference_state, sort_order
       )
       VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', $2::jsonb,
         'advisory', 'identity', 'operator_declared_intent', 'inferred', 0)`,
      [intentId, JSON.stringify({ require_any: ['Animation'] })],
    );
    await client.query(
      'UPDATE policy_intents SET active = TRUE WHERE id = $1',
      [intentId],
    );
    await client.query('COMMIT');

    return intentId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function runReconciliationThroughScheduler() {
  const { schedulerService } = await import('../../services/scheduler.mjs');
  const { nativeIntentReconciliationService } =
    await import('../../services/nativeIntentReconciliationService.mjs');
  const { DB_ADVISORY_LOCKS } = await import('../../config/database.mjs');

  return schedulerService.runScheduledTask(
    'native-intent-installation-lifecycle-acceptance',
    () => nativeIntentReconciliationService.run(),
    DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION,
  );
}

async function countPolicyIntents(policyId) {
  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM policy_intents WHERE policy_id = $1',
    [policyId],
  );
  return result.rows[0].count;
}

beforeAll(() => {
  db = getPool();
});

describe('Existing-installation lifecycle acceptance', () => {
  test('reconciles persisted installation states without a provider, media server, or operator dialog', async () => {
    const noPolicyLibrary = await createLibrary({ label: 'no-policy' });

    const legacyLibrary = await createLibrary({ label: 'legacy-only' });
    const legacyPolicy = await createPolicy({
      libraryId: legacyLibrary.id,
      label: 'legacy-only',
    });
    await attachPreset({
      policyId: legacyPolicy.id,
      label: 'legacy-only',
      signals: { genres: { require_any: ['Family'] } },
    });

    const profileLibrary = await createLibrary({ label: 'profile-backed' });
    const profilePolicy = await createPolicy({
      libraryId: profileLibrary.id,
      label: 'profile-backed',
    });
    await persistCurrentProfile({
      libraryId: profileLibrary.id,
      genres: { Animation: 100, Family: 66.67 },
    });

    const nativeLibrary = await createLibrary({ label: 'already-native' });
    const nativePolicy = await createPolicy({
      libraryId: nativeLibrary.id,
      label: 'already-native',
    });
    const existingIntentId = await createAuthoritativeNativeIntent({
      policyId: nativePolicy.id,
      libraryId: nativeLibrary.id,
    });

    const invalidLibrary = await createLibrary({ label: 'invalid-source' });
    const invalidPolicy = await createPolicy({
      libraryId: invalidLibrary.id,
      label: 'invalid-source',
    });
    await attachPreset({
      policyId: invalidPolicy.id,
      label: 'invalid-source',
      signals: { experimental_signal: { require_any: ['unsupported'] } },
    });

    expect(await runReconciliationThroughScheduler()).toBe(true);

    const [
      noPolicyIntents,
      legacyIntent,
      profileIntent,
      nativeIntents,
      invalidIntents,
      invalidState,
      profileRules,
      legacyEvents,
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM policy_intents
         WHERE library_id = $1`,
        [noPolicyLibrary.id],
      ),
      db.query(
        `SELECT active, source, inference_state, validation_status
         FROM policy_intents
         WHERE policy_id = $1`,
        [legacyPolicy.id],
      ),
      db.query(
        `SELECT id, active, source, inference_state, validation_status
         FROM policy_intents
         WHERE policy_id = $1`,
        [profilePolicy.id],
      ),
      db.query(
        `SELECT id, active, source, validation_status
         FROM policy_intents
         WHERE policy_id = $1`,
        [nativePolicy.id],
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM policy_intents
         WHERE policy_id = $1`,
        [invalidPolicy.id],
      ),
      db.query(
        `SELECT outcome_state, reason_id
         FROM policy_native_intent_reconciliation_states
         WHERE policy_id = $1`,
        [invalidPolicy.id],
      ),
      db.query(
        `SELECT rule.signal_type, rule.operator, rule."values"
         FROM policy_intent_rules rule
         JOIN policy_intents intent ON intent.id = rule.intent_id
         WHERE intent.policy_id = $1
           AND rule.intent_role = 'purpose'
         ORDER BY rule.id`,
        [profilePolicy.id],
      ),
      db.query(
        `SELECT event_type
         FROM policy_intent_migration_events
         WHERE policy_id = $1
         ORDER BY id`,
        [legacyPolicy.id],
      ),
    ]);

    expect(noPolicyIntents.rows[0].count).toBe(0);
    expect(legacyIntent.rows).toEqual([
      expect.objectContaining({
        active: true,
        source: 'native_intent',
        inference_state: 'inferred',
        validation_status: 'valid',
      }),
    ]);
    expect(legacyEvents.rows.map(event => event.event_type)).toEqual([
      'conversion_started',
      'rollback_snapshot_created',
      'conversion_applied',
    ]);
    expect(profileIntent.rows).toEqual([
      expect.objectContaining({
        active: true,
        source: 'native_intent',
        inference_state: 'inferred',
        validation_status: 'valid',
      }),
    ]);
    expect(profileRules.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation', 'Family'] },
      }),
    ]));
    expect(nativeIntents.rows).toEqual([
      expect.objectContaining({
        id: existingIntentId,
        active: true,
        source: 'native_intent',
        validation_status: 'valid',
      }),
    ]);
    expect(invalidIntents.rows[0].count).toBe(0);
    expect(invalidState.rows).toEqual([
      expect.objectContaining({
        outcome_state: 'requires_maintenance',
        reason_id: 'unsupported_legacy_shape',
      }),
    ]);
    expect(await countPolicyIntents(legacyPolicy.id)).toBe(1);
    expect(await countPolicyIntents(profilePolicy.id)).toBe(1);
  });
});
