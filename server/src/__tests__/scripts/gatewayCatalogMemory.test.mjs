/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createQualificationProbe, parseQualificationPressure } from '../../../../scripts/fixtures/ollamaGatewayRehearsal/archiveQualificationProbe.mjs';
import { createQualificationMeasurements } from '../../../../scripts/fixtures/ollamaGatewayRehearsal/archiveQualificationMeasurements.mjs';
import * as parsers from '../../scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

const pressure = 'some avg10=0.00 avg60=0.00 avg300=0.00 total=17\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=3\n';
const stat = (parent, start = '100') => `11 (private ) name) S ${parent} ${Array(17).fill('0').join(' ')} ${start} 0`;
function fixture(version = 2) {
  const root = version === 2 ? '/sys/fs/cgroup' : '/sys/fs/cgroup/memory';
  const group = version === 2 ? '0::/private' : '7:memory:/private';
  const files = new Map([
    [`${root}/${version === 2 ? 'memory.current' : 'memory.usage_in_bytes'}`, '123456'],
    [`${root}/memory.stat`, version === 2 ? 'anon 200\nfile 100\nshmem 80\nprivate 7' : 'total_rss 200\ntotal_cache 100\ntotal_shmem 80'],
    [`${root}/memory.pressure`, pressure], [`${root}/cgroup.procs`, '10\n11\n12\n1'],
  ]);
  const paths = new Map();
  for (const [pid, parent, exe] of [[10, 1, '/usr/bin/node'], [11, 10, '/usr/bin/node'], [12, 11, '/usr/libexec/postgresql18/pg_dump'], [1, 0, '/sbin/init']]) {
    files.set(`/proc/${pid}/stat`, stat(parent)); files.set(`/proc/${pid}/cgroup`, group);
    files.set(`/proc/${pid}/smaps_rollup`, 'private-path\nRss: 50 kB\nPss: 30 kB\nAnonymous: 20 kB\n');
    paths.set(`/proc/${pid}/exe`, exe);
  }
  const read = jest.fn(async path => {
    if (!files.has(path)) throw new Error('PRIVATE denied');
    return files.get(path);
  });
  const link = jest.fn(async path => paths.get(path));
  let time = 0;
  const run = createQualificationProbe({ version, workerPid: 11, ownPid: 10, executable: '/usr/bin/node',
    dumpExecutable: '/usr/libexec/postgresql18/pg_dump', read, link, parsers, now: () => time });
  return { run, read, files, paths, root, setTime: value => { time = value; } };
}

test.each([1, 2])('separates process and cgroup observations without summing overlapping fields (v%i)', async version => {
  const f = fixture(version), result = await f.run();
  expect(result.status).toBe('complete'); expect(result.currentBytes).toBe(123456);
  expect(result.dumpPresence).toBe('present'); expect(result.pressureUs).toEqual({ some: 17, full: 3 });
  expect(result.worker).toEqual({ rssBytes: 51200, pssBytes: 30720, anonymousBytes: 20480 });
  expect(result.dump).toEqual(result.worker); expect(result.observer).toEqual(result.worker);
  expect(result.cgroup).toEqual(version === 2 ? { anon: 200, file: 100, shmem: 80 } : { total_rss: 200, total_cache: 100, total_shmem: 80 });
  expect(JSON.stringify(result)).not.toMatch(/private|PRIVATE|\/proc|exe|parent|start/);
});

test.each(['missing', 'invalid', 'duplicate', 'oversize'])('bad cgroup fields are unavailable, not zero: %s', async kind => {
  const f = fixture();
  if (kind === 'missing') f.files.delete(`${f.root}/memory.stat`);
  else f.files.set(`${f.root}/memory.stat`, kind === 'invalid' ? 'anon -1\nfile 2' : kind === 'duplicate' ? 'anon 1\nfile 2\nfile 3' : 'x'.repeat(65537));
  const result = await f.run(); expect(result.status).toBe('partial'); expect(result.cgroup).toBeUndefined();
  expect(result.currentBytes).toBe(123456);
});

test.each(['-1', '1e2', '9007199254740992', 'private'])('rejects invalid current usage %s', async value => {
  const f = fixture(); f.files.set(`${f.root}/memory.current`, value);
  expect((await f.run()).currentBytes).toBeUndefined();
});

test('missing pressure is explicit and real zeros survive', async () => {
  const f = fixture(1); f.files.delete(`${f.root}/memory.pressure`);
  f.files.set(`${f.root}/memory.usage_in_bytes`, '0');
  const result = await f.run(); expect(result.currentBytes).toBe(0); expect(result.pressureUs).toBeUndefined();
  expect(result.pressureStatus).toBe('unavailable');
  expect(parseQualificationPressure(pressure.replace('17', '0').replace('3\n', '0\n'))).toEqual({ some: 0, full: 0 });
});

test.each(['', pressure + pressure, pressure.replace('17', '-1'), pressure.replace('0.00', '1..2'),
  pressure.replace('17', '9007199254740992'), 'x'.repeat(65537), null])('malformed pressure is refused (%#)', value => {
  expect(() => parseQualificationPressure(value)).toThrow();
});

test.each(['exit', 'reused', 'membership', 'parent', 'executable'])('worker %s is a missing observation', async kind => {
  const f = fixture(); await f.run();
  if (kind === 'exit') f.files.delete('/proc/11/stat');
  if (kind === 'reused') f.files.set('/proc/11/stat', stat(10, '101'));
  if (kind === 'membership') f.files.set('/proc/11/cgroup', '0::/other');
  if (kind === 'parent') f.files.set('/proc/11/stat', stat(99));
  if (kind === 'executable') f.paths.set('/proc/11/exe', '/wrong');
  const result = await f.run(); expect(result.status).toBe('partial'); expect(result.worker).toBeUndefined();
  expect(result.dumpPresence).toBe('unknown'); expect(result.dump).toBeUndefined();
});

test('identity changes during a process read reject that observation', async () => {
  const f = fixture(), original = f.read.getMockImplementation();
  f.read.mockImplementation(async path => {
    const value = await original(path);
    if (path === '/proc/12/smaps_rollup') f.files.set('/proc/12/stat', stat(11, '102'));
    return value;
  });
  const result = await f.run(); expect(result.dumpPresence).toBe('unknown'); expect(result.dump).toBeUndefined();
});

test('unrelated pg_dump is not attributed to the worker', async () => {
  const f = fixture(); f.files.set('/proc/12/stat', stat(1));
  expect((await f.run()).dumpPresence).toBe('absent');
});

test('disappearing process list member is unknown rather than confirmed absence', async () => {
  const f = fixture(); f.files.delete('/proc/12/stat');
  expect((await f.run()).dumpPresence).toBe('unknown');
});

test('observation budget stops further reads', async () => {
  const f = fixture(), original = f.read.getMockImplementation();
  f.read.mockImplementation(async path => { const value = await original(path); f.setTime(51); return value; });
  const result = await f.run(); expect(result.status).toBe('partial'); expect(result.durationMs).toBe(51);
  expect(f.read).toHaveBeenCalledTimes(1);
});

test('sample windows and aligned peaks stay bounded and do not imply exact phase duration', async () => {
  let time = 0, index = 0;
  const states = ['absent', 'present', 'unknown', 'absent'];
  const monitor = createQualificationMeasurements(async () => ({ status: 'complete', dumpPresence: states[index++ % 4], currentBytes: index,
    worker: { rssBytes: 20 }, observer: { rssBytes: 10 } }), { now: () => time, maxSamples: 420 });
  for (let i = 0; i < 1000; i++) { await monitor.tick(); time += 500; }
  const result = monitor.summary(); expect(result.samples).toBe(420); expect(result.capReached).toBe(true);
  expect(result.status).toBe('partial'); expect(result.coverage.worker).toBe(420); expect(result.coverage.pressure).toBe(0);
  expect(result.dumpObserved).toBe(true); expect(result.peaks.cgroup.value).toBe(420);
  expect(result.peaks.cgroup.observation.currentBytes).toBe(420);
  expect(Object.keys(result.windows).sort()).toEqual(['after_dump_observed', 'before_dump_observed', 'dump_present', 'unknown']);
  expect(JSON.stringify(result).length).toBeLessThan(10000);
  expect(result).not.toHaveProperty('trace'); expect(result.windows.dump_present).not.toHaveProperty('durationMs');
});

test('sample gaps, failed reads and actual observation cost are visible', async () => {
  let time = 0, fail = false;
  const monitor = createQualificationMeasurements(async () => { time += 20; if (fail) throw new Error('PRIVATE');
    return { status: 'partial', dumpPresence: 'unknown' }; }, { now: () => time });
  await monitor.tick(); time = 100; await monitor.tick(); time = 1500; fail = true; await monitor.tick();
  const result = monitor.summary(); expect(result.samples).toBe(2); expect(result.partialSamples).toBe(1);
  expect(result.failedSamples).toBe(1); expect(result.observationMs).toBe(40); expect(result.maxGapMs).toBe(1500);
  expect(result.peaks).toEqual({}); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test('overlapping ticks never overlap reads', async () => {
  let finish;
  const reader = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const monitor = createQualificationMeasurements(reader, { now: () => 0 });
  const first = monitor.tick(); await monitor.tick(); expect(reader).toHaveBeenCalledTimes(1);
  expect(monitor.summary().status).toBe('partial');
  finish({ status: 'partial', dumpPresence: 'unknown' }); await first;
});

test('empty monitor is unavailable, not a successful zero-memory observation', () => {
  const monitor = createQualificationMeasurements(async () => ({}), { now: () => 0 });
  expect(monitor.summary()).toMatchObject({ status: 'unavailable', samples: 0, peaks: {} });
});

test('two matching export children refuse ambiguous attribution', async () => {
  const f = fixture(); f.files.set(`${f.root}/cgroup.procs`, '10\n11\n12\n13');
  for (const part of ['stat', 'cgroup', 'smaps_rollup']) f.files.set(`/proc/13/${part}`, f.files.get(`/proc/12/${part}`));
  f.paths.set('/proc/13/exe', f.paths.get('/proc/12/exe'));
  const result = await f.run(); expect(result.dumpPresence).toBe('unknown'); expect(result.dump).toBeUndefined();
});

test('all observations failing stays incomplete and cannot authorize work', async () => {
  const monitor = createQualificationMeasurements(async () => { throw new Error('PRIVATE'); }, { now: () => 0 });
  await monitor.tick(); const result = monitor.summary();
  expect(result).toMatchObject({ status: 'partial', failedSamples: 1, peaks: {}, windows: {} });
  expect(Object.values(result.coverage).every(value => value === 0)).toBe(true);
  expect(result).not.toHaveProperty('purgeAuthorized');
});

test.each([{ intervalMs: 1 }, { maxSamples: 421 }, { maxSamples: 0 }])('invalid sampler bounds refused (%#)', options => {
  expect(() => createQualificationMeasurements(async () => ({}), options)).toThrow();
});
