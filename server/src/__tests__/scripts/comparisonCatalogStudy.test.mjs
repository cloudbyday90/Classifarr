/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest, afterEach } from '@jest/globals';
import { createComparisonCatalogFixture } from '../../scripts/comparisonMemoryStudy/catalogFixture.mjs';
import { comparisonCatalogCompletion, assertComparisonCatalogReceipt } from '../../scripts/comparisonMemoryStudy/catalogContract.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
import { resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';
import { collectComparisonStudyTrace } from '../../../../scripts/lib/comparisonStudyTrace.mjs';

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });
function databaseFixture() {
  Object.assign(process.env, resourceStudyEnvironment);
  const state = { busy: true, rag_enabled: true, primary_provider: 'ollama', embedding_provider_mode: 'same',
    embedding_model: 'study', ollama_host: 'localhost' };
  const present = new Set(), counts = { libraries: 0, servers: 0, items: 0 };
  let id = 0;
  const query = jest.fn(async (sql, args) => {
    if (sql.includes('AS libraries,')) return { rows: [counts] };
    if (sql.includes('INSERT INTO media_server(')) return { rows: [{ id: 1 }] };
    if (sql.includes('INSERT INTO libraries(')) return { rows: [{ id: ++id, external_id: args[1], media_type: args[2] }] };
    if (sql.includes('FROM ai_provider_config')) return { rows: [state] };
    if (sql.includes('SELECT description_hash FROM inventory_description_vector_cache')) return { rows: [...present].map(description_hash => ({ description_hash })) };
    if (sql.includes('INSERT INTO inventory_description_vector_cache')) {
      for (const entry of JSON.parse(args[4])) present.add(entry.hash);
    }
    if (sql.includes('FROM media_server_items msi')) return { rows: Array.from({ length: 17 }, (_, i) => ({
      media_type: 'movie', tmdb_id: i + 1, library_id: 1, overview: `Synthetic ${i}` })) };
    return { rows: [], rowCount: 1 };
  });
  const db = { query, withTransaction: callback => callback({ query }), withSessionAdvisoryLock: jest.fn() };
  return { db, state, present, counts };
}
test('ordinary or nonempty database cannot seed the catalog', async () => {
  const f = databaseFixture(); delete process.env.CLASSIFARR_RESOURCE_STUDY;
  await expect(createComparisonCatalogFixture(f.db)).rejects.toThrow(); expect(f.db.query).not.toHaveBeenCalled();
  Object.assign(process.env, resourceStudyEnvironment); f.counts.items = 1;
  await expect(createComparisonCatalogFixture(f.db)).rejects.toThrow('comparison_catalog_not_empty');
  expect(f.db.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false);
});
test('same database supplies real busy state, bounded pages and finite source growth', async () => {
  const f = databaseFixture(), fixture = await createComparisonCatalogFixture(f.db);
  expect(fixture.database).toBe(f.db); expect(await fixture.readState()).toBe(f.state);
  f.state.busy = false; expect((await fixture.readState()).busy).toBe(false);
  for (let i = 0; i < 20; i++) fixture.transport.grow(20);
  expect(() => fixture.transport.grow(20)).toThrow();
  let total = 0;
  for (const library of fixture.libraries) {
    const page = await fixture.transport.adapter.getLibraryPage('', '', library.external_id, { offset: 0, limit: 100 });
    expect(page.items).toHaveLength(100); expect(page.items[0].media_type).toBe(library.media_type); total += page.total;
  }
  expect(total).toBe(5776);
  await expect(fixture.transport.adapter.getLibraryPage('', '', 'unknown', { offset: 0, limit: 100 })).rejects.toThrow();
  await expect(fixture.transport.adapter.getLibraryPage('', '', 'catalog-0', { offset: 0, limit: 101 })).rejects.toThrow();
});
test('invalid saved embedding configuration fails before launching a disabled measurement', async () => {
  const f = databaseFixture(); f.state.ollama_host = 'http://synthetic.invalid';
  await expect(createComparisonCatalogFixture(f.db)).rejects.toThrow('local_study_endpoint_required');
});
test('vector preparation uses production hashes/cache writes in batches of eight and never rewrites present keys', async () => {
  const f = databaseFixture(), fixture = await createComparisonCatalogFixture(f.db);
  expect(await fixture.cacheDescriptions()).toEqual({ descriptions: 17, cached: 17 });
  expect(await fixture.cacheDescriptions()).toEqual({ descriptions: 17, cached: 17 });
  const writes = f.db.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO inventory_description_vector_cache'));
  expect(writes.map(([, args]) => JSON.parse(args[4]).length)).toEqual([8, 8, 1]);
  expect(JSON.parse(JSON.parse(writes[0][1][4])[0].vector)).toHaveLength(1024);
  expect(f.db.query.mock.calls.some(([sql]) => /(?:INSERT INTO|UPDATE|DELETE FROM) media_server_items/.test(sql))).toBe(false);
});
function receipt() {
  const initial = resourceStudyStartupFixture('bounded').metrics;
  const attempts = [{ worker: 'comparison', attempt: 1, status: 'ready', elapsedMs: 660_000 },
    { worker: 'representative', attempt: 1, status: 'published', elapsedMs: 680_000 },
    { worker: 'comparison', attempt: 2, status: 'revalidated', elapsedMs: 980_000 }];
  return { version: 'comparison_catalog.v1', profile: 'comparison-catalog', budget: 'bounded', status: 'measured',
    durationMs: 990_000, drainedAtMs: 610_000, initial, final: { ...initial }, attempts,
    decisions: attempts.map(row => ({ ...row, elapsedMs: row.elapsedMs - 1, kind: 'discovery', allowed: true,
      availableBytes: 1500 * 1024 ** 2, requiredBytes: 1024 * 1024 ** 2, reserveBytes: 256 * 1024 ** 2,
      reservedBytes: 0, workBytes: 768 * 1024 ** 2, hysteresisBytes: 0 })),
    work: { waves: 20, libraries: 10, owners: 10, inventory: 5776, completed: 5776, pending: 0, failed: 0, routing: 0, handoffs: 0, serviceErrors: 0 },
    coverage: { descriptions: 5776, cached: 5776 }, pressureRecoveryObserved: false,
    measurement: { createdWorkers: 2, exitedWorkers: 2, activeWorkers: 0 },
    admission: { ingestion: { active: 0 }, queue: { active: 0 }, discovery: { active: 0 } }, overlap: { ingestion: 0, queue: 0 } };
}
test('completion requires settled loaded context and later real scheduled revalidation, not invented pressure', () => {
  const s = receipt(); expect(comparisonCatalogCompletion(s.attempts, null)).toBe(false);
  expect(() => assertComparisonCatalogReceipt(s, 'bounded')).not.toThrow();
  expect(formatResourceStudySummary({ mode: s.profile, budget: s.budget, cleanup: 'passed', study: s })).toContain('not proven');
  s.attempts[0].status = 'revalidated'; expect(comparisonCatalogCompletion(s.attempts, s.drainedAtMs)).toBe(true);
});
test.each([
  s => { s.work.completed--; }, s => { s.work.owners--; }, s => { s.work.handoffs++; },
  s => { s.work.pending++; }, s => { s.coverage.cached--; }, s => { s.pressureRecoveryObserved = true; },
  s => { s.final.oomKill++; }, s => { s.measurement.activeWorkers++; }, s => { s.admission.queue.active++; },
  s => { s.drainedAtMs = 670_000; }, s => { s.attempts[2].elapsedMs = 800_000; },
  s => { s.attempts[1].status = 'yielded'; }, s => { s.decisions[0].allowed = false; },
  s => { s.decisions[0].requiredBytes--; },
])('rejects incomplete or contradictory catalog evidence (%#)', change => {
  const s = receipt(); change(s); expect(() => assertComparisonCatalogReceipt(s, 'bounded')).toThrow();
});
test.each([
  { failed: false, traceGc: false }, { failed: true, traceGc: false },
  { failed: false, traceGc: true }, { failed: true, traceGc: true },
  { failed: false, traceGc: true, missingGc: true },
])('launcher preserves immutable image, scoped tracing and owned cleanup (%j)', async ({ failed, traceGc, missingGc }) => {
  const imageId = `sha256:${'a'.repeat(64)}`, save = jest.fn(), saveTrace = jest.fn(), saveGcTrace = jest.fn();
  const run = jest.fn((_command, args) => {
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = imageId;
    if (args[0] === 'inspect') stdout = args[2].includes('HostConfig')
      ? JSON.stringify({ nanoCpus: 2e9, pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0, imageId }) : 'false healthy';
    if (args[0] === 'compose' && args.includes('ps')) stdout = 'b'.repeat(64);
    if (args.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"status":"passed"}';
    if (args.includes('src/scripts/runResourceStudy.mjs')) {
      const action = args.at(-1);
      if (action === 'comparison-catalog') return { status: failed ? 1 : 0, stderr: '',
        stdout: (traceGc && !missingGc ? '[123:0xabcdef] 100 ms: Mark-Compact 50.0 (60.0) -> 20.0 (30.0) MB, pooled: 20 MB, 1.00 / 0.00 ms private\n' : '') +
          'STUDY_PROGRESS {"phase":"catalog_drained","inventory":5776,"secret":"private"}\n' +
          `RESOURCE_STUDY ${JSON.stringify(receipt())}` };
      stdout = `RESOURCE_STUDY ${JSON.stringify(action === 'seed' ? { seeded: true } : resourceStudyStartupFixture('bounded'))}`;
    }
    return { status: 0, stdout, stderr: '' };
  });
  const pending = runResourceStudyCompose({ mode: 'comparison-catalog', budget: 'bounded', candidateImageId: imageId,
    run, save, saveTrace, traceGc, saveGcTrace, report: () => {}, random: size => Buffer.alloc(size, 7) });
  if (failed) await expect(pending).rejects.toThrow('resource_study_command_failed');
  else if (missingGc) await expect(pending).rejects.toThrow('resource_study_gc_evidence_incomplete');
  else await expect(pending).resolves.toMatchObject({ imageId, cleanup: 'passed' });
  expect(run.mock.calls.some(([, args]) => args.includes('build'))).toBe(false);
  expect(run.mock.calls.some(([, args]) => args.includes('down') && args.includes('--volumes'))).toBe(true);
  expect(save).toHaveBeenCalledTimes(failed || missingGc ? 0 : 1);
  expect(saveTrace.mock.calls[0][1]).toEqual([{ phase: 'catalog_drained', inventory: 5776 }]);
  expect(saveGcTrace).toHaveBeenCalledTimes(traceGc ? 1 : 0);
  if (traceGc) {
    expect(saveGcTrace.mock.calls[0][1].status).toBe(missingGc ? 'unavailable' : 'complete');
    expect(JSON.stringify(saveGcTrace.mock.calls)).not.toMatch(/private|abcdef|123/);
  }
  for (const [, args, options] of run.mock.calls) {
    const enabled = traceGc && args.includes('src/scripts/runResourceStudy.mjs') && args.at(-1) === 'comparison-catalog';
    expect(args.includes('--trace-gc')).toBe(enabled);
    expect(args.includes('--trace-gc-ignore-scavenger')).toBe(enabled);
    expect(options.shell).toBe(false);
    expect(args).not.toContain('--expose-gc');
  }
});

test.each([{ mode: 'soak', traceGc: true }, { mode: 'comparison-catalog', traceGc: 'true' }])(
  'GC tracing refuses invalid scope before Docker (%j)', async options => {
    const run = jest.fn();
    await expect(runResourceStudyCompose({ ...options, run })).rejects.toThrow('resource_study_gc_scope_invalid');
    expect(run).not.toHaveBeenCalled();
  });
test('catalog trace keeps numeric evidence and rejects payload fields', () => {
  expect(collectComparisonStudyTrace('STUDY_PROGRESS {"phase":"catalog_drained","completed":5776,"cached":5776,"url":"private"}'))
    .toEqual([{ phase: 'catalog_drained', completed: 5776, cached: 5776 }]);
});
