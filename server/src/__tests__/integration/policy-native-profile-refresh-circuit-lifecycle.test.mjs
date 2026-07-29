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
const {
  completePolicyProfileRefreshOutboxClaim,
} = await import('../../services/policyProfileRefreshOutboxWorkerRepository.mjs');

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

async function insertObservedItem({ libraryId, suffix, titleSuffix = '' }) {
  const itemResult = await db.query(
    `INSERT INTO media_server_items (library_id, external_id, title, media_type)
     VALUES ($1, $2, $3, 'movie')
     RETURNING id`,
    [
      libraryId,
      `native-circuit-item-${suffix}${titleSuffix}`,
      `Native Circuit Item ${suffix}${titleSuffix}`,
    ],
  );
  return itemResult.rows[0].id;
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
  const observedItemHighWaterMark = await insertObservedItem({ libraryId, suffix });

  return {
    libraryId,
    policyId,
    observedItemHighWaterMark,
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

function createDeferred() {
  let resolve;
  const promise = new Promise(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

  test('does not let an old open circuit block or label a new content revision', async () => {
    const fixture = await createNativeProfileRefreshFixture();
    libraryIds.push(fixture.libraryId);
    const oldRequest = buildPolicyNativeProfileRefreshRequest({
      libraryId: fixture.libraryId,
      profileState: 'missing_profile',
      observedItemCount: 1,
      observedItemHighWaterMark: fixture.observedItemHighWaterMark,
    });
    expect(oldRequest.ready).toBe(true);

    await db.withTransaction(client => enqueuePolicyProfileRefresh({
      client,
      record: oldRequest.record,
    }));
    const terminalWorker = createWorker({
      claimToken: '33333333-3333-4333-8333-333333333333',
      profileService: {
        getProfile: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(terminalWorker.run()).resolves.toMatchObject({ failed: 1 });
    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      circuitOpened: 1,
      circuitBlocked: 0,
      successorBlocked: 1,
    });

    const nextObservedItemHighWaterMark = await insertObservedItem({
      libraryId: fixture.libraryId,
      suffix: randomUUID().replaceAll('-', ''),
      titleSuffix: '-new-revision',
    });
    const currentRequest = buildPolicyNativeProfileRefreshRequest({
      libraryId: fixture.libraryId,
      profileState: 'missing_profile',
      observedItemCount: 2,
      observedItemHighWaterMark: nextObservedItemHighWaterMark,
    });
    expect(currentRequest).toEqual(expect.objectContaining({ ready: true }));
    expect(currentRequest.record.sourceEventId).not.toBe(oldRequest.record.sourceEventId);

    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      queued: 1,
      circuitBlocked: 0,
      circuitProbeQueued: 0,
    });

    const [circuitRows, outboxRows] = await Promise.all([
      db.query(
        `SELECT source_event_id, circuit_state
         FROM policy_native_profile_refresh_circuits
         WHERE library_id = $1`,
        [fixture.libraryId],
      ),
      db.query(
        `SELECT source_event_id, processing_state
         FROM policy_profile_refresh_outbox
         WHERE library_id = $1
         ORDER BY id`,
        [fixture.libraryId],
      ),
    ]);
    expect(circuitRows.rows).toEqual([{
      source_event_id: oldRequest.record.sourceEventId,
      circuit_state: 'open',
    }]);
    expect(outboxRows.rows).toEqual([
      {
        source_event_id: oldRequest.record.sourceEventId,
        processing_state: 'failed',
      },
      {
        source_event_id: currentRequest.record.sourceEventId,
        processing_state: 'pending',
      },
    ]);

    const readinessService = createReadinessSummaryService(fixture);
    const current = await readinessService.getSummary({
      dbClient: db,
      policyId: fixture.policyId,
    });
    expect(current).toEqual(expect.objectContaining({
      profileRecovery: {
        stateId: 'queued',
        label: 'Recovery queued',
        message: 'Classifarr has queued an automatic library-profile refresh. No action is needed.',
      },
      sideEffects: expect.objectContaining({
        profileRefreshCircuitRead: false,
      }),
    }));
    expect(JSON.stringify(current)).not.toContain('awaiting_automatic_probe');
  });

  test('allows concurrent planners to create only one due circuit probe', async () => {
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
      claimToken: '44444444-4444-4444-8444-444444444444',
      profileService: {
        getProfile: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(terminalWorker.run()).resolves.toMatchObject({ failed: 1 });
    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      circuitOpened: 1,
      successorBlocked: 1,
    });

    const plannerResults = await Promise.all([
      createPlanner({ now: CIRCUIT_PROBE_DUE_AT }).run(),
      createPlanner({ now: CIRCUIT_PROBE_DUE_AT }).run(),
    ]);
    expect(plannerResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        circuitProbeQueued: 1,
        circuitBlocked: 0,
        circuitProbeDeferred: 0,
      }),
      expect.objectContaining({
        circuitProbeQueued: 0,
        circuitBlocked: 1,
        circuitProbeDeferred: 0,
      }),
    ]));

    const [circuitRows, probeRows] = await Promise.all([
      db.query(
        `SELECT source_event_id, circuit_state, probe_outbox_id
         FROM policy_native_profile_refresh_circuits
         WHERE library_id = $1`,
        [fixture.libraryId],
      ),
      db.query(
        `SELECT source_event_id, processing_state
         FROM policy_profile_refresh_outbox
         WHERE library_id = $1
           AND source_event_id LIKE $2`,
        [fixture.libraryId, `${request.record.sourceEventId}:retry:%`],
      ),
    ]);
    expect(circuitRows.rows).toEqual([expect.objectContaining({
      source_event_id: request.record.sourceEventId,
      circuit_state: 'half_open',
      probe_outbox_id: expect.anything(),
    })]);
    expect(probeRows.rows).toEqual([{
      source_event_id: expect.stringMatching(new RegExp(`^${request.record.sourceEventId}:retry:`)),
      processing_state: 'pending',
    }]);

    const readinessService = createReadinessSummaryService(fixture);
    const recovery = await readinessService.getSummary({
      dbClient: db,
      policyId: fixture.policyId,
    });
    expect(recovery).toEqual(expect.objectContaining({
      profileRecovery: {
        stateId: 'queued',
        label: 'Recovery queued',
        message: 'Classifarr has queued an automatic library-profile refresh. No action is needed.',
      },
    }));
  });

  test('allows concurrent workers to claim and execute one pending circuit probe', async () => {
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
      claimToken: '55555555-5555-4555-8555-555555555555',
      profileService: {
        getProfile: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(terminalWorker.run()).resolves.toMatchObject({ failed: 1 });
    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      circuitOpened: 1,
      successorBlocked: 1,
    });
    await expect(createPlanner({ now: CIRCUIT_PROBE_DUE_AT }).run()).resolves.toMatchObject({
      circuitProbeQueued: 1,
      circuitProbeDeferred: 0,
    });

    const profileService = {
      getProfile: jest.fn(async libraryId => {
        const result = await db.query(
          'SELECT * FROM library_profiles WHERE library_id = $1',
          [libraryId],
        );
        return result.rows[0] || null;
      }),
      generateProfile: jest.fn(async libraryId => {
        const result = await db.query(
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
        return result.rows[0];
      }),
    };
    const workerResults = await Promise.all([
      createWorker({
        claimToken: '66666666-6666-4666-8666-666666666666',
        profileService,
      }).run(),
      createWorker({
        claimToken: '77777777-7777-4777-8777-777777777777',
        profileService,
      }).run(),
    ]);
    expect(workerResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claimed: 1,
        completed: 1,
        circuitsCleared: 1,
      }),
      expect.objectContaining({
        claimed: 0,
        completed: 0,
        circuitsCleared: 0,
      }),
    ]));
    expect(profileService.getProfile).toHaveBeenCalledTimes(1);
    expect(profileService.generateProfile).toHaveBeenCalledTimes(1);

    const [circuitRows, probeRows, profileRows] = await Promise.all([
      db.query(
        'SELECT source_event_id FROM policy_native_profile_refresh_circuits WHERE library_id = $1',
        [fixture.libraryId],
      ),
      db.query(
        `SELECT processing_state, attempt_count, claim_token
         FROM policy_profile_refresh_outbox
         WHERE library_id = $1
           AND source_event_id LIKE $2`,
        [fixture.libraryId, `${request.record.sourceEventId}:retry:%`],
      ),
      db.query(
        'SELECT library_id FROM library_profiles WHERE library_id = $1',
        [fixture.libraryId],
      ),
    ]);
    expect(circuitRows.rows).toEqual([]);
    expect(probeRows.rows).toEqual([{
      processing_state: 'completed',
      attempt_count: 1,
      claim_token: null,
    }]);
    expect(profileRows.rows).toEqual([{ library_id: fixture.libraryId }]);
  });

  test('reclaims an expired probe without allowing its stale token to clear the circuit', async () => {
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
      claimToken: '88888888-8888-4888-8888-888888888888',
      profileService: {
        getProfile: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(terminalWorker.run()).resolves.toMatchObject({ failed: 1 });
    await expect(createPlanner({ now: CIRCUIT_OPENED_AT }).run()).resolves.toMatchObject({
      circuitOpened: 1,
      successorBlocked: 1,
    });
    await expect(createPlanner({ now: CIRCUIT_PROBE_DUE_AT }).run()).resolves.toMatchObject({
      circuitProbeQueued: 1,
      circuitProbeDeferred: 0,
    });

    const abandonedClaimToken = '99999999-9999-4999-8999-999999999999';
    const abandonedWorker = createWorker({
      claimToken: abandonedClaimToken,
      profileService: {},
    });
    const abandonedClaim = await abandonedWorker.claimBatch(abandonedClaimToken);
    expect(abandonedClaim.records).toEqual([expect.objectContaining({
      libraryId: String(fixture.libraryId),
      requestType: 'native_readiness',
    })]);
    const abandonedProbeId = abandonedClaim.records[0].id;
    await db.query(
      `UPDATE policy_profile_refresh_outbox
       SET lease_expires_at = NOW() - INTERVAL '1 second'
       WHERE id = $1
         AND claim_token = $2::uuid`,
      [abandonedProbeId, abandonedClaimToken],
    );

    const generationStarted = createDeferred();
    const continueGeneration = createDeferred();
    const profileService = {
      getProfile: jest.fn(async libraryId => {
        const result = await db.query(
          'SELECT * FROM library_profiles WHERE library_id = $1',
          [libraryId],
        );
        return result.rows[0] || null;
      }),
      generateProfile: jest.fn(async libraryId => {
        generationStarted.resolve();
        await continueGeneration.promise;
        const result = await db.query(
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
        return result.rows[0];
      }),
    };
    const reclaimRun = createWorker({
      claimToken: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      profileService,
    }).run();
    await generationStarted.promise;

    await expect(completePolicyProfileRefreshOutboxClaim({
      client: db,
      outboxId: abandonedProbeId,
      claimToken: abandonedClaimToken,
    })).resolves.toBe(false);
    const circuitBeforeCompletion = await db.query(
      `SELECT source_event_id, circuit_state
       FROM policy_native_profile_refresh_circuits
       WHERE library_id = $1`,
      [fixture.libraryId],
    );
    expect(circuitBeforeCompletion.rows).toEqual([{
      source_event_id: request.record.sourceEventId,
      circuit_state: 'half_open',
    }]);

    continueGeneration.resolve();
    await expect(reclaimRun).resolves.toMatchObject({
      claimed: 1,
      completed: 1,
      circuitsCleared: 1,
    });
    expect(profileService.generateProfile).toHaveBeenCalledTimes(1);

    const [circuitRows, probeRows] = await Promise.all([
      db.query(
        'SELECT source_event_id FROM policy_native_profile_refresh_circuits WHERE library_id = $1',
        [fixture.libraryId],
      ),
      db.query(
        `SELECT processing_state, attempt_count, claim_token
         FROM policy_profile_refresh_outbox
         WHERE id = $1`,
        [abandonedProbeId],
      ),
    ]);
    expect(circuitRows.rows).toEqual([]);
    expect(probeRows.rows).toEqual([{
      processing_state: 'completed',
      attempt_count: 2,
      claim_token: null,
    }]);
  });
});
