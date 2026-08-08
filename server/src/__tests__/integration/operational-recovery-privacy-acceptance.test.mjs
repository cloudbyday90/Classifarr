/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Acceptance coverage for 10R.3.2. It uses the isolated PostgreSQL suite
 * database and in-process fault doubles only; no provider or media server is
 * contacted.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');
const { QueueWorkerLoopService } = await import('../../services/queueWorkerLoopService.mjs');
const { getPendingClassifications } = await import('../../services/clarificationPendingQueries.mjs');
const policyQuestionContext = await import('../../utils/policyQuestionContext.mjs');
const {
  buildPolicyRuntimeQuestionAnswerContract,
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
} = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');

function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

async function seedLibrary(pool, suffix) {
  const mediaServer = await pool.query(
    `INSERT INTO media_server (name, type, url, api_key, is_active)
     VALUES ($1, 'plex', 'http://localhost:32400', 'acceptance-key', true)
     RETURNING id`,
    [`recovery-privacy-server-${suffix}`],
  );
  const library = await pool.query(
    `INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
     VALUES ($1, $2, $3, 'movie', true, 1)
     RETURNING id, name`,
    [mediaServer.rows[0].id, `recovery-privacy-library-${suffix}`, `Recovery Privacy ${suffix}`],
  );

  return library.rows[0];
}

describe('privacy-bounded recovery and stale-evidence acceptance', () => {
  let pool;

  beforeAll(() => {
    pool = getPool();
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE TABLE
        task_queue,
        classification_history,
        libraries,
        media_server
      RESTART IDENTITY CASCADE
    `);
  });

  test('a retry transaction failure returns only a bounded recovery state and leaves no partial retry', async () => {
    const library = await seedLibrary(pool, 'retry');
    const classification = await pool.query(
      `INSERT INTO classification_history
        (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, metadata, status)
       VALUES (900101, 'movie', 'Retry Privacy Fixture', 2026, $1, $2, 60, 'ai_analysis', '{}'::jsonb, 'awaiting_decision')
       RETURNING id`,
      [library.id, library.name],
    );
    const secret = 'provider=https://private.example?token=fixture-secret';
    const logger = createLogger();
    const service = new ClassificationRetryService({
      db,
      logger,
      stateService: {
        hasPendingClassificationTask: async () => {
          throw new Error(secret);
        },
      },
    });

    const result = await service.retryClassifications({
      classificationIds: [classification.rows[0].id],
      correlationId: 'privacy-retry-acceptance',
    });

    expect(result).toMatchObject({ requested: 1, queued: 0, failed: 1 });
    expect(result.results[0]).toMatchObject({
      classificationId: classification.rows[0].id,
      failed: true,
      reasonCode: 'retry_failed',
    });
    expect(JSON.stringify({ result, logs: logger.error.mock.calls })).not.toContain('fixture-secret');

    const persisted = await pool.query(
      'SELECT status FROM classification_history WHERE id = $1',
      [classification.rows[0].id],
    );
    const queued = await pool.query('SELECT COUNT(*)::int AS count FROM task_queue');
    expect(persisted.rows[0].status).toBe('awaiting_decision');
    expect(queued.rows[0].count).toBe(0);
  });

  test('stale persisted evidence remains readable after restart but disables destination-changing answers', async () => {
    const library = await seedLibrary(pool, 'stale');
    const question = {
      version: 'policy.runtime_question_persistence.v1',
      runtimeQuestion: { contractVersion: 'policy.runtime_question_reduction.v1' },
      runtimeQuestionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
      options: [
        { label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: library.id },
        { label: 'Do not learn', outcomeId: 'do_not_learn' },
      ],
      meta: {
        question_context: {
          version: '2000-01-01T00:00:00.000Z',
          policy_ids: [],
          library_ids: [library.id],
        },
        runtime_question_persistence: {
          destinationLibraryId: library.id,
          destinationLibraryName: library.name,
        },
      },
    };
    const classification = await pool.query(
      `INSERT INTO classification_history
        (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, metadata, policy_question, status)
       VALUES (900102, 'movie', 'Stale Evidence Fixture', 2026, $1, $2, 60, 'ai_analysis', '{}'::jsonb, $3::jsonb, 'awaiting_decision')
       RETURNING id`,
      [library.id, library.name, JSON.stringify(question)],
    );

    const [pending] = await getPendingClassifications(policyQuestionContext);
    const contract = buildPolicyRuntimeQuestionAnswerContract({
      classification: pending,
      question: pending.policy_question,
      isStale: pending.policy_question_stale,
      currentContextVersion: pending.policy_question_current_context_version,
    });

    expect(pending.id).toBe(classification.rows[0].id);
    expect(pending.policy_question_stale).toBe(true);
    expect(contract.freshness.status).toBe('stale');
    expect(contract.allowed_actions.find((action) => action.id === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION))
      .toMatchObject({ available: false, unavailable_reason: 'question_stale' });
    expect(contract.allowed_actions.find((action) => action.id === POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CHANGE_DESTINATION))
      .toMatchObject({ available: false, unavailable_reason: 'question_stale' });
  });

  test('a startup restart recovers only expired work with a stable operator reason', async () => {
    const logger = createLogger();
    const worker = new QueueWorkerLoopService({
      db,
      logger,
      visibilityTimeoutMinutes: 5,
    });

    await pool.query(`
      INSERT INTO task_queue (task_type, status, payload, priority, started_at)
      VALUES ('classification', 'processing', '{}'::jsonb, 5, NOW() - INTERVAL '6 minutes')
    `);
    await pool.query(`
      INSERT INTO task_queue (task_type, status, payload, priority, started_at)
      VALUES ('classification', 'processing', '{}'::jsonb, 5, NOW() - INTERVAL '1 minute')
    `);

    expect(await worker.resetStaleProcessingTasks()).toBe(1);

    const rows = await pool.query(
      'SELECT status, error_message FROM task_queue ORDER BY created_at ASC, id ASC',
    );
    expect(rows.rows).toEqual([
      { status: 'pending', error_message: 'task_startup_stale_recovered' },
      { status: 'processing', error_message: null },
    ]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
