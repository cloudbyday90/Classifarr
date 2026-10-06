/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { createComparisonStudyLoad } from '../../scripts/comparisonMemoryStudy/load.mjs';
import { assertComparisonConcurrentReceipt } from '../../scripts/comparisonMemoryStudy/contract.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';
import { resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
import { observeComparisonStudyAdmission } from '../../scripts/comparisonMemoryStudy/admission.mjs';

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });
function loadFixture() {
  Object.assign(process.env, resourceStudyEnvironment);
  let clock = 0;
  const rows = { inventory: 1600, completed: 1600, pending: 0, failed: 0, routing: 0, handoffs: 0 };
  const db = { query: jest.fn(async () => ({ rows: [{ ...rows }] })) };
  const queue = { processing: 0, startWorker: jest.fn(async () => {}), stopWorker: jest.fn(), refillQueue: jest.fn(async () => {}) };
  const scan = jest.fn(async () => ({ success: true })), grow = jest.fn();
  const options = { seed: jest.fn(async () => [1, 2, 3, 4].map(id => ({ id }))),
    createFixture: () => ({ adapter: {}, provider: {}, grow }), createSync: () => ({ syncLibrary: scan }),
    createQueue: () => queue, createProcessor: () => ({}), now: () => clock,
    wait: async ms => { clock += ms; } };
  return { db, queue, scan, grow, options, rows };
}
test('load is explicit, bounded, non-overlapping and drain requires unique completion', async () => {
  const f = loadFixture(), load = await createComparisonStudyLoad(f.db, {}, f.options);
  expect(f.db.query).toHaveBeenCalledWith("INSERT INTO omdb_config(api_key,is_active,daily_limit) VALUES ('synthetic-only',true,10000)");
  expect(f.scan).not.toHaveBeenCalled(); load.start(); load.start();
  expect(await load.drain()).toMatchObject({ waves: 20, inventory: 1600, completed: 1600, pending: 0 });
  await load.close();
  expect(f.grow).toHaveBeenCalledTimes(20); expect(f.queue.startWorker).toHaveBeenCalledTimes(1);
  expect(f.scan).toHaveBeenCalledTimes(84); expect(f.queue.stopWorker).toHaveBeenCalledTimes(1);
});
test.each(['failed', 'routing', 'pending', 'handoffs', 'completed'])('invalid drain state %s cannot pass', async key => {
  const f = loadFixture(); f.rows[key] = key === 'completed' ? 1599 : 1;
  const load = await createComparisonStudyLoad(f.db, {}, f.options); load.start();
  await expect(load.drain()).rejects.toThrow(); await load.close();
});
test('scan failure joins the other admitted scan before stopping its consumer', async () => {
  const f = loadFixture(); let finish;
  f.scan.mockImplementationOnce(async () => { throw new Error('synthetic_scan_failure'); })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const load = await createComparisonStudyLoad(f.db, {}, f.options); load.start();
  const closing = load.close();
  await Promise.resolve(); expect(f.queue.stopWorker).not.toHaveBeenCalled();
  finish({ success: true }); await expect(closing).rejects.toThrow('synthetic_scan_failure');
  expect(f.queue.stopWorker).toHaveBeenCalledTimes(1);
});
test('ordinary environment cannot seed or launch services', async () => {
  const f = loadFixture(); process.env.CLASSIFARR_RESOURCE_STUDY = '0';
  await expect(createComparisonStudyLoad(f.db, {}, f.options)).rejects.toThrow();
  expect(f.options.seed).not.toHaveBeenCalled(); expect(f.queue.startWorker).not.toHaveBeenCalled();
  expect(f.db.query).not.toHaveBeenCalled();
});
function receipt(profile = 'comparison-concurrent') {
  const initial = resourceStudyStartupFixture('bounded').metrics;
  return { version: 'comparison_concurrent.v1', status: 'measured', profile, budget: 'bounded', durationMs: 1_000_000,
    initial, final: { ...initial }, refresh: { cycles: Array.from({ length: 3 }, () => ({ comparison: 'ready' })), reads: 12, builds: 2 },
    measurement: { createdWorkers: 4, exitedWorkers: 4, activeWorkers: 0 },
    admission: { ingestion: { active: 0 }, queue: { active: 0 }, discovery: { active: 0 } },
    overlap: profile === 'comparison-control' ? { ingestion: 0, queue: 0 } : { ingestion: 2, queue: 4 },
    work: profile === 'comparison-control' ? null : { waves: 20, inventory: 1600, completed: 1600, pending: 0, failed: 0, routing: 0, handoffs: 0, serviceErrors: 0 },
    idle: Array.from({ length: 10 }, (_, i) => ({ elapsedMs: 700_000 + i * 30_000, heapUsed: 100, rss: 200, containerBytes: 300 })) };
}
test.each(['comparison-control', 'comparison-concurrent'])('receipt and summary preserve scope (%s)', profile => {
  const study = receipt(profile); expect(() => assertComparisonConcurrentReceipt(study, 'bounded')).not.toThrow();
  const result = { mode: profile, budget: 'bounded', study, cleanup: 'passed' };
  expect(formatResourceStudySummary(result)).toContain('separate synthetic fixture');
  expect(() => formatResourceStudySummary({ ...result, cleanup: 'failed' })).toThrow();
});
test.each([
  s => { s.durationMs = 899_999; }, s => { s.final.oomKill = 1; }, s => { s.final.memoryLimitHits = 1; },
  s => { s.work.completed--; }, s => { s.work.handoffs = 1; }, s => { s.overlap.queue = 0; },
  s => { s.measurement.activeWorkers = 1; }, s => { s.measurement.exitedWorkers--; },
  s => { s.admission.ingestion.active = 1; }, s => { s.idle.pop(); },
  s => { s.idle[0].rss = NaN; }, s => { s.idle[1].elapsedMs = s.idle[0].elapsedMs; },
  s => { s.refresh.cycles.at(-1).comparison = 'deferred'; },
])('incomplete evidence is rejected (%#)', change => {
  const study = receipt(); change(study); expect(() => assertComparisonConcurrentReceipt(study, 'bounded')).toThrow();
});
test('admission observer preserves denials and counts only actual permitted overlap', () => {
  const release = jest.fn(); let allowed = true;
  const admission = observeComparisonStudyAdmission({ tryAcquire: () => allowed
    ? { allowed: true, release } : { allowed: false, reason: 'memory_pressure' } });
  const first = admission.tryAcquire('ingestion'); expect(admission.overlap.ingestion).toBe(0); first.release();
  const discovery = admission.tryAcquire('discovery'), ingest = admission.tryAcquire('ingestion');
  allowed = false; admission.tryAcquire('queue'); expect(admission.overlap.queue).toBe(0);
  allowed = true; const queue = admission.tryAcquire('queue');
  ingest.release(); ingest.release(); queue.release(); discovery.release();
  expect(admission.overlap).toEqual({ ingestion: 1, queue: 1 });
  expect(admission.classes.queue).toMatchObject({ allowed: 1, memory_pressure: 1, active: 0 });
  expect(release).toHaveBeenCalledTimes(4);
});
test.each(['comparison-control', 'comparison-concurrent'])('launcher keeps one immutable image and cleans owned resources (%s)', async mode => {
  const imageId = `sha256:${'a'.repeat(64)}`, save = jest.fn();
  const run = jest.fn((_command, args) => {
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = imageId;
    if (args[0] === 'inspect') stdout = args[2].includes('HostConfig')
      ? JSON.stringify({ nanoCpus: 2e9, pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0, imageId }) : 'false healthy';
    if (args[0] === 'compose' && args.includes('ps')) stdout = 'b'.repeat(64);
    if (args.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"status":"passed"}';
    if (args.includes('src/scripts/runResourceStudy.mjs')) {
      const action = args.at(-1);
      stdout = `RESOURCE_STUDY ${JSON.stringify(action === 'seed' ? { seeded: true }
        : action.startsWith('budget-') ? resourceStudyStartupFixture('bounded') : receipt(mode))}`;
    }
    return { status: 0, stdout, stderr: '' };
  });
  await expect(runResourceStudyCompose({ mode, budget: 'bounded', candidateImageId: imageId,
    run, save, report: () => {}, random: size => Buffer.alloc(size, 3) })).resolves.toMatchObject({ cleanup: 'passed', imageId });
  expect(run.mock.calls.some(([, args]) => args.includes('build'))).toBe(false);
  expect(run.mock.calls.some(([, args]) => args.includes('down') && args.includes('--volumes'))).toBe(true);
  expect(save).toHaveBeenCalledTimes(1);
});
