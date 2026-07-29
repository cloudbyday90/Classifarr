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
import { jest } from '@jest/globals';

import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyNativeProfileRefreshPlanner,
} = await import('../../services/policyNativeProfileRefreshPlanner.mjs');
const {
  buildPolicyNativeProfileRefreshRequest,
} = await import('../../services/policyNativeProfileRefreshRequest.mjs');
const {
  createPolicyNativeReadinessSummaryService,
} = await import('../../services/policyNativeReadinessSummaryService.mjs');
const {
  PolicyProfileRefreshOutboxWorker,
} = await import('../../services/policyProfileRefreshOutboxWorker.mjs');
const {
  enqueuePolicyProfileRefresh,
} = await import('../../services/policyProfileRefreshOutboxRepository.mjs');

const CIRCUIT_OPENED_AT = new Date('2000-01-01T00:00:00.000Z');
const CIRCUIT_PROBE_DUE_AT = new Date('2000-01-01T02:00:00.000Z');

function buildNativeIntent({ policyId, libraryId }) {
  return {
    authority: {
      stateId: 'single_active_native_intent',
      activeIntentCount: 1,
      authoritative: true,
    },
    intent: {
      id: 1,
      policy_id: policyId,
      library_id: libraryId,
      intent_version: 1,
      validation_status: 'valid',
    },
    rules: [{
      intent_role: 'purpose',
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation'] },
    }],
    templates: [],
    validation: {
      status: 'valid',
      error_count: 0,
      warning_count: 0,
      errors: [],
      warnings: [],
    },
  };
}

async function createNativeProfileRefreshFixture() {
  const suffix = randomUUID().replaceAll('-', '');
  const libraryResult = await db.query(
    `INSERT INTO libraries (external_id, name, media_type, is_active)
     VALUES ($1, $2, 'movie', TRUE)
     RETURNING id`,
    [`native-circuit-${suffix}`, `Native Circuit ${suffix}`],
  );
  const libraryId = libraryResult.rows[0].id;
  const policyResult = await db.query(
    `INSERT INTO library_policies (library_id, name, enabled)
     VALUES ($1, $2, TRUE)
     RETURNING id`,
    [libraryId, `Native Circuit Policy ${suffix}`],
  );
  const policyId = policyResult.rows[0].id;

  const intentResult = await db.query(
    `INSERT INTO policy_intents (
       policy_id, library_id, schema_version, intent_version, active, source,
       inference_state, review_behavior, validation_status
     )
     VALUES ($1, $2, 1, 1, FALSE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
     RETURNING id`,
    [policyId, libraryId],
  );
  await db.query(
    `INSERT INTO policy_intent_rules (
       intent_id, intent_role, collection, signal_type, operator, values,
       constraint_mode, semantics, source, inference_state, sort_order
     )
     VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', $2::jsonb,
       NULL, 'identity', 'operator_declared_intent', 'inferred', 0)`,
    [intentResult.rows[0].id, JSON.stringify({ require_any: ['Animation'] })],
  );
  await db.query('UPDATE policy_intents SET active = TRUE WHERE id = $1', [intentResult.rows[0].id]);
  const itemResult = await db.query(
    `INSERT INTO media_server_items (library_id, external_id, title, media_type)
     VALUES ($1, $2, $3, 'movie')
     RETURNING id`,
    [libraryId, `native-circuit-item-${suffix}`, `Native Circuit Item ${suffix}`],
  );

  return {
    libraryId,
    policyId,
    observedItemHighWaterMark: itemResult.rows[0].id,
  };
}

function createReadinessSummaryService({ policyId, libraryId }) {
  return createPolicyNativeReadinessSummaryService({
    fetchContext: async () => ({
      policy: { id: policyId, libraryId },
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'integration routing target',
      },
    }),
    fetchNativeIntent: async () => buildNativeIntent({ policyId, libraryId }),
    loadProfileEvidence: async () => {
      const profileResult = await db.query(
        `SELECT library_id, last_generated_at
         FROM library_profiles
         WHERE library_id = $1`,
        [libraryId],
      );
      const profile = profileResult.rows[0] || null;
      if (!profile) {
        return {
          ok: false,
          statusId: 'profile_not_found',
          sideEffects: { libraryProfileRead: true },
        };
      }

      return {
        ok: true,
        profileFreshness: { stale: false },
        evidenceBoundary: {
          projection: {
            version: 'policy.evidence.v1',
            buckets: {},
            warnings: [],
          },
        },
        sideEffects: { libraryProfileRead: true },
      };
    },
  });
}

function createWorker({ profileService, claimToken }) {
  return new PolicyProfileRefreshOutboxWorker({
    dbClient: db,
    profileService,
    createClaimToken: () => claimToken,
    loggerInstance: { info: jest.fn(), warn: jest.fn() },
  });
}

function createPlanner({ now }) {
  return new PolicyNativeProfileRefreshPlanner({
    dbClient: db,
    now: () => now,
    loggerInstance: { info: jest.fn(), warn: jest.fn() },
  });
}

describe('Native profile refresh circuit lifecycle integration', () => {
  const libraryIds = [];

  afterEach(async () => {
    while (libraryIds.length > 0) {
      const libraryId = libraryIds.pop();
      await db.query('DELETE FROM policy_profile_refresh_outbox WHERE library_id = $1', [libraryId]);
      await db.query(
        'DELETE FROM policy_native_profile_refresh_circuits WHERE library_id = $1',
        [libraryId],
      );
      await db.query('DELETE FROM library_policies WHERE library_id = $1', [libraryId]);
      await db.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
    }
  });

  test('opens, probes, clears, and returns to current recovery without browser control', async () => {
    const fixture = await createNativeProfileRefreshFixture();
    libraryIds.push(fixture.libraryId);
    const request = buildPolicyNativeProfileRefreshRequest({
      libraryId: fixture.libraryId,
      profileState: 'missing_profile',
      observedItemCount: 1,
      observedItemHighWaterMark: fixture.observedItemHighWaterMark,
    });
    expect(request.ready).toBe(true);

    await db.withTransaction(client => enqueuePolicyProfileRefresh({
      client,
      record: request.record,
    }));

    const terminalWorker = createWorker({
      claimToken: '11111111-1111-4111-8111-111111111111',
      profileService: {
        getProfile: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(terminalWorker.run()).resolves.toMatchObject({
      claimed: 1,
      failed: 1,
      completed: 0,
    });

    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      replayed: 1,
      circuitOpened: 1,
      successorBlocked: 1,
      circuitProbeQueued: 0,
    });

    const readinessService = createReadinessSummaryService(fixture);
    const awaitingProbe = await readinessService.getSummary({
      dbClient: db,
      policyId: fixture.policyId,
    });
    expect(awaitingProbe.profileRecovery).toEqual({
      stateId: 'awaiting_automatic_probe',
      label: 'Recovery awaiting automatic probe',
      message: 'Classifarr is waiting before its next automatic profile recovery check. No action is needed.',
    });
    expect(JSON.stringify(awaitingProbe.profileRecovery))
      .not.toMatch(/configuration_invalid|2000-|outbox|retry|reset/i);

    await expect(createPlanner({ now: CIRCUIT_PROBE_DUE_AT }).run()).resolves.toMatchObject({
      circuitProbeQueued: 1,
      circuitProbeDeferred: 0,
    });

    const queuedProbe = await readinessService.getSummary({
      dbClient: db,
      policyId: fixture.policyId,
    });
    expect(queuedProbe.profileRecovery.stateId).toBe('queued');

    const successfulWorker = createWorker({
      claimToken: '22222222-2222-4222-8222-222222222222',
      profileService: {
        getProfile: async libraryId => {
          const profile = await db.query(
            'SELECT * FROM library_profiles WHERE library_id = $1',
            [libraryId],
          );
          return profile.rows[0] || null;
        },
        generateProfile: async libraryId => {
          const profile = await db.query(
            `INSERT INTO library_profiles (
               library_id, rating_distribution, genre_distribution, studio_distribution,
               keyword_distribution, item_count, last_generated_at
             )
             VALUES ($1, '{}'::jsonb, '{"Animation": 100}'::jsonb, '{}'::jsonb,
               '{}'::jsonb, 1, NOW())
             ON CONFLICT (library_id) DO UPDATE
             SET genre_distribution = EXCLUDED.genre_distribution,
                 item_count = EXCLUDED.item_count,
                 last_generated_at = EXCLUDED.last_generated_at,
                 updated_at = NOW()
             RETURNING library_id, last_generated_at`,
            [libraryId],
          );
          return profile.rows[0];
        },
      },
    });
    await expect(successfulWorker.run()).resolves.toMatchObject({
      claimed: 1,
      completed: 1,
      circuitsCleared: 1,
    });

    const [circuitRows, outboxRows] = await Promise.all([
      db.query(
        'SELECT source_event_id FROM policy_native_profile_refresh_circuits WHERE library_id = $1',
        [fixture.libraryId],
      ),
      db.query(
        `SELECT processing_state, failure_code
         FROM policy_profile_refresh_outbox
         WHERE library_id = $1
         ORDER BY id`,
        [fixture.libraryId],
      ),
    ]);
    expect(circuitRows.rows).toEqual([]);
    expect(outboxRows.rows).toEqual([
      expect.objectContaining({
        processing_state: 'failed',
        failure_code: 'profile_refresh_configuration_invalid',
      }),
      expect.objectContaining({
        processing_state: 'completed',
        failure_code: null,
      }),
    ]);

    const current = await readinessService.getSummary({
      dbClient: db,
      policyId: fixture.policyId,
    });
    expect(current).toEqual(expect.objectContaining({
      readiness: expect.objectContaining({ stateId: 'ready', ready: true }),
      profileRecovery: {
        stateId: 'not_required',
        label: 'Profile current',
        message: 'No automatic profile recovery is needed.',
      },
    }));
  });
});
