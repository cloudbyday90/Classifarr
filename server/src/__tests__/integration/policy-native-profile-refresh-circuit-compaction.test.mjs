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
  compactPolicyNativeProfileRefreshCircuitHistory,
} = await import('../../services/policyNativeProfileRefreshCircuitCompactionRepository.mjs');
const {
  PolicyNativeProfileRefreshPlanner,
} = await import('../../services/policyNativeProfileRefreshPlanner.mjs');
const {
  buildPolicyNativeProfileRefreshRequest,
} = await import('../../services/policyNativeProfileRefreshRequest.mjs');

function buildSourceEventId(libraryId) {
  return `library-profile:${libraryId}:missing_profile:items:1:high-water:1`;
}

function daysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

async function createLibrary() {
  const suffix = randomUUID().replaceAll('-', '');
  const result = await db.query(
    `INSERT INTO libraries (external_id, name, media_type, is_active)
     VALUES ($1, $2, 'movie', TRUE)
     RETURNING id`,
    [`native-circuit-compaction-${suffix}`, `Native Circuit Compaction ${suffix}`],
  );

  return result.rows[0].id;
}

async function createNativeProfileRefreshCandidateFixture() {
  const libraryId = await createLibrary();
  const policyResult = await db.query(
    `INSERT INTO library_policies (library_id, name, enabled)
     VALUES ($1, $2, TRUE)
     RETURNING id`,
    [libraryId, `Native Circuit Compaction Policy ${randomUUID()}`],
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
    [
      libraryId,
      `native-circuit-compaction-item-${randomUUID()}`,
      `Native Circuit Compaction Item ${randomUUID()}`,
    ],
  );

  return {
    libraryId,
    policyId,
    observedItemHighWaterMark: itemResult.rows[0].id,
  };
}

function createPlanner({ now = new Date() } = {}) {
  return new PolicyNativeProfileRefreshPlanner({
    dbClient: db,
    now: () => now,
    loggerInstance: { info: jest.fn(), warn: jest.fn() },
  });
}

async function insertNativeOutbox({
  libraryId,
  sourceEventId,
  processingState = 'failed',
  attemptCount = 1,
  failureCode = 'profile_refresh_unknown_failed',
  ageDays = 31,
}) {
  const agedAt = daysAgo(ageDays);
  const completedAt = processingState === 'completed' ? agedAt : null;
  const result = await db.query(
    `INSERT INTO policy_profile_refresh_outbox (
       source_id, source_event_id, classification_id, library_id,
       learning_operation_id, learning_tier_id, candidate_key,
       refresh_reason_id, source_system, request_type, processing_state,
       attempt_count, available_at, completed_at, failure_code, created_at, updated_at
     )
     VALUES (
       'native_policy_profile_readiness', $1, NULL, $2,
       NULL, NULL, NULL,
       'stale_library_profile', 'policy_native_readiness_profile_refresh', 'native_readiness',
       $3, $4, $6::timestamptz,
       $7::timestamptz, $5, $6::timestamptz, $6::timestamptz
     )
     RETURNING id`,
    [sourceEventId, libraryId, processingState, attemptCount, failureCode, agedAt, completedAt],
  );

  return result.rows[0].id;
}

async function insertCircuit({
  libraryId,
  sourceEventId,
  circuitState = 'closed',
  failureCount = 1,
  lastTerminalOutboxId,
  probeOutboxId = null,
  ageDays = 31,
}) {
  const agedAt = daysAgo(ageDays);
  const openedAt = circuitState === 'closed' ? null : agedAt;
  const nextProbeAt = circuitState === 'open' ? agedAt : null;

  await db.query(
    `INSERT INTO policy_native_profile_refresh_circuits (
       library_id, source_event_id, circuit_state, consecutive_failure_count,
       last_terminal_outbox_id, last_failure_code, opened_at, next_probe_at,
       probe_outbox_id, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, 'profile_refresh_unknown_failed', $6, $7, $8, $9, $9)`,
    [
      libraryId,
      sourceEventId,
      circuitState,
      failureCount,
      lastTerminalOutboxId,
      openedAt,
      nextProbeAt,
      probeOutboxId,
      agedAt,
    ],
  );
}

async function createRevision({
  circuitState = 'closed',
  ageDays = 31,
  withPendingOutbox = false,
} = {}) {
  const libraryId = await createLibrary();
  const sourceEventId = buildSourceEventId(libraryId);
  const terminalOutboxId = await insertNativeOutbox({
    libraryId,
    sourceEventId,
    ageDays,
  });
  const pendingOutboxId = withPendingOutbox
    ? await insertNativeOutbox({
      libraryId,
      sourceEventId: `${sourceEventId}:retry:${terminalOutboxId}`,
      processingState: 'pending',
      attemptCount: 0,
      failureCode: null,
      ageDays,
    })
    : null;
  await insertCircuit({
    libraryId,
    sourceEventId,
    circuitState,
    failureCount: circuitState === 'closed' ? 1 : 3,
    lastTerminalOutboxId: terminalOutboxId,
    probeOutboxId: circuitState === 'half_open' ? pendingOutboxId : null,
    ageDays,
  });

  return { libraryId, sourceEventId, terminalOutboxId, pendingOutboxId };
}

describe('Native profile refresh circuit retention-compaction integration', () => {
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

  test('removes only expired inactive history while retaining active and protected revisions', async () => {
    const expiredInactive = await createRevision();
    const activeOpen = await createRevision({ circuitState: 'open' });
    const activeHalfOpen = await createRevision({
      circuitState: 'half_open',
      withPendingOutbox: true,
    });
    const closedWithPendingWork = await createRevision({ withPendingOutbox: true });
    const protectedRevision = await createRevision();
    const recentInactive = await createRevision({ ageDays: 29 });
    libraryIds.push(
      expiredInactive.libraryId,
      activeOpen.libraryId,
      activeHalfOpen.libraryId,
      closedWithPendingWork.libraryId,
      protectedRevision.libraryId,
      recentInactive.libraryId,
    );

    await expect(compactPolicyNativeProfileRefreshCircuitHistory({
      client: db,
      protectedRevisions: [protectedRevision],
    })).resolves.toEqual({ circuitsCompacted: 1, outboxRowsCompacted: 1 });

    const [circuitRows, outboxRows] = await Promise.all([
      db.query(
        `SELECT library_id, source_event_id, circuit_state
         FROM policy_native_profile_refresh_circuits
         WHERE library_id = ANY($1::bigint[])
         ORDER BY library_id`,
        [libraryIds],
      ),
      db.query(
        `SELECT library_id, source_event_id, processing_state
         FROM policy_profile_refresh_outbox
         WHERE library_id = ANY($1::bigint[])
         ORDER BY library_id, id`,
        [libraryIds],
      ),
    ]);

    expect(circuitRows.rows).toHaveLength(5);
    expect(circuitRows.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        library_id: activeOpen.libraryId,
        source_event_id: activeOpen.sourceEventId,
        circuit_state: 'open',
      }),
      expect.objectContaining({
        library_id: activeHalfOpen.libraryId,
        source_event_id: activeHalfOpen.sourceEventId,
        circuit_state: 'half_open',
      }),
      expect.objectContaining({
        library_id: closedWithPendingWork.libraryId,
        source_event_id: closedWithPendingWork.sourceEventId,
        circuit_state: 'closed',
      }),
      expect.objectContaining({
        library_id: protectedRevision.libraryId,
        source_event_id: protectedRevision.sourceEventId,
        circuit_state: 'closed',
      }),
      expect.objectContaining({
        library_id: recentInactive.libraryId,
        source_event_id: recentInactive.sourceEventId,
        circuit_state: 'closed',
      }),
    ]));
    expect(circuitRows.rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ library_id: expiredInactive.libraryId }),
    ]));

    expect(outboxRows.rows).toHaveLength(7);
    expect(outboxRows.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        library_id: activeOpen.libraryId,
        source_event_id: activeOpen.sourceEventId,
        processing_state: 'failed',
      }),
      expect.objectContaining({
        library_id: activeHalfOpen.libraryId,
        source_event_id: activeHalfOpen.sourceEventId,
        processing_state: 'failed',
      }),
      expect.objectContaining({
        library_id: activeHalfOpen.libraryId,
        source_event_id: `${activeHalfOpen.sourceEventId}:retry:${activeHalfOpen.terminalOutboxId}`,
        processing_state: 'pending',
      }),
      expect.objectContaining({
        library_id: closedWithPendingWork.libraryId,
        source_event_id: closedWithPendingWork.sourceEventId,
        processing_state: 'failed',
      }),
      expect.objectContaining({
        library_id: closedWithPendingWork.libraryId,
        source_event_id:
          `${closedWithPendingWork.sourceEventId}:retry:${closedWithPendingWork.terminalOutboxId}`,
        processing_state: 'pending',
      }),
      expect.objectContaining({
        library_id: protectedRevision.libraryId,
        source_event_id: protectedRevision.sourceEventId,
        processing_state: 'failed',
      }),
      expect.objectContaining({
        library_id: recentInactive.libraryId,
        source_event_id: recentInactive.sourceEventId,
        processing_state: 'failed',
      }),
    ]));
    expect(outboxRows.rows).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ library_id: expiredInactive.libraryId }),
    ]));
  });

  test('keeps a current expired revision while concurrent planners schedule its recovery', async () => {
    const fixture = await createNativeProfileRefreshCandidateFixture();
    libraryIds.push(fixture.libraryId);
    const request = buildPolicyNativeProfileRefreshRequest({
      libraryId: fixture.libraryId,
      profileState: 'missing_profile',
      observedItemCount: 1,
      observedItemHighWaterMark: fixture.observedItemHighWaterMark,
    });
    expect(request.ready).toBe(true);

    const terminalOutboxId = await insertNativeOutbox({
      libraryId: fixture.libraryId,
      sourceEventId: request.record.sourceEventId,
    });
    await insertCircuit({
      libraryId: fixture.libraryId,
      sourceEventId: request.record.sourceEventId,
      lastTerminalOutboxId: terminalOutboxId,
    });

    const plannerResults = await Promise.all([
      createPlanner().run(),
      createPlanner().run(),
    ]);
    expect(plannerResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        successorQueued: 1,
        successorReplayed: 0,
        circuitsCompacted: 0,
        outboxRowsCompacted: 0,
      }),
      expect.objectContaining({
        successorQueued: 0,
        successorReplayed: 1,
        circuitsCompacted: 0,
        outboxRowsCompacted: 0,
      }),
    ]));

    const [circuitRows, outboxRows] = await Promise.all([
      db.query(
        `SELECT circuit_state, consecutive_failure_count, last_terminal_outbox_id
         FROM policy_native_profile_refresh_circuits
         WHERE library_id = $1
           AND source_event_id = $2`,
        [fixture.libraryId, request.record.sourceEventId],
      ),
      db.query(
        `SELECT source_event_id, processing_state, attempt_count
         FROM policy_profile_refresh_outbox
         WHERE library_id = $1
         ORDER BY id`,
        [fixture.libraryId],
      ),
    ]);
    expect(circuitRows.rows).toEqual([{
      circuit_state: 'closed',
      consecutive_failure_count: 1,
      last_terminal_outbox_id: Number(terminalOutboxId),
    }]);
    expect(outboxRows.rows).toEqual([
      {
        source_event_id: request.record.sourceEventId,
        processing_state: 'failed',
        attempt_count: 1,
      },
      {
        source_event_id: `${request.record.sourceEventId}:retry:${terminalOutboxId}`,
        processing_state: 'pending',
        attempt_count: 0,
      },
    ]);
  });
});
