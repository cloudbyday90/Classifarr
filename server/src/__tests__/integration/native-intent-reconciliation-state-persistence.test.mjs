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

import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import {
  upsertNativeIntentReconciliationState,
} from '../../services/nativeIntentReconciliationStatePersistence.mjs';

let db;

async function createAuthoritativePolicyFixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const library = await db.query(
    `INSERT INTO libraries (external_id, name, media_type)
     VALUES ($1, $2, 'movie')
     RETURNING id`,
    [`reconciliation-state-${suffix}`, `Reconciliation State ${suffix}`],
  );
  const libraryId = library.rows[0].id;
  const policy = await db.query(
    `INSERT INTO library_policies (library_id, name)
     VALUES ($1, $2)
     RETURNING id`,
    [libraryId, `Reconciliation State Policy ${suffix}`],
  );
  const policyId = policy.rows[0].id;
  const intent = await db.query(
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
     VALUES ($1, $2, 1, 1, FALSE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
     RETURNING id`,
    [policyId, libraryId],
  );
  await db.query(
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
    [intent.rows[0].id, JSON.stringify({ require_any: ['Animation'] })],
  );
  await db.query(
    `UPDATE policy_intents
     SET active = TRUE
     WHERE id = $1`,
    [intent.rows[0].id],
  );
  await db.query(
    `INSERT INTO policy_native_intent_reconciliation_states (
       policy_id,
       candidate_fingerprint,
       candidate_status_id,
       outcome_state,
       reason_id,
       retry_not_before,
       failure_count,
       evaluated_at
     )
     VALUES ($1, $2, 'requires_initial_policy_establishment',
       'requires_maintenance', 'requires_initial_policy_establishment',
       NULL, 0, NOW())`,
    [policyId, `sha256:${'a'.repeat(64)}`],
  );

  return { libraryId, policyId };
}

beforeAll(() => {
  db = getPool();
});

describe('Native intent reconciliation state persistence integration', () => {
  test('clears an initial-establishment marker when the policy has current native authority', async () => {
    const fixture = await createAuthoritativePolicyFixture();

    try {
      const result = await upsertNativeIntentReconciliationState({
        client: db,
        state: {
          policyId: fixture.policyId,
          candidateFingerprint: `sha256:${'b'.repeat(64)}`,
          candidateStatusId: 'requires_initial_policy_establishment',
          outcomeState: 'requires_maintenance',
          reasonId: 'requires_initial_policy_establishment',
          retryNotBefore: null,
          failureCount: 0,
          evaluatedAt: '2026-07-18T12:00:00.000Z',
        },
      });
      const state = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM policy_native_intent_reconciliation_states
         WHERE policy_id = $1`,
        [fixture.policyId],
      );

      expect(result).toEqual({
        statusId: 'cleared_authoritative',
        upsertedCount: 0,
        deletedCount: 1,
        rawPayloadExposed: false,
      });
      expect(state.rows[0].count).toBe(0);
    } finally {
      await db.query('DELETE FROM library_policies WHERE id = $1', [fixture.policyId]);
      await db.query('DELETE FROM libraries WHERE id = $1', [fixture.libraryId]);
    }
  });
});
