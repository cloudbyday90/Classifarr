/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { ClassificationIntakeReceiptService } from '../../services/classificationIntakeReceiptService.mjs';
import { ClassificationIntakeReceiptRepository } from '../../services/classificationIntakeReceiptRepository.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { ClassificationIntakeDecisionRecovery } from '../../services/classificationIntakeDecisionRecovery.mjs';
import { FILL_INTAKE_DECISION_CONTEXTS_SQL } from '../../services/classificationIntakeDecisionRecoverySql.mjs';

let client, libraryId;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('BEGIN');
  libraryId = (await client.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Recovery fixture','recovery-fixture','movie') RETURNING id`)).rows[0].id;
});

test.each(['movie', 'tv'])('exact %s capture recovery survives later queue/history cleanup and remains idempotent', async mediaType => {
  const { taskId, classificationId, capture, repository } = await fixture({ mediaType });
  const before = await receipt(taskId);
  await client.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
  expect(await repository.recoverDecisionContexts()).toBe(1);
  expect((await receipt(taskId)).decision_context).toEqual({ classificationId, capture });
  await client.query('DELETE FROM classification_history WHERE id=$1', [classificationId]);
  expect(await repository.recoverDecisionContexts()).toBe(0);
  const after = await receipt(taskId);
  expect(after.decision_context).toEqual({ classificationId, capture });
  expect(after.queued_at).toEqual(before.queued_at);
});

test.each([
  ['missing', null], ['version', { version: 'unknown' }], ['identity', { tmdbId: 99 }],
  ['method', { method: 'policy_auto' }], ['media', { mediaType: 'music' }], ['extra field', { title: 'private' }],
  ['oversize', { extra: 'x'.repeat(2048) }],
])('%s original capture stays unknown, never inferred from current destination', async (_name, change) => {
  const { taskId, classificationId, repository } = await fixture({ captureChange: change ?? {} });
  if (change === null) await client.query("UPDATE classification_history SET metadata='{}' WHERE id=$1", [classificationId]);
  expect(await repository.recoverDecisionContexts()).toBe(0);
  expect((await receipt(taskId)).decision_context).toBeNull();
});

test.each(["NOW()-INTERVAL '31 days'", "NOW()+INTERVAL '1 day'"])('out-of-window receipt %s is neither repaired nor refreshed', async time => {
  const { taskId, repository } = await fixture();
  await client.query(`UPDATE classification_intake_receipts SET queued_at=${time} WHERE queue_task_id=$1`, [taskId]);
  const before = await receipt(taskId);
  expect(await repository.recoverDecisionContexts()).toBe(0);
  expect(await receipt(taskId)).toEqual(before);
});

test.each(['link', 'context', 'history', 'method', 'media', 'identity', 'expiry', 'deleted'])('write-time %s changes cannot be overwritten by a stale recovery read', async change => {
  const { taskId, classificationId, capture } = await fixture();
  const db = { query: async (sql, params) => {
    if (sql === FILL_INTAKE_DECISION_CONTEXTS_SQL) {
      if (change === 'link') await client.query('UPDATE classification_intake_receipts SET classification_id=$1 WHERE queue_task_id=$2', [classificationId + 100, taskId]);
      if (change === 'context') await client.query('UPDATE classification_intake_receipts SET decision_context=$1 WHERE queue_task_id=$2',
        [{ classificationId, capture: { ...capture, libraryId: libraryId + 100 } }, taskId]);
      if (change === 'history') await client.query("UPDATE classification_history SET metadata='{}' WHERE id=$1", [classificationId]);
      if (change === 'method') await client.query("UPDATE classification_history SET method='manual_classification' WHERE id=$1", [classificationId]);
      if (change === 'media') await client.query("UPDATE classification_history SET media_type='tv' WHERE id=$1", [classificationId]);
      if (change === 'identity') await client.query('UPDATE classification_history SET tmdb_id=43 WHERE id=$1', [classificationId]);
      if (change === 'expiry') await client.query("UPDATE classification_intake_receipts SET queued_at=NOW()-INTERVAL '31 days' WHERE queue_task_id=$1", [taskId]);
      if (change === 'deleted') await client.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId]);
    }
    return client.query(sql, params);
  } };
  expect(await new ClassificationIntakeDecisionRecovery({ db }).run()).toBe(0);
  const saved = await receipt(taskId);
  if (change === 'deleted') expect(saved).toBeUndefined();
  else if (change === 'context') expect(saved.decision_context.capture.libraryId).toBe(libraryId + 100);
  else expect(saved.decision_context).toBeNull();
});

test.each(['awaiting_decision', 'pending_retry'])('recovery preserves original %s rather than the current completed status', async status => {
  const { taskId, capture, repository } = await fixture({ captureChange: { status, libraryId: null } });
  expect(await repository.recoverDecisionContexts()).toBe(1);
  expect((await receipt(taskId)).decision_context.capture).toEqual(capture);
});

test('source-only original identity is recovered exactly; absent history remains unknown', async () => {
  const { taskId, classificationId, repository } = await fixture({ captureChange: { tmdbId: null } });
  await client.query('UPDATE classification_history SET tmdb_id=NULL WHERE id=$1', [classificationId]);
  expect(await repository.recoverDecisionContexts()).toBe(1);
  expect((await receipt(taskId)).decision_context.capture.tmdbId).toBeNull();
  const missing = await fixture();
  await client.query('DELETE FROM classification_history WHERE id=$1', [missing.classificationId]);
  expect(await repository.recoverDecisionContexts()).toBe(0);
  expect((await receipt(missing.taskId)).decision_context).toBeNull();
});

test('an unrepresentable latest classification link cannot abort reconciliation or fall back to an older decision', async () => {
  const { taskId, classificationId, repository } = await fixture({ linked: false });
  const newest = await fixture();
  await client.query("UPDATE classification_history SET id=9223372036854775807 WHERE id=$1", [newest.classificationId]);
  await client.query(`INSERT INTO classification_queue_decision_witnesses(queue_task_id,classification_id,witness,fingerprint,created_at)
    VALUES($1,$2,'{}',$3,NOW()-INTERVAL '1 second'),($1,9223372036854775807,'{}',$3,NOW())`,
  [taskId, classificationId, 'b'.repeat(64)]);
  expect(await repository.reconcileClassificationLinks()).toBe(0);
  expect((await receipt(taskId)).classification_id).toBeNull();
});

test('a page of invalid originals does not starve a later valid receipt; repaired originals are reconsidered after wrap', async () => {
  const bad = await fixture({ captureChange: { version: 'unknown' } });
  await client.query(`INSERT INTO classification_intake_receipts(queue_task_id,classification_id,source_class,status_id,queued_at)
    SELECT 1000000+n,$1,'manual','completed',NOW() FROM generate_series(1,499) n`, [bad.classificationId]);
  const good = await fixture();
  await client.query('UPDATE classification_intake_receipts SET queue_task_id=2000000 WHERE queue_task_id=$1', [good.taskId]);
  expect(await good.repository.recoverDecisionContexts()).toBe(0);
  expect(await good.repository.recoverDecisionContexts()).toBe(1);
  expect((await receipt(2000000)).decision_context.capture).toEqual(good.capture);
  await client.query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,destination_decision,version}', '"classification.destination_decision.v1"') WHERE id=$1`, [bad.classificationId]);
  expect(await good.repository.recoverDecisionContexts()).toBe(500);
});

test('busy receipts are skipped without waiting and recovered after the competing transaction releases them', async () => {
  const { taskId, classificationId, repository } = await fixture();
  await client.query('COMMIT');
  const locker = await getPool().connect();
  try {
    await locker.query('BEGIN');
    await locker.query('SELECT 1 FROM classification_intake_receipts WHERE queue_task_id=$1 FOR UPDATE', [taskId]);
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout='1s'");
    expect(await repository.recoverDecisionContexts()).toBe(0);
    await locker.query('ROLLBACK');
    expect(await repository.recoverDecisionContexts()).toBe(1);
    await client.query('COMMIT');
  } finally {
    await locker.query('ROLLBACK'); locker.release();
    await client.query('ROLLBACK');
    await client.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId]);
    await client.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
    await client.query('DELETE FROM classification_history WHERE id=$1', [classificationId]);
    await client.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  }
});

test('link reconciliation cannot overwrite a live classification link committed while its update waits', async () => {
  const { taskId, classificationId } = await fixture({ linked: false });
  await client.query(`INSERT INTO classification_queue_decision_witnesses(queue_task_id,classification_id,witness,fingerprint)
    VALUES($1,$2,'{}',$3)`, [taskId, classificationId, 'c'.repeat(64)]);
  await client.query('COMMIT');
  const writer = await getPool().connect(), reader = await getPool().connect();
  let repair;
  try {
    const pid = (await reader.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await writer.query('BEGIN');
    await writer.query('UPDATE classification_intake_receipts SET classification_id=$1 WHERE queue_task_id=$2', [classificationId + 100, taskId]);
    repair = new ClassificationIntakeReceiptRepository({ db: reader }).reconcileClassificationLinks();
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      waiting = (await client.query("SELECT wait_event_type='Lock' AS waiting FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.waiting;
      if (waiting) break;
      await new Promise(resolve => { setTimeout(resolve, 20); });
    }
    expect(waiting).toBe(true);
    await writer.query('COMMIT');
    expect(await repair).toBe(0);
    expect((await receipt(taskId)).classification_id).toBe(classificationId + 100);
  } finally {
    await writer.query('ROLLBACK');
    if (repair) await repair.catch(() => {});
    writer.release(); reader.release();
    await client.query('DELETE FROM classification_queue_decision_witnesses WHERE queue_task_id=$1', [taskId]);
    await client.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId]);
    await client.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
    await client.query('DELETE FROM classification_history WHERE id=$1', [classificationId]);
    await client.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  }
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

async function fixture({ mediaType = 'movie', captureChange = {}, linked = true } = {}) {
  const capture = { ...buildClassificationDestinationDecision({ metadata: { media_type: mediaType, tmdb_id: 42 },
    method: 'ai_analysis', status: 'completed', libraryId }), ...captureChange };
  const classificationId = (await client.query(`INSERT INTO classification_history
    (tmdb_id,media_type,title,method,status,library_id,metadata)
    VALUES(42,$1,'Recovery synthetic item','ai_analysis','completed',$2,$3) RETURNING id`,
  [mediaType, libraryId, { classification_details: { destination_decision: capture } }])).rows[0].id;
  const taskId = (await client.query(`INSERT INTO task_queue(task_type,payload,priority,source,max_attempts)
    VALUES('classification','{}',0,'manual',5) RETURNING id`)).rows[0].id;
  const repository = new ClassificationIntakeReceiptRepository({ db: client });
  await repository.upsert([taskId, 0, linked ? classificationId : null, null, null, null, null]);
  return { taskId, classificationId, capture, repository };
}
async function receipt(taskId) {
  return (await client.query('SELECT * FROM classification_intake_receipts WHERE queue_task_id=$1', [taskId])).rows[0];
}

test('maintenance repairs an interrupted intake capture from its exact original, without replaying classification', async () => {
  const { taskId, classificationId, capture } = await fixture({ linked: false });
  await client.query(`INSERT INTO classification_queue_decision_witnesses(queue_task_id,classification_id,witness,fingerprint)
    VALUES($1,$2,'{}',$3)`, [taskId, classificationId, 'a'.repeat(64)]);
  const before = await receipt(taskId);
  const service = new ClassificationIntakeReceiptService({ db: client });
  await service.reconcileAndPrune();
  const saved = await receipt(taskId);
  expect(saved.decision_context).toEqual({ classificationId, capture });
  expect(saved.queued_at).toEqual(before.queued_at);
  expect(saved.status_id).toBe(before.status_id);
  await service.reconcileAndPrune();
  expect(await receipt(taskId)).toEqual(saved);
});
