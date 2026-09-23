/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { ClassificationIntakeReceiptRepository } from '../../services/classificationIntakeReceiptRepository.mjs';
import { CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL } from '../../services/classificationIntakeReceiptReadRepository.mjs';

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
    const queued = [taskId, 0, null, null, null, null];
    expect(await repository.upsert(queued)).toBe(true);
    expect(await repository.upsert(queued)).toBe(true);
    await client.query("UPDATE task_queue SET status='processing', started_at=statement_timestamp() WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null])).toBe(true);
    expect(await repository.upsert([taskId, 1, 42, 'not_captured', 'retrieval_unavailable', null])).toBe(true);
    await client.query("UPDATE task_queue SET status='completed', completed_at=statement_timestamp() WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null])).toBe(true);
    // A delayed processing event must not roll back the authoritative queue status.
    expect(await repository.upsert([taskId, 1, null, null, null, null])).toBe(true);
    await client.query("UPDATE task_queue SET status='processing' WHERE id=$1", [taskId]);
    expect(await repository.upsert([taskId, 1, null, null, null, null])).toBe(true);
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
