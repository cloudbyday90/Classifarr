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
});
