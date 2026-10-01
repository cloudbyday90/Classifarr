/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { assertImageIndexStudyReceipt, studyIndexPhase } from '../../scripts/imageIndexStudyContract.mjs';
import { readStudyProcessRss, readStudyIndexActivity, sampleStudyIndex, summarizeImageIndexSamples } from '../../scripts/imageIndexStudyObservation.mjs';
import { seedImageIndexStudy, clearStudyImageIndexes, claimStudyImageIndex, readStudyImageData } from '../../scripts/imageIndexStudyFixture.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';
import { imageIndexStudyReceiptFixture } from '../helpers/imageIndexStudyReceiptFixture.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';

test.each([[null, 'idle'], [undefined, 'idle'], ['initializing', 'initializing'], ['building index: loading tuples', 'building'],
  ['index validation: scanning table', 'validation'], ['waiting for writers before build', 'writer_wait'],
  ['waiting for old snapshots', 'snapshot_wait'], ['private text', 'other']])('phase is a fixed category: %s', (value, expected) => {
  expect(studyIndexPhase(value)).toBe(expected);
});

test('receipt and text distinguish incomplete repairs and unavailable observations', () => {
  const study = imageIndexStudyReceiptFixture();
  Object.assign(study.cases[3], { outcome: 'incomplete', acknowledged: false, validIndexes: 0, exitCode: 1 });
  expect(() => assertImageIndexStudyReceipt(study)).not.toThrow();
  const result = { mode: 'image-index', budget: 'baseline', study, cleanup: 'passed' };
  const text = formatResourceStudySummary(result);
  expect(text).toContain('incomplete'); expect(text).toContain('Unavailable');
  expect(text).toContain('not exact durations'); expect(text).toContain('not a passing build');
  expect(() => formatResourceStudySummary({ ...result, cleanup: 'failed' })).toThrow();
});

test.each([70, 71, 72, 73, 74, 76, 80, 81, 82, 83])('classified exit %s remains incomplete evidence', exitCode => {
  const study = imageIndexStudyReceiptFixture();
  Object.assign(study.cases[3], { outcome: 'incomplete', acknowledged: false, validIndexes: 0, exitCode, workMemMiB: null });
  expect(() => assertImageIndexStudyReceipt(study)).not.toThrow();
  study.cases[3].workMemMiB = 512;
  expect(() => assertImageIndexStudyReceipt(study)).toThrow();
});

test.each([67, 68, 69, 99, '83'])('unrecognized child exit %s cannot be measured', exitCode => {
  const study = imageIndexStudyReceiptFixture();
  Object.assign(study.cases[3], { outcome: 'incomplete', acknowledged: false, validIndexes: 0, exitCode });
  expect(() => assertImageIndexStudyReceipt(study)).toThrow();
});

test.each([
  s => { s.status = 'passed'; }, s => { s.dimensions = 768; }, s => { s.rowsPreserved = false; },
  s => { s.databaseIdle = false; }, s => { s.workersStopped = false; }, s => { s.interruption.invalidObserved = false; },
  s => { s.cases.pop(); }, s => { s.durationMs = 1200001; }, s => { s.cases[0].rows = 123; },
  s => { s.cases[0].outcome = 'unknown'; }, s => { s.cases[0].acknowledged = false; }, s => { s.cases[0].validIndexes = 2; },
  s => { s.cases[0].samples = 601; }, s => { s.cases[0].phases.secret = 1; }, s => { s.cases[0].waits.none = 2; },
  s => { s.cases[0].workerPeakBytes = 0; }, s => { s.cases[0].containerCpuP95 = NaN; },
  s => { s.cases[0].signal = 'secret'; }, s => { s.final.oomKill = 1; }, s => { s.final.cpuUsec = 0; },
  s => { s.cases[0].exitCode = 1; }, s => { s.cases[0].watchdog = true; },
])('invalid evidence cannot claim a measured study (%#)', mutate => {
  const study = imageIndexStudyReceiptFixture(); mutate(study);
  expect(() => assertImageIndexStudyReceipt(study)).toThrow();
});

test.each([undefined, null, 0, -1, '1', 1.5])('RSS rejects invalid PID %s without reading', async pid => {
  const read = jest.fn(); expect(await readStudyProcessRss(pid, read)).toBeNull(); expect(read).not.toHaveBeenCalled();
});
test.each(['VmRSS:\t100 kB\n', 'VmRSS:\t0 kB\n', 'VmRSS: 999999999999999999 kB\n', 'unavailable'])('RSS parser does not invent values: %s', async data => {
  const read = jest.fn().mockResolvedValue(data);
  expect(await readStudyProcessRss(12, read)).toBe(data.startsWith('VmRSS:\t100 ') ? 102400 : null);
  expect(read).toHaveBeenCalledWith('/proc/12/status', 'utf8');
});
test('exited process and empty sample sets remain unknown', async () => {
  expect(await readStudyProcessRss(12, async () => { throw new Error('gone'); })).toBeNull();
  expect(summarizeImageIndexSamples([])).toMatchObject({ samples: 0, containerCpuP95: null, workerPeakBytes: null });
});

test('activity uses only fixed parameterized DDL, with no persisted SQL or backend PID', async () => {
  const query = jest.fn().mockResolvedValue({ rows: [] }), sampler = { sample: jest.fn() };
  expect(await sampleStudyIndex(query, sampler, 'small_build')).toBeNull();
  expect(query.mock.calls[0][0]).toContain('a.query=ANY($1::text[])');
  expect(query.mock.calls[0][1][0]).toHaveLength(6);
  expect(sampler.sample).toHaveBeenCalledWith('small_build', { indexPhase: 'idle', wait: 'none', workerBytes: null, postgresBytes: null });
  query.mockResolvedValue({ rows: [{ phase: 'secret', wait_event_type: 'secret' }] });
  await sampleStudyIndex(query, sampler, 'small_build');
  expect(sampler.sample.mock.calls.at(-1)[1]).toMatchObject({ indexPhase: 'other', wait: 'other' });
  query.mockResolvedValue({ rows: [{}, {}] }); await expect(readStudyIndexActivity(query)).rejects.toThrow('overlapping');
});

test('aggregation uses sampled peaks and counts without converting missing values to zero', () => {
  expect(summarizeImageIndexSamples([{ containerBytes: 1024, rssBytes: 100, workerBytes: 500,
    postgresBytes: null, containerCores: 1, indexPhase: 'writer_wait', wait: 'Lock' }])).toMatchObject({
    samples: 1, containerPeakBytes: 1024, workerPeakBytes: 500, postgresPeakBytes: null,
    phases: { writer_wait: 1 }, waits: { Lock: 1 }, containerCpuP95: 1,
  });
});

describe('synthetic mutation boundary', () => {
  let old;
  beforeEach(() => { old = process.env; process.env = { ...old, ...resourceStudyEnvironment }; });
  afterEach(() => { process.env = old; });
  test('fixed bounded batches, dimensions and movie-only history', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] }), sample = jest.fn();
    await seedImageIndexStudy({ query }, 0, 1000, sample);
    expect(query).toHaveBeenCalledTimes(10); expect(sample).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([1, 100]); expect(query.mock.calls.at(-1)[1]).toEqual([901, 1000]);
    expect(query.mock.calls[0][0]).toContain('generate_series(1,2000)');
    expect(query.mock.calls[0][0]).toContain("SELECT 'movie'");
    await expect(seedImageIndexStudy({ query }, 0, 50000, sample)).rejects.toThrow();
  });
  test('cleanup uses only the closed contract and claim carries no arbitrary SQL', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: '1' }] });
    await clearStudyImageIndexes(query); expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.every(([sql]) => sql.startsWith('DROP INDEX CONCURRENTLY IF EXISTS public.idx_embeddings_image_'))).toBe(true);
    expect(await claimStudyImageIndex(query)).toEqual({ id: '1' });
    expect(query.mock.calls.at(-1)[0]).toContain("'synthetic_image_study'");
    expect(await readStudyImageData(query)).toEqual({ id: '1' });
  });
  test.each(['CLASSIFARR_RESOURCE_STUDY', 'CLASSIFARR_UPGRADE_DRILL', 'CLASSIFARR_RUNTIME_MODE', 'POSTGRES_HOST'])('missing guard %s refuses mutations', async key => {
    delete process.env[key]; const query = jest.fn();
    await expect(seedImageIndexStudy({ query }, 0, 1000, jest.fn())).rejects.toThrow();
    await expect(clearStudyImageIndexes(query)).rejects.toThrow();
    await expect(claimStudyImageIndex(query)).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
  });
});
