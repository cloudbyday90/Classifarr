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
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyAuthorizedOutcomeTransactionExecutor,
} = await import('../../services/policyAuthorizedOutcomeTransactionExecutor.mjs');
const {
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
} = await import('../../services/policyLearningIntakeContract.mjs');
const {
  buildPolicyLearningDecision,
} = await import('../../services/policyLearningGuard.mjs');
const {
  policyManualCorrectionLearningService,
} = await import('../../services/policyManualCorrectionLearning.mjs');
const {
  PolicyRefreshBackedEvidencePersistence,
} = await import('../../services/policyRefreshBackedEvidencePersistence.mjs');
const {
  claimPolicyProfileRefreshOutboxBatch,
  completePolicyProfileRefreshOutboxClaim,
} = await import('../../services/policyProfileRefreshOutboxWorkerRepository.mjs');

const FIRST_CLAIM_TOKEN = '11111111-1111-4111-8111-111111111111';
const SECOND_CLAIM_TOKEN = '22222222-2222-4222-8222-222222222222';
const RECOVERY_CLAIM_TOKEN = '33333333-3333-4333-8333-333333333333';

function authorization(actorId, overrides = {}) {
  return {
    actorTypeId: 'operator',
    actorId,
    revalidated: true,
    canRecordOutcome: true,
    canWriteLearning: true,
    authorizedSourceIds: ['manual_classification_change'],
    ...overrides,
  };
}

function createExecutor({ actorId, persistRefreshBackedEvidence } = {}) {
  return new PolicyAuthorizedOutcomeTransactionExecutor({
    db,
    revalidateAuthorization: async () => authorization(actorId),
    ...(persistRefreshBackedEvidence ? { persistRefreshBackedEvidence } : {}),
  });
}

async function seedLibrary(name, mediaType = 'movie') {
  const result = await db.query(
    `INSERT INTO libraries (name, external_id, media_type, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id, name, media_type`,
    [name, `audit:${name}`, mediaType],
  );

  return result.rows[0];
}

async function seedClassification({ title, library, tmdbId }) {
  const result = await db.query(
    `INSERT INTO classification_history (
       title, tmdb_id, media_type, library_id, library_name, method, status, confidence, metadata
     )
     VALUES ($1, $2, $3, $4, $5, 'manual_correction', 'completed', 90, '{}'::jsonb)
     RETURNING id, tmdb_id, media_type, library_id`,
    [title, tmdbId, library.media_type, library.id, library.name],
  );

  return result.rows[0];
}

function buildManualAdmission({ classification, destination, sourceEventId, actorId }) {
  return policyManualCorrectionLearningService.build({
    classification: {
      id: classification.id,
      tmdbId: classification.tmdb_id,
      mediaType: classification.media_type,
    },
    destination: {
      libraryId: destination.id,
      libraryName: destination.name,
    },
    finalOutcomeRecorded: true,
    sourceEventId,
    actorId,
  });
}

function buildCompatibilityAdmission({ classification, destination, sourceEventId, actorId }) {
  const intake = buildPolicyLearningIntakeEvent({
    sourceId: 'manual_classification_change',
    sourceEventId,
    actorId,
    itemId: classification.id,
    answerOutcomeId: 'add_compatibility_evidence',
    question: { frameId: 'destination_fit', stale: false },
    answer: {
      label: destination.name,
      destinationLibraryId: destination.id,
      destinationLibraryName: destination.name,
      ambiguous: false,
    },
    candidate: {
      key: 'genre:animation',
      label: 'Animation compatibility',
      signalType: 'genre',
      destinationLibraryId: destination.id,
      destinationLibraryName: destination.name,
      evidenceCount: 2,
      evidenceSource: 'manual_correction',
    },
    finalOutcome: {
      itemId: classification.id,
      destinationLibraryId: destination.id,
      destinationLibraryName: destination.name,
      recorded: true,
    },
  });

  return {
    intake,
    decision: buildPolicyLearningDecision(buildPolicyLearningGuardInput(intake)),
  };
}

async function seedRefreshOutbox({ classificationId, libraryId, sourceEventId }) {
  const result = await db.query(
    `INSERT INTO policy_profile_refresh_outbox (
       source_id,
       source_event_id,
       classification_id,
       library_id,
       learning_operation_id,
       learning_tier_id,
       candidate_key,
       refresh_reason_id,
       source_system
     )
     VALUES (
       'manual_classification_change', $1, $2, $3,
       'write_compatibility_evidence', 'compatibility_evidence',
       'genre:animation', 'profile_refresh_required', 'policy_authorized_profile_refresh'
     )
     RETURNING id`,
    [sourceEventId, classificationId, libraryId],
  );

  return result.rows[0];
}

describe('Policy authorized outcome concurrency and recovery audit', () => {
  test('serializes a concurrent source-event replay and persists its effects once', async () => {
    const actorId = 'audit-replay-operator';
    const destination = await seedLibrary('Audit Replay Movies');
    const classification = await seedClassification({
      title: 'Audit Replay Item',
      library: destination,
      tmdbId: 810001,
    });
    const sourceEventId = `audit-replay:${classification.id}`;
    const admission = buildManualAdmission({
      classification,
      destination,
      sourceEventId,
      actorId,
    });
    const executor = createExecutor({ actorId });

    const results = await Promise.all([
      executor.execute({ intake: admission.intake, learningDecision: admission.decision }),
      executor.execute({ intake: admission.intake, learningDecision: admission.decision }),
    ]);

    expect(results.map(result => result.statusId).sort()).toEqual(['applied', 'replayed']);

    const receipts = await db.query(
      `SELECT id
       FROM policy_authorized_outcome_source_event_receipts
       WHERE source_id = 'manual_classification_change'
         AND source_event_id = $1`,
      [sourceEventId],
    );
    const evidence = await db.query(
      `SELECT id
       FROM classification_evidence
       WHERE scope = 'item_exact'
         AND tmdb_id = $1
         AND media_type = 'movie'`,
      [classification.tmdb_id],
    );

    expect(receipts.rows).toHaveLength(1);
    expect(evidence.rows).toHaveLength(1);
  });

  test('rejects destination drift and authorization loss before a receipt or writer can persist', async () => {
    const actorId = 'audit-blocked-operator';
    const destination = await seedLibrary('Audit Drift Movies');
    const classification = await seedClassification({
      title: 'Audit Drift Item',
      library: destination,
      tmdbId: 810002,
    });
    const staleSourceEventId = `audit-drift:${classification.id}`;
    const staleAdmission = buildManualAdmission({
      classification,
      destination,
      sourceEventId: staleSourceEventId,
      actorId,
    });
    await db.query('UPDATE libraries SET name = $1 WHERE id = $2', ['Audit Drift Movies Renamed', destination.id]);

    const driftResult = await createExecutor({ actorId }).execute({
      intake: staleAdmission.intake,
      learningDecision: staleAdmission.decision,
    });
    expect(driftResult.statusId).toBe('blocked');
    expect(driftResult.reasonCodes).toContain('authorized_outcome_execution_destination_name_mismatch');

    const authorizationSourceEventId = `audit-authorization:${classification.id}`;
    const currentDestination = { ...destination, name: 'Audit Drift Movies Renamed' };
    const authorizationAdmission = buildManualAdmission({
      classification,
      destination: currentDestination,
      sourceEventId: authorizationSourceEventId,
      actorId,
    });
    const authorizationExecutor = new PolicyAuthorizedOutcomeTransactionExecutor({
      db,
      revalidateAuthorization: async () => authorization(actorId, {
        canRecordOutcome: false,
        canWriteLearning: false,
        authorizedSourceIds: [],
      }),
    });
    const authorizationResult = await authorizationExecutor.execute({
      intake: authorizationAdmission.intake,
      learningDecision: authorizationAdmission.decision,
    });

    expect(authorizationResult.statusId).toBe('blocked');
    expect(authorizationResult.reasonCodes).toContain('authorized_persistence_outcome_not_authorized');

    const receipts = await db.query(
      `SELECT source_event_id
       FROM policy_authorized_outcome_source_event_receipts
       WHERE source_event_id = ANY($1::varchar[])`,
      [[staleSourceEventId, authorizationSourceEventId]],
    );
    expect(receipts.rows).toEqual([]);
  });

  test('rolls back outcome, receipt, evidence, and outbox writes when the outbox writer fails', async () => {
    const actorId = 'audit-rollback-operator';
    const destination = await seedLibrary('Audit Rollback Movies');
    const classification = await seedClassification({
      title: 'Audit Rollback Item',
      library: destination,
      tmdbId: 810003,
    });
    const sourceEventId = `audit-rollback:${classification.id}`;
    const admission = buildCompatibilityAdmission({
      classification,
      destination,
      sourceEventId,
      actorId,
    });
    const outboxRepository = {
      enqueue: jest.fn().mockRejectedValue(new Error('audit outbox writer failure')),
    };
    const refreshPersistence = new PolicyRefreshBackedEvidencePersistence({ outboxRepository });
    const executor = createExecutor({
      actorId,
      persistRefreshBackedEvidence: input => refreshPersistence.persist(input),
    });

    await expect(executor.execute({
      intake: admission.intake,
      learningDecision: admission.decision,
    })).rejects.toThrow('audit outbox writer failure');

    const [receipt, evidence, outbox, history] = await Promise.all([
      db.query('SELECT id FROM policy_authorized_outcome_source_event_receipts WHERE source_event_id = $1', [sourceEventId]),
      db.query(
        `SELECT id FROM classification_evidence
         WHERE source_classification_id = $1
           AND scope = 'genre'
           AND evidence_key = 'genre:animation'`,
        [classification.id],
      ),
      db.query('SELECT id FROM policy_profile_refresh_outbox WHERE source_event_id = $1', [sourceEventId]),
      db.query('SELECT metadata FROM classification_history WHERE id = $1', [classification.id]),
    ]);

    expect(outboxRepository.enqueue).toHaveBeenCalledTimes(1);
    expect(receipt.rows).toEqual([]);
    expect(evidence.rows).toEqual([]);
    expect(outbox.rows).toEqual([]);
    expect(history.rows[0].metadata.classification_details?.outcome_link).toBeUndefined();
  });

  test('distributes concurrent different-library claims and rejects stale completion after lease recovery', async () => {
    const firstDestination = await seedLibrary('Audit Worker Movies');
    const secondDestination = await seedLibrary('Audit Worker Secondary Movies');
    const firstOutbox = await seedRefreshOutbox({
      classificationId: 810004,
      libraryId: firstDestination.id,
      sourceEventId: 'audit-worker:first',
    });
    const secondOutbox = await seedRefreshOutbox({
      classificationId: 810005,
      libraryId: secondDestination.id,
      sourceEventId: 'audit-worker:second',
    });
    const firstClient = await db.pool.connect();
    const secondClient = await db.pool.connect();

    try {
      await firstClient.query('BEGIN');
      const firstClaims = await claimPolicyProfileRefreshOutboxBatch({
        client: firstClient,
        claimToken: FIRST_CLAIM_TOKEN,
        limit: 1,
        leaseSeconds: 180,
      });

      await secondClient.query('BEGIN');
      const secondClaims = await claimPolicyProfileRefreshOutboxBatch({
        client: secondClient,
        claimToken: SECOND_CLAIM_TOKEN,
        limit: 1,
        leaseSeconds: 180,
      });
      await secondClient.query('COMMIT');
      await firstClient.query('COMMIT');

      expect(firstClaims).toHaveLength(1);
      expect(secondClaims).toHaveLength(1);
      expect(new Set([firstClaims[0].id, secondClaims[0].id])).toEqual(
        new Set([String(firstOutbox.id), String(secondOutbox.id)]),
      );

      const firstClaim = firstClaims[0];
      await db.query(
        `UPDATE policy_profile_refresh_outbox
         SET lease_expires_at = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [firstClaim.id],
      );

      const recoveredClaims = await db.withTransaction(client => claimPolicyProfileRefreshOutboxBatch({
        client,
        claimToken: RECOVERY_CLAIM_TOKEN,
        limit: 1,
        leaseSeconds: 180,
      }));
      expect(recoveredClaims).toEqual([
        expect.objectContaining({ id: firstClaim.id, attemptCount: 2 }),
      ]);

      const staleCompletion = await db.withTransaction(client => completePolicyProfileRefreshOutboxClaim({
        client,
        outboxId: firstClaim.id,
        claimToken: FIRST_CLAIM_TOKEN,
      }));
      const recoveredCompletion = await db.withTransaction(client => completePolicyProfileRefreshOutboxClaim({
        client,
        outboxId: firstClaim.id,
        claimToken: RECOVERY_CLAIM_TOKEN,
      }));
      const remainingClaim = secondClaims[0].id === firstClaim.id ? firstClaims[0] : secondClaims[0];
      const remainingToken = secondClaims[0].id === firstClaim.id
        ? FIRST_CLAIM_TOKEN
        : SECOND_CLAIM_TOKEN;
      await db.withTransaction(client => completePolicyProfileRefreshOutboxClaim({
        client,
        outboxId: remainingClaim.id,
        claimToken: remainingToken,
      }));

      expect(staleCompletion).toBe(false);
      expect(recoveredCompletion).toBe(true);
      const records = await db.query(
        `SELECT id, processing_state, attempt_count, claim_token, completed_at
         FROM policy_profile_refresh_outbox
         WHERE id = ANY($1::bigint[])
         ORDER BY id`,
        [[firstOutbox.id, secondOutbox.id]],
      );
      expect(records.rows).toEqual([
        expect.objectContaining({
          id: firstOutbox.id,
          processing_state: 'completed',
          attempt_count: 2,
          claim_token: null,
          completed_at: expect.any(Date),
        }),
        expect.objectContaining({
          id: secondOutbox.id,
          processing_state: 'completed',
          attempt_count: 1,
          claim_token: null,
          completed_at: expect.any(Date),
        }),
      ]);
    } finally {
      await firstClient.query('ROLLBACK');
      await secondClient.query('ROLLBACK');
      firstClient.release();
      secondClient.release();
    }
  });

  test('rejects another active profile refresh for the same library at the database boundary', async () => {
    const destination = await seedLibrary('Audit Worker Coalesced Movies');
    await seedRefreshOutbox({
      classificationId: 810006,
      libraryId: destination.id,
      sourceEventId: 'audit-worker:coalesced:first',
    });

    await expect(seedRefreshOutbox({
      classificationId: 810007,
      libraryId: destination.id,
      sourceEventId: 'audit-worker:coalesced:second',
    })).rejects.toMatchObject({ code: '23505' });
  });
});
