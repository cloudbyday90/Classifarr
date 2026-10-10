/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { QueueTaskAcknowledgementService } from '../../services/queueTaskAcknowledgementService.mjs';

let pool, ids;
const migration = await readFile(new URL('../../../../database/migrations/20261010_140000_classification_metadata_failure_context.sql', import.meta.url), 'utf8');
beforeEach(() => { pool = getPool(); ids = []; });
afterEach(async () => {
  await pool.query('DELETE FROM classification_intake_receipts WHERE queue_task_id=ANY($1::bigint[])', [ids]);
  await pool.query('DELETE FROM task_queue WHERE id=ANY($1::bigint[])', [ids]);
});
async function insert(overrides = {}) {
  const row = { status: 'failed', task_type: 'classification', current_stage: 'metadata_fetch',
    error_message: 'task_processing_failed', claim_token: null, routing_classification_id: null, ...overrides };
  const result = await pool.query(`INSERT INTO task_queue(task_type,payload,status,current_stage,error_message,
    claim_token,routing_classification_id,attempts,max_attempts,completed_at)
    VALUES ($1,'{"tmdb_id":42,"media_type":"movie"}',$2,$3,$4,$5,$6,1,5,NOW()) RETURNING *`,
  [row.task_type, row.status, row.current_stage, row.error_message, row.claim_token, row.routing_classification_id]);
  ids.push(result.rows[0].id); return result.rows[0];
}
const read = async id => (await pool.query('SELECT * FROM task_queue WHERE id=$1', [id])).rows[0];

test('upgrade refines only known context, preserves all other columns, and is idempotent', async () => {
  const eligible = await insert();
  await pool.query(`INSERT INTO classification_intake_receipts(queue_task_id,source_class,status_id,queued_at,last_failure_code)
    VALUES ($1,'other','failed',NOW(),'task_processing_failed')`, [eligible.id]);
  const untouched = [];
  for (const overrides of [{ status: 'pending' }, { status: 'processing', claim_token: randomUUID() },
    { status: 'cancelled' }, { status: 'completed' }, { routing_classification_id: 99 },
    { claim_token: randomUUID() }, { task_type: 'metadata_enrichment' }, { current_stage: 'decision' },
    { error_message: 'task_metadata_not_found' }, { error_message: null }]) untouched.push(await insert(overrides));
  await pool.query(migration);
  expect(await read(eligible.id)).toEqual({ ...eligible, error_message: 'task_metadata_fetch_failed' });
  expect((await pool.query('SELECT last_failure_code FROM classification_intake_receipts WHERE queue_task_id=$1', [eligible.id])).rows[0])
    .toEqual({ last_failure_code: 'task_metadata_fetch_failed' });
  for (const row of untouched) expect(await read(row.id)).toEqual(row);
  expect((await pool.query(migration)).rowCount).toBe(0);
});

test.each(['task_metadata_not_found', 'task_metadata_fetch_failed'])('owned %s respects actual attempt counts and stale claims', async reason => {
  const token = randomUUID(), row = await insert({ status: 'processing', claim_token: token });
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const receiptService = { recordTerminal: jest.fn() };
  const service = new QueueTaskAcknowledgementService({ db: pool, logger, receiptService });
  expect(await service.fail(row.id, reason, randomUUID())).toBe(false);
  expect(await read(row.id)).toEqual(row);
  expect(await service.fail(row.id, reason, token)).toBe(true);
  const result = await read(row.id);
  expect(result).toMatchObject({ status: reason === 'task_metadata_not_found' ? 'failed' : 'pending',
    attempts: 2, max_attempts: 5, claim_token: null, error_message: reason, payload: row.payload });
  expect(result.completed_at !== null).toBe(reason === 'task_metadata_not_found');
  expect(await service.fail(row.id, reason, token)).toBe(false);
  expect(await read(row.id)).toEqual(result);
});
