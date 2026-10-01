/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
import { resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { assertStudyCgroup } from '../../scripts/resourceStudyMetrics.mjs';

const metrics = resourceStudyStartupFixture().metrics;
let sample, invalid, incomplete, currentTask, acknowledged, rows, nextId, connectionCount;
const createStudySampler = jest.fn(async () => sample);
const readStudyCgroup = jest.fn(async () => metrics);
jest.unstable_mockModule('../../scripts/resourceStudyMetrics.mjs', () => ({ assertStudyCgroup, createStudySampler, readStudyCgroup }));
const inspectImageIndexes = jest.fn(async () => Array.from({ length: 3 }, (_, index) => ({
  action: invalid && index === 0 ? 'repair' : incomplete ? 'create' : 'preserve',
})));
jest.unstable_mockModule('../../services/imageIndexMaintenanceCatalog.mjs', () => ({ inspectImageIndexes }));
const awaitStudyIndexIdle = jest.fn();
const executeStudyImageWorker = jest.fn(async ({ task, phase, interrupt }) => {
  await sample.sample(phase, { indexPhase: 'building', wait: 'none', workerBytes: null, postgresBytes: null });
  if (interrupt) { invalid = true; return { interrupted: true, signal: 'SIGTERM' }; }
  if (task.claim_token !== currentTask.claim_token) return { exitCode: 75 };
  invalid = false; acknowledged = !incomplete;
  return { exitCode: incomplete ? 1 : 0, signal: null, watchdog: false, durationMs: 1, interrupted: false };
});
jest.unstable_mockModule('../../scripts/imageIndexStudyWorker.mjs', () => ({ awaitStudyIndexIdle, executeStudyImageWorker }));
const { runImageIndexStudy } = await import('../../scripts/imageIndexStudyWorkload.mjs');

let environment, db, query, release;
beforeEach(() => {
  environment = process.env; process.env = { ...environment, ...resourceStudyEnvironment };
  invalid = incomplete = acknowledged = false; rows = nextId = connectionCount = 0;
  sample = { samples: [], initial: metrics, close: jest.fn(), sample: jest.fn(async (phase, extra) => {
    sample.samples.push({ phase, containerBytes: 1000, rssBytes: 500, containerCores: 0.5, ...extra });
  }) };
  query = jest.fn(async sql => {
    if (sql.includes('SELECT gate_state')) return { rows: [{ gate_state: 'ready' }] };
    if (sql.includes('identity_sum')) return { rows: [{ rows, vectors: rows, history: rows, identity_sum: String(rows) }] };
    if (sql.includes('SELECT count(*)::integer n')) return { rows: [{ n: 0 }] };
    if (sql.includes('WITH inserted')) rows += 100;
    if (sql.includes('INSERT INTO task_queue')) {
      currentTask = { id: String(++nextId), claim_token: 'before' }; return { rows: [currentTask] };
    }
    if (sql.includes('SET claim_token=gen_random_uuid')) {
      currentTask = { ...currentTask, claim_token: 'after' }; return { rows: [currentTask] };
    }
    if (sql.includes('SELECT status,claim_token')) return { rows: [{ status: acknowledged ? 'completed' : 'processing', claim_token: acknowledged ? null : currentTask.claim_token }] };
    return { rows: [] };
  });
  release = jest.fn(); db = { pool: { connect: jest.fn(async () => { connectionCount++; return { query, release }; }) } };
});
afterEach(() => { process.env = environment; jest.clearAllMocks(); });

test('all fixed sizes, recovery verification and resource lifetimes compose', async () => {
  const progress = jest.fn(); const receipt = await runImageIndexStudy(db, 'baseline', progress);
  expect(receipt.cases).toHaveLength(4); expect(rows).toBe(50000);
  expect(receipt.cases.every(row => row.outcome === 'complete')).toBe(true);
  expect(progress).toHaveBeenCalledTimes(4);
  expect(connectionCount).toBe(2); expect(release).toHaveBeenCalledTimes(2); expect(sample.close).toHaveBeenCalled();
  expect(executeStudyImageWorker).toHaveBeenCalledTimes(6);
});
test('incomplete worker is measured and only its synthetic claim is retired', async () => {
  incomplete = true;
  const receipt = await runImageIndexStudy(db);
  expect(receipt.cases.every(row => row.outcome === 'incomplete')).toBe(true);
  const retirements = query.mock.calls.filter(([sql]) => sql.includes("SET status='failed'"));
  expect(retirements).toHaveLength(4);
  expect(retirements[1][1]).toEqual(['2', 'after']);
});
test('environment refusal happens before opening a database connection', async () => {
  delete process.env.CLASSIFARR_RESOURCE_STUDY;
  await expect(runImageIndexStudy(db)).rejects.toThrow(); expect(db.pool.connect).not.toHaveBeenCalled();
});
test('unknown restore state refuses the study and releases the session', async () => {
  query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ gate_state: 'requires_maintenance' }] });
  await expect(runImageIndexStudy(db)).rejects.toThrow(); expect(release).toHaveBeenCalledWith(true);
  expect(createStudySampler).not.toHaveBeenCalled();
});
test('worker failure releases writer, observer and sampler', async () => {
  executeStudyImageWorker.mockRejectedValueOnce(new Error('worker_failed'));
  await expect(runImageIndexStudy(db)).rejects.toThrow('worker_failed');
  expect(release).toHaveBeenCalledWith(true); expect(sample.close).toHaveBeenCalled();
});
