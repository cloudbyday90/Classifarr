/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { readComparisonResidentMemory, readResidentText } from '../../scripts/comparisonMemoryStudy/residentMemory.mjs';
import { parseResidentRollup, parseResidentCgroup, residentProcessIds, residentProcessIdentity,
  residentMemoryMembership } from '../../scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';
import { projectComparisonResident } from '../../../../scripts/lib/comparisonResidentProjection.mjs';
import { collectComparisonStudyTrace } from '../../../../scripts/lib/comparisonStudyTrace.mjs';

const rollup = 'secret-address secret-path\nRss: 200 kB\nPss: 100 kB\nPss_Anon: 80 kB\nPss_File: 15 kB\nPss_Shmem: 5 kB\nAnonymous: 80 kB\n';
const stat = start => `11 (private ) name) S ${Array(18).fill('0').join(' ')} ${start} 0`;
function fixture(version = 1) {
  const root = version === 1 ? '/sys/fs/cgroup/memory' : '/sys/fs/cgroup';
  const membership = version === 1 ? '7:memory:/private\n8:cpu:/private' : '0::/private';
  const files = new Map([[`${root}/memory.stat`, version === 1 ? 'total_rss 1000\ntotal_cache 2000\ntotal_shmem 500' : 'anon 1000\nfile 2000\nshmem 500'],
    [`${root}/cgroup.procs`, '11\n12\n13\n12\n'], ['/proc/self/cgroup', membership]]);
  for (const pid of [11, 12, 13]) {
    files.set(`/proc/${pid}/stat`, stat('1234')); files.set(`/proc/${pid}/cgroup`, membership);
    files.set(`/proc/${pid}/comm`, pid === 12 ? 'postgres\n' : 'private-name\n');
    files.set(`/proc/${pid}/smaps_rollup`, rollup);
  }
  const read = jest.fn(async path => {
    if (!files.has(path)) throw new Error('PRIVATE denied');
    return files.get(path);
  });
  return { files, read, root, membership, run: extra => readComparisonResidentMemory(version, { read, ownPid: 11, now: () => 0, ...extra }) };
}

test.each([1, 2])('attributes self/PostgreSQL/other without double counting PSS or leaking proc text (v%i)', async version => {
  const f = fixture(version), result = await f.run();
  expect(result.status).toBe('complete');
  expect(result.self).toMatchObject({ rssBytes: 204800, pssBytes: 102400, pssAnonBytes: 81920 });
  expect(result.processes).toEqual({ listed: 3, measured: 3, unavailable: 0,
    postgres: { count: 1, rssBytes: 204800, pssBytes: 102400 }, other: { count: 1, rssBytes: 204800, pssBytes: 102400 } });
  expect(projectComparisonResident(result)).toEqual(result);
  expect(JSON.stringify(result)).not.toMatch(/private|secret|\/proc|1234/);
  expect(f.read.mock.calls.every(([path]) => path.startsWith('/proc/') || path.startsWith('/sys/fs/cgroup/'))).toBe(true);
});

test.each(['Rss: -1 kB', 'Rss: 1 MB', 'Rss: 1.5 kB', 'Rss: 1e9 kB', 'Rss: 9007199254740991 kB',
  'Rss: 1 kB\nRss: 2 kB', 'Pss: 1 kB', 'x'.repeat(65537)])('rejects invalid rollup counters (%#)', text => {
  expect(() => parseResidentRollup(text)).toThrow('resident_counter_invalid');
});
test('zero counters remain real zero; unknown keys never become output', () => {
  expect(parseResidentRollup('Rss: 0 kB\nPss: 0 kB\nSecret: private')).toEqual({ rssBytes: 0, pssBytes: 0 });
  expect(parseResidentCgroup('anon 0\nfile 0\nsecret private', 2)).toEqual({ anon: 0, file: 0 });
  expect(() => parseResidentCgroup('anon 1\nfile 2\nanon 3', 2)).toThrow();
  expect(() => parseResidentCgroup('anon 1\nfile nope', 2)).toThrow();
  expect(() => parseResidentCgroup('anon 1\nfile 2', 1)).toThrow();
  expect(() => parseResidentCgroup('', 3)).toThrow();
});
test('process identities and group membership reject malformed or ambiguous inputs', () => {
  expect(residentProcessIdentity(stat('42'))).toBe('42');
  for (const value of [null, 'x', '11 (name) S nope']) expect(() => residentProcessIdentity(value)).toThrow();
  expect(residentMemoryMembership('1:memory,cpu:/safe:path', 1)).toBe('/safe:path');
  for (const value of [null, '', '1:cpu:/x', '1:memory:/a\n2:memory:/b']) expect(() => residentMemoryMembership(value, 1)).toThrow();
  for (const value of ['', '12', '../11', '0 11', '11 2147483648', Array.from({ length: 129 }, (_, i) => i + 1).join('\n')]) {
    expect(() => residentProcessIds(value, 11)).toThrow();
  }
});
test.each(['denied', 'vanished', 'reused', 'moved', 'renamed'])('process %s yields partial telemetry without raw errors', async kind => {
  const f = fixture(), original = f.read.getMockImplementation(); let stats = 0, groups = 0, names = 0;
  f.read.mockImplementation(async path => {
    if (path === '/proc/12/smaps_rollup' && ['denied', 'vanished'].includes(kind)) throw new Error('PRIVATE');
    if (path === '/proc/12/stat' && ++stats && kind === 'reused' && stats > 1) return stat('9999');
    if (path === '/proc/12/cgroup' && ++groups && kind === 'moved' && groups > 1) return '1:memory:/elsewhere';
    if (path === '/proc/12/comm' && ++names && kind === 'renamed' && names > 1) return 'other';
    return original(path);
  });
  const result = await f.run();
  expect(result.status).toBe('partial'); expect(result.processes.unavailable).toBe(1);
  expect(result.processes.postgres.count).toBe(0); expect(result.processes.measured).toBe(2);
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
test('foreign membership is refused before reading that process rollup', async () => {
  const f = fixture(); f.files.set('/proc/12/cgroup', '1:memory:/foreign');
  expect((await f.run()).status).toBe('partial');
  expect(f.read).not.toHaveBeenCalledWith('/proc/12/smaps_rollup');
});
test('missing counters, invalid scope and unsupported platform remain explicit gaps', async () => {
  const f = fixture(); f.files.delete(`${f.root}/memory.stat`);
  const result = await f.run(); expect(result.status).toBe('partial'); expect(result).not.toHaveProperty('cgroup');
  f.files.clear(); expect((await f.run()).status).toBe('unavailable');
  expect((await readComparisonResidentMemory(3)).status).toBe('unavailable');
});
test('deadline between reads stops further proc observations without claiming completion', async () => {
  const f = fixture(), original = f.read.getMockImplementation(); let time = 0;
  f.read.mockImplementation(async path => { const value = await original(path); if (path === '/proc/11/smaps_rollup') time = 251; return value; });
  const result = await f.run({ now: () => time });
  expect(result.status).toBe('partial'); expect(result.durationMs).toBe(251);
  expect(result.processes.unavailable).toBe(3); expect(f.read).not.toHaveBeenCalledWith('/proc/12/stat');
});
test.each(['success', 'oversized', 'read-error'])('bounded file handles close on %s', async kind => {
  const close = jest.fn(async () => {}), read = jest.fn(async (buffer, offset) => {
    expect(buffer.length).toBe(65537);
    if (kind === 'read-error') throw new Error('read failed');
    buffer.write('ok'); return { bytesRead: kind === 'oversized' ? 65537 : offset === 0 ? 2 : 0 };
  });
  const open = jest.fn(async () => ({ read, close }));
  if (kind === 'success') expect(await readResidentText('/fixed', open)).toBe('ok');
  else await expect(readResidentText('/fixed', open)).rejects.toThrow();
  expect(open).toHaveBeenCalledWith('/fixed', 'r'); expect(close).toHaveBeenCalledTimes(1);
});

test('short reads are accumulated rather than mistaken for complete proc files', async () => {
  const close = jest.fn(async () => {}), chunks = ['Rss: 1 kB\n', 'Pss: 1 kB\n', ''];
  const read = jest.fn(async (buffer, offset, length, position) => {
    expect(position).toBe(offset); expect(length).toBe(65537 - offset);
    const chunk = chunks.shift(); buffer.write(chunk, offset); return { bytesRead: chunk.length };
  });
  expect(await readResidentText('/fixed', async () => ({ read, close }))).toBe('Rss: 1 kB\nPss: 1 kB\n');
  expect(close).toHaveBeenCalledTimes(1);
});
test('projection preserves attribution, stream markers and reference counts without arbitrary context', async () => {
  const resident = await fixture().run(); resident.self.secret = 'PRIVATE'; resident.processes.pid = 123;
  resident.cgroup.__secret = 'PRIVATE'; resident.path = '/PRIVATE';
  const [row] = collectComparisonStudyTrace(`STUDY_PROGRESS ${JSON.stringify({ phase: 'recovery_read_19', resident,
    streamedVerification: true, mainHeapPhysicalBytes: 100, mainV8MallocBytes: 5, workerHeapPhysicalBytes: 2,
    alive: { verificationMetadata: 1, secret: 'PRIVATE' } })}`);
  expect(row).toMatchObject({ resident: { status: 'complete' }, streamedVerification: true,
    mainHeapPhysicalBytes: 100, mainV8MallocBytes: 5, workerHeapPhysicalBytes: 2, alive: { verificationMetadata: 1 } });
  expect(JSON.stringify(row)).not.toMatch(/PRIVATE|secret|pid|path/);
  expect(collectComparisonStudyTrace('STUDY_PROGRESS {"phase":"stopped","streamedVerification":"private"}')).toEqual([{ phase: 'stopped' }]);
});
test.each([null, [], {}, { status: 'private', cgroupVersion: 1 }, { status: 'complete', cgroupVersion: 1 },
  { status: 'partial', cgroupVersion: 3 }])('projection rejects malformed completeness claims (%#)', value => {
  expect(projectComparisonResident(value)).toBeUndefined();
});
test('projection excludes invalid counts and overlapping subfields are never summed', () => {
  expect(projectComparisonResident({ status: 'partial', cgroupVersion: 2, cgroup: { file: 50, shmem: 40, anon: -1 },
    processes: { listed: 1, measured: 4, unavailable: 0 } })).toEqual({ status: 'partial', cgroupVersion: 2, cgroup: { file: 50, shmem: 40 } });
});
