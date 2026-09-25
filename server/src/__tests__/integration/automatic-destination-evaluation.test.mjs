/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createAutomaticDestinationEvaluation, AUTOMATIC_DESTINATION_EVALUATION_LOCK } from '../../services/automaticDestinationEvaluation.mjs';
import { createAutomaticDestinationEvaluationRepository, readAutomaticDestinationEvaluationStatus } from '../../services/automaticDestinationEvaluationRepository.mjs';
import { CORRECTION_DESTINATION_DECISION_SQL } from '../../services/destinationOutcomeEvaluationRepository.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { buildFeedbackOutcomeSnapshot } from '../../services/feedbackOutcomeSnapshot.mjs';

let db, repository, worker, libraries;
beforeEach(async () => {
  db = createIntegrationDatabaseModuleMock();
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Private movie library','auto-eval-movie','movie'),('Private TV library','auto-eval-tv','tv') RETURNING id`)).rows.map(row => row.id);
  repository = createAutomaticDestinationEvaluationRepository(db);
  worker = createAutomaticDestinationEvaluation({ repository, withSessionAdvisoryLock: db.withSessionAdvisoryLock });
});
afterEach(async () => {
  worker.stop();
  // This suite owns a disposable database, not the user's application database.
  await db.query('DELETE FROM automatic_destination_evaluation WHERE singleton=true');
  await db.query('DELETE FROM classification_intake_receipts WHERE queue_task_id BETWEEN 910000 AND 920000');
  await db.query('DELETE FROM policy_feedback_sources WHERE classification_id BETWEEN 910000 AND 920000');
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});
const status = () => readAutomaticDestinationEvaluationStatus(getPool());
const stored = async () => (await db.query('SELECT * FROM automatic_destination_evaluation')).rows[0];
async function due() {
  await db.query(`UPDATE automatic_destination_evaluation SET observed_at=NOW()-INTERVAL '10 minutes',
    evaluated_at=CASE WHEN evaluated_at IS NULL THEN NULL ELSE LEAST(evaluated_at,NOW()-INTERVAL '10 minutes') END,
    next_check_at=NOW()-INTERVAL '1 minute' WHERE singleton=true`);
}
async function seed(id = 910001, mediaType = 'movie', decisionStatus = 'completed') {
  const libraryId = libraries[mediaType === 'tv' ? 1 : 0];
  const capture = buildClassificationDestinationDecision({ metadata: { media_type: mediaType, tmdb_id: id },
    method: 'ai_analysis', status: decisionStatus, libraryId: decisionStatus === 'completed' ? libraryId : null });
  const context = { classificationId: id, capture };
  await db.query(`INSERT INTO classification_correction_outcomes
    (correction_id,media_type,identity_key,selected_library_id,decision_context) VALUES($1,$2,$3,$4,$5)`,
  [id, mediaType, `${mediaType}:${id}`, libraryId, context]);
  await db.query(`INSERT INTO classification_intake_receipts(queue_task_id,classification_id,source_class,status_id,queued_at,decision_context)
    VALUES($1::integer,$1::integer,'webhook','completed',NOW(),$2)`, [id, context]);
  return { id, libraryId, context };
}

test('automatically evaluates movie/TV feedback without altering source records, then coalesces and resumes on restart', async () => {
  await seed(); await seed(910002, 'tv');
  const before = (await db.query('SELECT * FROM classification_correction_outcomes ORDER BY correction_id')).rows;
  expect((await status()).status).toBe('never_run');
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect(await status()).toMatchObject({ status: 'complete', report: { overall: { completedAgreement: 2 },
    byMediaType: { movie: { completedAgreement: 1 }, tv: { completedAgreement: 1 } },
    intake: { overall: { labelCoverageRate: 1 } }, providerCalls: 0, promotionAllowed: false } });
  expect(await worker.run()).toEqual({ status: 'cooldown' });
  await due(); const old = await stored();
  worker = createAutomaticDestinationEvaluation({ repository, withSessionAdvisoryLock: db.withSessionAdvisoryLock });
  expect(await worker.run()).toEqual({ status: 'unchanged' });
  const fresh = await stored();
  expect(fresh.evaluated_at).toEqual(old.evaluated_at);
  expect(fresh.observed_at.getTime()).toBeGreaterThan(old.observed_at.getTime());
  expect((await db.query('SELECT * FROM classification_correction_outcomes ORDER BY correction_id')).rows).toEqual(before);
  expect(JSON.stringify(await status())).not.toMatch(/Private|910001|910002|input_fingerprint/);
});

test.each(['feedback', 'repair', 'queue', 'destination', 'expiry'])('%s change triggers evaluation without an explicit event hook', async change => {
  await seed(); await worker.run(); const before = await stored(); await due();
  if (change === 'feedback') await seed(910002, 'tv');
  if (change === 'repair') await db.query('UPDATE classification_intake_receipts SET decision_context=NULL WHERE queue_task_id=910001');
  if (change === 'queue') await db.query("UPDATE classification_intake_receipts SET status_id='retry_scheduled' WHERE queue_task_id=910001");
  if (change === 'destination') await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0]]);
  if (change === 'expiry') await db.query("UPDATE classification_correction_outcomes SET observed_at=NOW()-INTERVAL '31 days' WHERE correction_id=910001");
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect((await stored()).input_fingerprint).not.toBe(before.input_fingerprint);
  if (change === 'expiry') expect((await status()).report).toMatchObject({ overall: { completedDecisions: 0 }, intake: { overall: { withoutOutcome: 1 } } });
});

test('review and retry decisions stay separate from completed agreement and music cannot supply a valid label', async () => {
  await seed(910001, 'movie', 'awaiting_decision'); await seed(910002, 'tv', 'pending_retry');
  await worker.run();
  expect((await status()).report.overall).toMatchObject({ awaitingDecision: 1, pendingRetry: 1, completedDecisions: 0, labeledCohortAgreementRate: null });
  await expect(db.query(`INSERT INTO classification_correction_outcomes(correction_id,media_type,identity_key,selected_library_id)
    VALUES(910003,'music','music:42',$1)`, [libraries[0]])).rejects.toMatchObject({ code: '23514' });
});

test('bounded overflow fails without publishing a partial report and heals once eligible evidence is within budget', async () => {
  await db.query(`INSERT INTO classification_intake_receipts(queue_task_id,source_class,status_id,queued_at)
    SELECT id,'webhook','completed',NOW() FROM generate_series(910000,915000) id`);
  expect(await worker.run()).toEqual({ status: 'failed', reason: 'evidence_budget' });
  expect(await status()).toMatchObject({ status: 'failed', failure_code: 'evidence_budget', report: null });
  await db.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=915000'); await due();
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect((await status()).report.intake.queueTasks).toBe(5000);
});

test('invalid feedback invalidates previous results; durable exponential retry survives restart and repairs cleanly', async () => {
  await seed(); await worker.run(); await due();
  await db.query(`INSERT INTO policy_feedback_sources(classification_id,intake,request_fingerprint,outcome_snapshot)
    VALUES(910004,'standalone',repeat('a',64),'{"private":"do not expose"}')`);
  for (const delayMinutes of [5, 10, 20, 40, 60, 60]) {
    worker = createAutomaticDestinationEvaluation({ repository, withSessionAdvisoryLock: db.withSessionAdvisoryLock });
    expect(await worker.run()).toEqual({ status: 'failed', reason: 'invalid_feedback' });
    const row = await stored();
    expect(row.report).toBeNull(); expect(row.input_fingerprint).toBeNull();
    expect((row.next_check_at - row.observed_at) / 60000).toBeCloseTo(delayMinutes);
    expect(await worker.run()).toEqual({ status: 'cooldown' });
    await due();
  }
  await db.query('DELETE FROM policy_feedback_sources WHERE classification_id=910004');
  expect(await worker.run()).toEqual({ status: 'evaluated' });
  expect((await stored()).failure_count).toBe(0);
  expect(JSON.stringify(await status())).not.toContain('do not expose');
});

test('readers withhold old, future or malformed reports; missing migration fails safely before reading evidence', async () => {
  await seed(); await worker.run();
  await db.query(`UPDATE automatic_destination_evaluation SET observed_at=NOW()-INTERVAL '16 minutes',
    evaluated_at=NOW()-INTERVAL '16 minutes' WHERE singleton=true`);
  expect(await status()).toMatchObject({ status: 'stale', report: null });
  await due(); await worker.run();
  await db.query("UPDATE automatic_destination_evaluation SET observed_at=NOW()+INTERVAL '1 hour', next_check_at=NOW()+INTERVAL '2 hours' WHERE singleton=true");
  expect(await status()).toMatchObject({ status: 'stale', report: null });
  expect(await worker.run()).toEqual({ status: 'unchanged' });
  await db.query("UPDATE automatic_destination_evaluation SET report='{}' WHERE singleton=true");
  expect(await status()).toMatchObject({ status: 'invalid', report: null });
  await due(); expect(await worker.run()).toEqual({ status: 'evaluated' });
  await db.query('ALTER TABLE automatic_destination_evaluation RENAME TO automatic_evaluation_hidden');
  try { expect(await worker.run()).toEqual({ status: 'failed', reason: 'evaluation_unavailable' }); }
  finally { await db.query('ALTER TABLE automatic_evaluation_hidden RENAME TO automatic_destination_evaluation'); }
});

test('other workers skip a held database lock and recover after its session ends', async () => {
  const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [AUTOMATIC_DESTINATION_EVALUATION_LOCK]);
    expect(await worker.run()).toEqual({ status: 'busy' });
    expect((await status()).status).toBe('never_run');
  } finally { client.release(true); }
  expect(await worker.run()).toEqual({ status: 'evaluated' });
});

test('older publication cannot overwrite a newer observed checkpoint', async () => {
  await seed(); await worker.run(); const row = await stored();
  expect(await repository.save('b'.repeat(64), row.report, new Date(row.observed_at.getTime() - 60_000))).toBe(false);
  expect(await stored()).toEqual(row);
});

test('snapshot reads use repeatable read/read-only and cannot mix an intervening destination change', async () => {
  const { id, context, libraryId } = await seed();
  const feedback = buildFeedbackOutcomeSnapshot({ id, media_type: 'movie', tmdb_id: id, method: 'ai_analysis',
    metadata: { classification_details: { destination_decision: context.capture } } }, libraryId);
  await db.query(`INSERT INTO policy_feedback_sources(classification_id,intake,request_fingerprint,outcome_snapshot)
    VALUES($1,'standalone',repeat('a',64),$2)`, [id, feedback]);
  const observer = createAutomaticDestinationEvaluationRepository({ withTransaction: callback => db.withTransaction(client => callback({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      if (sql === CORRECTION_DESTINATION_DECISION_SQL) {
        expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('on');
        expect((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation).toBe('repeatable read');
        await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
        await expect(client.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId])).rejects.toMatchObject({ code: '25006' });
        // Failed write aborts the test transaction; restore it without compromising the real read test below.
      }
      return result;
    },
  })) });
  await expect(observer.readSnapshot()).rejects.toMatchObject({ code: '25P02' });
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  const coherent = createAutomaticDestinationEvaluationRepository({ withTransaction: callback => db.withTransaction(client => callback({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      if (sql === CORRECTION_DESTINATION_DECISION_SQL) await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
      return result;
    },
  })) });
  const snapshot = await coherent.readSnapshot();
  expect(snapshot.inputs.rows.map(row => row.target_available)).toEqual([true, true]);
  expect((await repository.readSnapshot()).inputs.rows.map(row => row.target_available)).toEqual([false, false]);
});

test('migration is idempotent and checkpoint guards reject unbounded data and invalid state', async () => {
  await db.query(readFileSync(new URL('../../../../database/migrations/20260925_002500_add_automatic_destination_evaluation.sql', import.meta.url), 'utf8'));
  await worker.run();
  for (const sql of ["UPDATE automatic_destination_evaluation SET singleton=false", "UPDATE automatic_destination_evaluation SET report='[]'",
    "UPDATE automatic_destination_evaluation SET failure_count=99", "UPDATE automatic_destination_evaluation SET failure_code='private'",
    "UPDATE automatic_destination_evaluation SET input_fingerprint='bad'", "UPDATE automatic_destination_evaluation SET report=NULL",
    "UPDATE automatic_destination_evaluation SET report=jsonb_build_object('large',repeat('x',17000))"]) {
    await expect(db.query(sql)).rejects.toMatchObject({ code: '23514' });
  }
});

test('existing private CLI reads the automated checkpoint without models or writes', async () => {
  await worker.run();
  const options = getPool().options;
  const { stdout, stderr } = await promisify(execFile)(process.execPath,
    [fileURLToPath(new URL('../../scripts/runOperatorCorrectionPolicyEvaluation.mjs', import.meta.url)), '--automatic-status'], {
      timeout: 30000, env: { ...process.env, POSTGRES_HOST: options.host, POSTGRES_PORT: String(options.port),
        POSTGRES_DB: options.database, POSTGRES_USER: options.user, POSTGRES_PASSWORD: options.password },
    });
  expect(JSON.parse(stdout)).toMatchObject({ status: 'complete', providerCalls: 0, routingWrites: 0, report: { status: 'no_eligible_outcomes' } });
  expect(stderr).toBe('');
});
