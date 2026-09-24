/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { ClassificationIntakeReceiptRepository } from '../../services/classificationIntakeReceiptRepository.mjs';
import { CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL } from '../../services/classificationIntakeReceiptReadRepository.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { buildFeedbackOutcomeSnapshot } from '../../services/feedbackOutcomeSnapshot.mjs';
import { readDestinationOutcomes } from '../../services/destinationOutcomeEvaluationRepository.mjs';

test.each(['movie', 'tv'])('%s coverage retains exact saved decisions through terminal events and queue cleanup', async mediaType => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const libraryId = (await client.query(`INSERT INTO libraries(name,external_id,media_type)
      VALUES('Coverage fixture','coverage-fixture',$1) RETURNING id`, [mediaType])).rows[0].id;
    const taskId = (await client.query(`INSERT INTO task_queue(task_type,payload,priority,source,max_attempts)
      VALUES('classification','{}',0,'manual',5) RETURNING id`)).rows[0].id;
    const capture = buildClassificationDestinationDecision({ metadata: { media_type: mediaType, tmdb_id: 42 },
      method: 'ai_analysis', status: 'completed', libraryId });
    const decisionContext = { classificationId: 42, capture };
    const repository = new ClassificationIntakeReceiptRepository({ db: client });
    expect(await repository.upsert([taskId, 0, 42, null, null, null, decisionContext])).toBe(true);
    await client.query("UPDATE task_queue SET status='completed' WHERE id=$1", [taskId]);
    await repository.upsert([taskId, 0, null, null, null, null, null]);
    await repository.upsert([taskId, 0, 42, null, null, null, null]);
    await repository.upsert([taskId, 0, 42, null, null, null,
      { classificationId: 42, capture: { ...capture, libraryId: libraryId + 100 } }]);
    const snapshot = buildFeedbackOutcomeSnapshot({ id: 42, media_type: mediaType, tmdb_id: 42, method: 'ai_analysis',
      metadata: { classification_details: { destination_decision: capture } } }, libraryId);
    await client.query(`INSERT INTO policy_feedback_sources(classification_id,intake,request_fingerprint,outcome_snapshot)
      VALUES(42,'standalone',$1,$2)`, ['a'.repeat(64), snapshot]);
    await client.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
    expect(await readDestinationOutcomes(client)).toMatchObject({ overall: { completedAgreement: 1 },
      intake: { queueTasks: 1, states: { completed: 1 }, overall: { knownClassifierDecisions: 1,
        labeledDecisions: 1, labelCoverageRate: 1 } } });
    await client.query("UPDATE libraries SET is_active=FALSE WHERE id=$1", [libraryId]);
    expect(await readDestinationOutcomes(client)).toMatchObject({ overall: { unavailableDestination: 1 },
      intake: { overall: { knownClassifierDecisions: 1, unusableOutcome: 1, labelCoverageRate: 0 } } });
    await client.query("UPDATE classification_intake_receipts SET queued_at=NOW()-INTERVAL '31 days'");
    expect((await readDestinationOutcomes(client)).intake.queueTasks).toBe(0);
    expect(await repository.prune()).toBe(1);
  } finally { await client.query('ROLLBACK'); client.release(); }
});

test('a new classification ID cannot inherit an old capture and snapshot constraints reject raw payloads', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const taskId = (await client.query(`INSERT INTO task_queue(task_type,payload,priority,source,max_attempts)
      VALUES('classification','{}',0,'manual',5) RETURNING id`)).rows[0].id;
    const repository = new ClassificationIntakeReceiptRepository({ db: client });
    const capture = buildClassificationDestinationDecision({ metadata: { media_type: 'movie', tmdb_id: 42 },
      method: 'ai_analysis', status: 'completed', libraryId: 2 });
    await repository.upsert([taskId, 0, 42, null, null, null, { classificationId: 42, capture }]);
    await repository.upsert([taskId, 0, 43, null, null, null, null]);
    expect((await client.query('SELECT classification_id,decision_context FROM classification_intake_receipts')).rows)
      .toEqual([{ classification_id: 43, decision_context: null }]);
    for (const value of ['[]', JSON.stringify({ raw: 'x'.repeat(1024) })]) {
      await client.query('SAVEPOINT bad_snapshot');
      await expect(client.query('UPDATE classification_intake_receipts SET decision_context=$1', [value]))
        .rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT bad_snapshot');
      await expect(client.query(`INSERT INTO policy_feedback_sources(classification_id,intake,request_fingerprint,outcome_snapshot)
        VALUES(42,'standalone',$1,$2)`, ['a'.repeat(64), value])).rejects.toMatchObject({ code: '23514' });
      await client.query('ROLLBACK TO SAVEPOINT bad_snapshot');
    }
  } finally { await client.query('ROLLBACK'); client.release(); }
});

test('migration and idempotent receipt lifecycle survive queue cleanup without payload copies', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const migration = readFileSync(new URL('../../../../database/migrations/20260923_120000_add_classification_intake_receipts.sql', import.meta.url), 'utf8');
    await client.query(migration);
    const columns = (await client.query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'classification_intake_receipts'`)).rows
      .map(row => row.column_name);
    expect(columns).toEqual(expect.arrayContaining(['queue_task_id', 'comparison_reason_id']));
    for (const forbidden of ['title', 'payload', 'email', 'ip_address', 'provider_id', 'library_id']) {
      expect(columns).not.toContain(forbidden);
    }

    const task = (await client.query(`INSERT INTO task_queue
      (task_type, payload, priority, source, max_attempts)
      VALUES ('classification', '{}'::jsonb, 0, 'manual', 5) RETURNING id`)).rows[0];
    const repository = new ClassificationIntakeReceiptRepository({ db: client });
    const taskId = task.id;
    const queued = [taskId, 0, null, null, null, null, null];
    expect(await repository.upsert(queued)).toBe(true);
    expect(await repository.upsert(queued)).toBe(true);
    await client.query("UPDATE task_queue SET status='processing', started_at=statement_timestamp() WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null, null])).toBe(true);
    expect(await repository.upsert([taskId, 1, 42, 'not_captured', 'retrieval_unavailable', null, null])).toBe(true);
    await client.query("UPDATE task_queue SET status='completed', completed_at=statement_timestamp() WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null, null])).toBe(true);
    // A delayed processing event must not roll back the authoritative queue status.
    expect(await repository.upsert([taskId, 1, null, null, null, null, null])).toBe(true);
    await client.query("UPDATE task_queue SET status='processing' WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null, null])).toBe(true);
    const receipt = (await client.query(`SELECT * FROM classification_intake_receipts WHERE queue_task_id=$1`, [taskId])).rows[0];
    expect(receipt).toMatchObject({ source_class: 'manual', status_id: 'completed', attempt_count: 1,
      classification_id: 42, comparison_status_id: 'not_captured', comparison_reason_id: 'retrieval_unavailable' });
    await client.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
    expect((await client.query(CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL,
      [new Date(Date.now() - 3600000).toISOString(), new Date(Date.now() + 3600000).toISOString(), 2])).rows)
      .toHaveLength(1);
    await client.query("UPDATE classification_intake_receipts SET queued_at=statement_timestamp()-INTERVAL '31 days' WHERE queue_task_id=$1", [taskId]);
    expect(await repository.prune()).toBe(1);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('bounded reconciliation repairs a missing receipt from retained queue state', async () => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const taskId = (await client.query(`INSERT INTO task_queue
      (task_type, payload, priority, source, max_attempts)
      VALUES ('classification', '{}'::jsonb, 0, 'reprocess', 5) RETURNING id`)).rows[0].id;
    const repository = new ClassificationIntakeReceiptRepository({ db: client });
    expect(await repository.reconcile()).toBeGreaterThanOrEqual(1);
    expect((await client.query('SELECT source_class, status_id FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId])).rows[0])
      .toEqual({ source_class: 'reprocess', status_id: 'queued' });
    expect(await repository.reconcile()).toBe(0);
    await client.query('CREATE TEMP TABLE classification_history (id integer, metadata jsonb) ON COMMIT DROP');
    await client.query(`CREATE TEMP TABLE classification_queue_decision_witnesses
      (queue_task_id bigint, classification_id bigint, created_at timestamptz) ON COMMIT DROP`);
    await client.query(`INSERT INTO classification_history VALUES
      (77, '{"classification_details":{"inventory_ranking_shadow_status_id":"not_captured",
      "inventory_ranking_shadow_reason_id":"comparison_incomplete"}}'::jsonb)`);
    await client.query(`INSERT INTO classification_queue_decision_witnesses
      VALUES ($1, 77, statement_timestamp())`, [taskId]);
    expect(await repository.reconcileClassificationLinks()).toBe(1);
    expect((await client.query(`SELECT classification_id, comparison_status_id, comparison_reason_id
      FROM classification_intake_receipts WHERE queue_task_id=$1`, [taskId])).rows[0])
      .toEqual({ classification_id: 77, comparison_status_id: 'not_captured',
        comparison_reason_id: 'comparison_incomplete' });
    expect(await repository.reconcileClassificationLinks()).toBe(0);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});
