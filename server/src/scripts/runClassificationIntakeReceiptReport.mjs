/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL,
  CLASSIFICATION_INTAKE_RECEIPT_GROUPS_SQL,
  CLASSIFICATION_INTAKE_WEBHOOK_GROUPS_SQL,
  CLASSIFICATION_INTAKE_RECEIPT_BY_TASK_SQL,
} from '../services/classificationIntakeReceiptReadRepository.mjs';

const DAY_MS = 86_400_000;

async function loadRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  const db = await import('../config/database.mjs');
  return { withTransaction: db.withTransaction, close: () => db.pool.end() };
}

/** Local-only, read-only ID/code diagnostic; never fetches payload or media columns. */
export async function runClassificationIntakeReceiptReport({
  argv = process.argv.slice(2), load = loadRuntime, now = Date.now(),
} = {}) {
  const { values } = parseArgs({ args: argv, options: {
    since: { type: 'string' }, until: { type: 'string' }, limit: { type: 'string' },
    'task-id': { type: 'string' },
  } });
  const taskId = values['task-id'];
  if (taskId !== undefined && (values.since !== undefined || values.until !== undefined || values.limit !== undefined ||
      !/^[1-9][0-9]{0,18}$/.test(taskId) || BigInt(taskId) > 9223372036854775807n)) {
    throw new Error('classification_intake_report_task_id');
  }
  const limit = values.limit === undefined ? 100 : Number(values.limit);
  const until = values.until === undefined ? now : Date.parse(values.until);
  const since = values.since === undefined ? until - 7 * DAY_MS : Date.parse(values.since);
  if (taskId === undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isFinite(since) || !Number.isFinite(until) || since >= until ||
      until > now || until - since > 31 * DAY_MS)) {
    throw new Error('classification_intake_report_window');
  }
  const runtime = await load();
  try {
    return await runtime.withTransaction(async client => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '15s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
      if (taskId !== undefined) {
        const { rows } = await client.query(CLASSIFICATION_INTAKE_RECEIPT_BY_TASK_SQL, [taskId]);
        return { version: 'classification_intake_receipts_v1', task: rows[0] ?? null };
      }
      const window = [new Date(since).toISOString(), new Date(until).toISOString()];
      const groups = (await client.query(CLASSIFICATION_INTAKE_RECEIPT_GROUPS_SQL, window)).rows;
      const webhookGroups = (await client.query(CLASSIFICATION_INTAKE_WEBHOOK_GROUPS_SQL, window)).rows;
      const rows = (await client.query(CLASSIFICATION_INTAKE_RECEIPT_ROWS_SQL, [...window, limit + 1])).rows;
      return { version: 'classification_intake_receipts_v1',
        window: { since: window[0], until: window[1] },
        webhookGroups, receiptGroups: groups, receipts: rows.slice(0, limit),
        truncated: rows.length > limit,
        notes: ['webhook_groups_are_separate_population', 'missing_receipt_is_not_evidence_of_no_request'],
      };
    });
  } finally { await runtime.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runClassificationIntakeReceiptReport().then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(() => { process.stderr.write('classification_intake_receipt_report_failed\n'); process.exitCode = 1; });
}
