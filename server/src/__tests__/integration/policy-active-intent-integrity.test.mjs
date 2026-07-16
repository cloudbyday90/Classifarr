/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const activeIntentIntegrityMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../database/migrations/20260713_150000_enforce_single_active_policy_intent.sql'
  ),
  'utf8'
);
const semanticAuthorityMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../database/migrations/20260716_040000_enforce_semantic_native_intent_authority.sql'
  ),
  'utf8'
);

async function createPolicyAuthorityFixture() {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const libraryResult = await db.query(
    `INSERT INTO libraries (external_id, name, media_type)
     VALUES ($1, $2, 'movie')
     RETURNING id`,
    [`native-intent-${suffix}`, `Native Intent ${suffix}`]
  );
  const libraryId = libraryResult.rows[0].id;
  const policyResult = await db.query(
    `INSERT INTO library_policies (library_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [libraryId, `Native Intent Policy ${suffix}`]
  );

  return { libraryId, policyId: policyResult.rows[0].id };
}

async function insertActiveIntent(client, { policyId, libraryId, intentVersion }) {
  return client.query(
    `INSERT INTO policy_intents (
       policy_id,
       library_id,
       intent_version,
       source,
       inference_state,
       review_behavior,
       validation_status
     )
     VALUES ($1, $2, $3, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
     RETURNING id`,
    [policyId, libraryId, intentVersion]
  );
}

async function insertPurposeRule(client, intentId) {
  return client.query(
    `INSERT INTO policy_intent_rules (
       intent_id,
       intent_role,
       collection,
       signal_type,
       operator,
       values,
       inference_state
     )
     VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', $2::jsonb, 'inferred')`,
    [intentId, JSON.stringify({ require_any: ['Animation'] })]
  );
}

async function restorePreSemanticAuthoritySchema(client) {
  await client.query(
    'DROP TRIGGER IF EXISTS policy_intent_rules_active_purpose_rule_chk ON policy_intent_rules'
  );
  await client.query(
    'DROP TRIGGER IF EXISTS policy_intents_active_purpose_rule_chk ON policy_intents'
  );
  await client.query(
    'ALTER TABLE policy_intents DROP CONSTRAINT IF EXISTS policy_intents_active_native_authority_header_chk'
  );
  await client.query('DROP FUNCTION IF EXISTS enforce_policy_intent_active_purpose_rule()');
}

async function restoreHistoricalActiveVersionIndex(client) {
  await client.query('DROP INDEX idx_policy_intents_one_active_policy');
  await client.query(
    `CREATE UNIQUE INDEX idx_policy_intents_active_version
     ON policy_intents (policy_id, intent_version)
     WHERE active = TRUE`
  );
}

describe('Policy Active Intent Integrity Integration', () => {
  const createdPolicyIds = [];
  const createdLibraryIds = [];

  afterEach(async () => {
    while (createdPolicyIds.length > 0) {
      await db.query('DELETE FROM library_policies WHERE id = $1', [createdPolicyIds.pop()]);
    }
    while (createdLibraryIds.length > 0) {
      await db.query('DELETE FROM libraries WHERE id = $1', [createdLibraryIds.pop()]);
    }
  });

  test('enforces one active native intent across concurrent transactions', async () => {
    const fixture = await createPolicyAuthorityFixture();
    createdPolicyIds.push(fixture.policyId);
    createdLibraryIds.push(fixture.libraryId);
    const firstClient = await db.pool.connect();
    const secondClient = await db.pool.connect();

    try {
      await firstClient.query('BEGIN');
      await secondClient.query('BEGIN');
      await insertActiveIntent(firstClient, {
        ...fixture,
        intentVersion: 1,
      });
      const firstActiveIntent = await firstClient.query(
        'SELECT id FROM policy_intents WHERE policy_id = $1 AND active = TRUE',
        [fixture.policyId]
      );
      await insertPurposeRule(firstClient, firstActiveIntent.rows[0].id);

      const secondInsert = insertActiveIntent(secondClient, {
        ...fixture,
        intentVersion: 2,
      });
      await firstClient.query('COMMIT');

      await expect(secondInsert).rejects.toMatchObject({ code: '23505' });
      await secondClient.query('ROLLBACK');

      const activeIntentResult = await db.query(
        'SELECT id FROM policy_intents WHERE policy_id = $1 AND active = TRUE',
        [fixture.policyId]
      );
      expect(activeIntentResult.rows).toHaveLength(1);
    } finally {
      await firstClient.query('ROLLBACK');
      await secondClient.query('ROLLBACK');
      firstClient.release();
      secondClient.release();
    }
  });

  test('creates the final partial unique index instead of the historical version index', async () => {
    const result = await db.query(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_policy_intents_one_active_policy'`
    );

    expect(result.rows[0].indexdef).toContain('(policy_id) WHERE (active = true)');

    const historicalIndex = await db.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_policy_intents_active_version'`
    );
    expect(historicalIndex.rows).toEqual([]);
  });

  test('repairs safe duplicate authorities without deleting their history', async () => {
    const fixture = await createPolicyAuthorityFixture();
    createdPolicyIds.push(fixture.policyId);
    createdLibraryIds.push(fixture.libraryId);
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await restorePreSemanticAuthoritySchema(client);
      await restoreHistoricalActiveVersionIndex(client);
      const canonical = await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 1,
      });
      const duplicate = await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 2,
      });
      await insertPurposeRule(client, canonical.rows[0].id);
      await insertPurposeRule(client, duplicate.rows[0].id);
      await client.query(
        `UPDATE policy_intents
         SET validation_status = 'warning'
         WHERE id = $1`,
        [duplicate.rows[0].id]
      );

      await client.query(activeIntentIntegrityMigrationSql);

      const repaired = await client.query(
        `SELECT id, active, replaced_by_intent_id
         FROM policy_intents
         WHERE policy_id = $1
         ORDER BY id`,
        [fixture.policyId]
      );
      expect(repaired.rows).toEqual([
        { id: canonical.rows[0].id, active: true, replaced_by_intent_id: null },
        {
          id: duplicate.rows[0].id,
          active: false,
          replaced_by_intent_id: canonical.rows[0].id,
        },
      ]);

      const event = await client.query(
        `SELECT event_type, metadata
         FROM policy_intent_migration_events
         WHERE policy_id = $1`,
        [fixture.policyId]
      );
      expect(event.rows).toEqual([expect.objectContaining({
        event_type: 'active_intent_integrity_repaired',
        metadata: expect.objectContaining({
          canonical_intent_id: canonical.rows[0].id,
          deactivated_intent_ids: [duplicate.rows[0].id],
        }),
      })]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('rolls back invalid-only duplicate candidates before repairing or changing indexes', async () => {
    const fixture = await createPolicyAuthorityFixture();
    createdPolicyIds.push(fixture.policyId);
    createdLibraryIds.push(fixture.libraryId);
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await restorePreSemanticAuthoritySchema(client);
      await restoreHistoricalActiveVersionIndex(client);
      const first = await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 1,
      });
      const second = await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 2,
      });
      await insertPurposeRule(client, first.rows[0].id);
      await insertPurposeRule(client, second.rows[0].id);
      await client.query(
        `UPDATE policy_intents
         SET validation_status = CASE id
           WHEN $1 THEN 'invalid'
           WHEN $2 THEN 'pending_validation'
         END
         WHERE id IN ($1, $2)`,
        [first.rows[0].id, second.rows[0].id]
      );

      await expect(client.query(activeIntentIntegrityMigrationSql)).rejects.toMatchObject({
        code: '23514',
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }

    const finalIndex = await db.query(
      `SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_policy_intents_one_active_policy'`
    );
    expect(finalIndex.rows).toHaveLength(1);
  });

  test('deactivates only exact empty active headers before semantic authority enforcement', async () => {
    const fixture = await createPolicyAuthorityFixture();
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await restorePreSemanticAuthoritySchema(client);
      const emptyIntent = await client.query(
        `INSERT INTO policy_intents (
           policy_id, library_id, intent_version, source, inference_state,
           review_behavior, validation_status
         )
         VALUES ($1, $2, 1, 'empty', 'empty', '{}'::jsonb, 'valid')
         RETURNING id`,
        [fixture.policyId, fixture.libraryId]
      );

      await client.query(semanticAuthorityMigrationSql);

      const intentResult = await client.query(
        'SELECT active FROM policy_intents WHERE id = $1',
        [emptyIntent.rows[0].id]
      );
      const eventResult = await client.query(
        `SELECT event_type, reason_code
         FROM policy_intent_migration_events
         WHERE intent_id = $1`,
        [emptyIntent.rows[0].id]
      );

      expect(intentResult.rows).toEqual([{ active: false }]);
      expect(eventResult.rows).toEqual([{
        event_type: 'semantic_intent_authority_repaired',
        reason_code: 'empty_header_deactivated',
      }]);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('defers active-purpose enforcement so a header and purpose can be written atomically', async () => {
    const fixture = await createPolicyAuthorityFixture();
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await restorePreSemanticAuthoritySchema(client);
      await client.query(semanticAuthorityMigrationSql);
      const nativeIntent = await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 1,
      });
      await insertPurposeRule(client, nativeIntent.rows[0].id);

      await expect(client.query('SET CONSTRAINTS ALL IMMEDIATE')).resolves.toEqual(
        expect.objectContaining({})
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  test('rejects an active native header that reaches transaction validation without a purpose rule', async () => {
    const fixture = await createPolicyAuthorityFixture();
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      await restorePreSemanticAuthoritySchema(client);
      await client.query(semanticAuthorityMigrationSql);
      await insertActiveIntent(client, {
        ...fixture,
        intentVersion: 1,
      });

      await expect(client.query('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toMatchObject({
        code: '23514',
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
