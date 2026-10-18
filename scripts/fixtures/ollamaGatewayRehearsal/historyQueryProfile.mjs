/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import pg from '/app/node_modules/pg/lib/index.js';
import { readArchiveHistory } from '/app/src/ollamaGateway/archiveHistoryReader.mjs';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import { HISTORY_REFERENCE_SQL, HISTORY_REFERENCE_VALUES } from './historyQueryReference.mjs';
import { summarizeHistoryPlan } from './historyPlanSummary.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const client = new pg.Client({ host: '/var/run/postgresql', database: 'gateway_inference_soak', user: 'soak_reader',
  options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 5000, statement_timeout: 60000, query_timeout: 60000 });
client.on('error', () => {});
const types = { getTypeParser(oid, format) { return [114,1114,1184].includes(oid) ? value => value : pg.types.getTypeParser(oid, format); } };
let expired = false, ending, currentDeclaration, expected, stage = 'identity';
const close = () => ending ??= client.end().catch(() => {});
const timer = setTimeout(() => { expired = true; void close(); }, 60000);
const cpu = async pid => {
  try {
    const text = await readResidentText(`/proc/${pid}/stat`), fields = text.slice(text.lastIndexOf(')') + 2).trim().split(/\s+/);
    const ticks = Number(fields[11]) + Number(fields[12]);
    assert.ok(Number.isSafeInteger(ticks) && ticks >= 0 && /^\d+$/.test(fields[19])); return { start: fields[19], ticks };
  } catch { return null; }
};
const query = (text, values) => client.query({ text, values, types });
const current = async () => {
  let raw;
  await readArchiveHistory({ query: async (text, values) => {
    if (currentDeclaration) assert.deepEqual({ text, values }, currentDeclaration);
    else currentDeclaration = { text, values };
    const result = await query(text, values); raw = result.rows; return result;
  } });
  return raw;
};
try {
  await client.connect();
  const identity = (await client.query('SELECT current_user AS role,current_database() AS database,current_setting(\'transaction_read_only\') AS readonly')).rows[0];
  assert.deepEqual(identity, { role: 'soak_reader', database: 'gateway_inference_soak', readonly: 'on' });
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='75s'");
  const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const runs = [], plans = [];
  stage = 'matched_reads';
  for (const reference of [true, false, false, true]) {
    const before = await cpu(pid), started = performance.now();
    const rows = reference ? (await query(HISTORY_REFERENCE_SQL, HISTORY_REFERENCE_VALUES)).rows : await current();
    const queryMs = performance.now() - started, after = await cpu(pid);
    assert.equal(rows.length, 3001); assert.equal(rows[0].history_count, 3001);
    if (expected) assert.deepEqual(rows, expected); else expected = rows;
    runs.push({ mode: reference ? 'reference' : 'current', queryMs,
      backendCpuTicks: before && after?.start === before.start ? after.ticks - before.ticks : null });
  }
  stage = 'plans';
  for (const declaration of [{ mode: 'reference', text: HISTORY_REFERENCE_SQL, values: HISTORY_REFERENCE_VALUES },
    { mode: 'current', ...currentDeclaration }]) {
    const raw = (await query('EXPLAIN (ANALYZE,BUFFERS,SERIALIZE TEXT,TIMING OFF,FORMAT JSON) ' + declaration.text, declaration.values)).rows[0]['QUERY PLAN'];
    plans.push({ mode: declaration.mode, ...summarizeHistoryPlan(raw) });
  }
  stage = 'production_budget';
  await client.query("SAVEPOINT production_budget; SET LOCAL statement_timeout='4s'");
  let productionBudgetPassed = false, budgetQueryMs;
  const started = performance.now();
  try { assert.deepEqual(await current(), expected); budgetQueryMs = performance.now() - started; productionBudgetPassed = true; }
  catch (error) { if (error.code !== '57014') throw error; await client.query('ROLLBACK TO SAVEPOINT production_budget'); }
  await client.query('ROLLBACK');
  assert.equal(expired, false);
  console.log(JSON.stringify({ fixture: 'history-query-profile', diagnosticOnly: true, diagnosticDeadlineMs: 60000,
    equivalent: true, rows: expected.length, historyBytes: expected[0].history_bytes,
    sha256: createHash('sha256').update(JSON.stringify(expected)).digest('hex'), runs, plans,
    productionBudgetPassed, ...(productionBudgetPassed ? { budgetQueryMs } : {}) }));
  assert.equal(productionBudgetPassed, true);
} catch (error) {
  console.log(JSON.stringify({ fixture: 'history-query-profile-failed', stage,
    reason: expired ? 'diagnostic_deadline' : error.message === 'history_plan_invalid' ? 'plan_invalid' : 'profile_or_production_budget_failed',
    sqlstate: ['57014','42501','53200','53300','53400'].includes(error.code) ? error.code : null }));
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  if (!ending) { try { await client.query('ROLLBACK'); } catch { /* Closing the private read-only session is mandatory. */ } }
  await close();
}
