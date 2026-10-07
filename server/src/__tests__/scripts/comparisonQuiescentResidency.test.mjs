/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createMappingCounterParser, MAPPING_FIELDS, MAPPING_MAX_COUNT } from '../../scripts/comparisonMemoryStudy/mappingCounters.mjs';
import { readComparisonMappings } from '../../scripts/comparisonMemoryStudy/mappingMemory.mjs';
import { assertComparisonMappings, projectComparisonMappings } from '../../scripts/comparisonMemoryStudy/mappingContract.mjs';
import { observeQuiescentResidency, assertQuiescentResidency } from '../../scripts/comparisonMemoryStudy/quiescentResidency.mjs';
import { collectComparisonStudyTrace } from '../../../../scripts/lib/comparisonStudyTrace.mjs';

const mapping = (name = '', permissions = 'rw-p', size = 64) =>
  `1000-11000 ${permissions} 00000000 00:00 0 ${name}\n` +
  Object.keys(MAPPING_FIELDS).map(key => `${key}: ${key === 'Size' ? size : key === 'Swap' || key === 'LazyFree' ? 0 : 4} kB\n`).join('') +
  'UnknownFutureField: 17 kB\nVmFlags: rd wr\n';
function parse(text) { const parser = createMappingCounterParser(); parser.push(text); return parser.finish(); }

test('incremental mappings classify without retaining addresses or filenames; virtual buckets reconcile', () => {
  const text = mapping() + mapping('[anon:private]') + mapping('', '---p') + mapping('', 'r-xp') +
    mapping('', 'r--p') + mapping('[heap]') + mapping('[stack]') + mapping('/private/file') +
    mapping('/private/shared', 'rw-s') + mapping('[vdso]') + mapping('', 'rw-p', 1024) +
    mapping('', 'rw-p', 16384) + mapping('', 'rw-p', 16388);
  const parser = createMappingCounterParser();
  for (let index = 0; index < text.length; index += 13) parser.push(text.slice(index, index + 13));
  const result = parser.finish(); assertComparisonMappings(result);
  expect(result.categories.anonymousWritable.count).toBe(5);
  expect(result.writableSizeBuckets.upTo64KiB.count).toBe(2);
  for (const key of ['upTo1MiB', 'upTo16MiB', 'over16MiB']) expect(result.writableSizeBuckets[key].count).toBe(1);
  expect(result.categories.filePrivate.anonymousBytes).toBe(4096);
  expect(JSON.stringify(result)).not.toMatch(/private\/|1000-|vdso|anon:/);
  expect(() => parser.push('')).toThrow(); expect(() => parser.finish()).toThrow();
});

test.each([
  '', mapping().replace('Rss: 4', 'Rss: -1'), mapping().replace('Rss: 4', 'Rss: 1.5'),
  mapping().replace('Rss: 4', 'Rss: 9007199254740991'), mapping().replace('Rss: 4', 'Rss: 65'),
  mapping().replace('Rss: 4 kB\n', ''), mapping().replace('Rss: 4 kB', 'Rss: 4 kB\nRss: 4 kB'),
  mapping().replace('Pss: 4', 'Pss: 5'), mapping().replace('kB', 'MB'), mapping().slice(0, -1),
  mapping().replace('VmFlags: rd wr\n', ''), mapping() + 'private', 'x'.repeat(8193),
])('invalid or truncated mappings fail closed (%#)', text => expect(() => parse(text)).toThrow());

test('byte and mapping budgets are finite', () => {
  const bytes = createMappingCounterParser();
  expect(() => bytes.push('x'.repeat(65541))).toThrow();
  const count = createMappingCounterParser();
  for (let i = 0; i < MAPPING_MAX_COUNT; i++) count.push(mapping());
  expect(() => count.push(mapping())).toThrow();
  const total = createMappingCounterParser();
  total.push(mapping());
  const emptyLines = '\n'.repeat(65536);
  expect(() => { for (let i = 0; i < 128; i++) total.push(emptyLines); }).toThrow();
});

function reader(text, { failRead = false, failClose = false } = {}) {
  let cursor = 0;
  const file = { read: jest.fn(async buffer => {
    if (failRead) throw new Error('private-path');
    const bytes = Buffer.from(text), end = Math.min(cursor + 17, bytes.length);
    const bytesRead = bytes.copy(buffer, 0, cursor, end); cursor = end; return { bytesRead };
  }), close: jest.fn(async () => { if (failClose) throw new Error('private-close'); }) };
  return { file, openFile: jest.fn(async () => file) };
}

test('fixed-path bounded reader closes and emits aggregate evidence only', async () => {
  const f = reader(mapping('/private/\u00e9'));
  const result = await readComparisonMappings({ openFile: f.openFile, now: () => 0 });
  assertComparisonMappings(result); expect(result.status).toBe('complete');
  expect(f.openFile).toHaveBeenCalledWith('/proc/self/smaps', 'r'); expect(f.file.close).toHaveBeenCalledTimes(1);
  for (const options of [{ failRead: true }, { failClose: true }]) {
    const bad = reader(mapping(), options);
    expect(await readComparisonMappings({ openFile: bad.openFile })).toEqual({ status: 'unavailable' });
    expect(bad.file.close).toHaveBeenCalledTimes(1);
  }
  let time = 0; const slow = reader(mapping());
  expect(await readComparisonMappings({ openFile: slow.openFile, now: () => (time += 600) })).toEqual({ status: 'unavailable' });
  expect(slow.file.close).toHaveBeenCalledTimes(1);
  expect(await readComparisonMappings({ openFile: async () => { throw new Error('private'); } })).toEqual({ status: 'unavailable' });
});

test('mapping projection rejects unexpected data, contradictory counters and mismatched buckets', () => {
  const valid = parse(mapping());
  expect(projectComparisonMappings(valid)).toEqual(valid);
  for (const mutate of [row => { row.path = 'private'; }, row => { row.categories.anonymousWritable.pid = 1; },
    row => { row.writableSizeBuckets.upTo64KiB.count++; }, row => { row.categories.heap.rssBytes = 1; },
    row => { row.categories.anonymousWritable.sizeBytes = NaN; }]) {
    const invalid = structuredClone(valid); mutate(invalid); expect(projectComparisonMappings(invalid)).toBeUndefined();
  }
  const trace = collectComparisonStudyTrace(`STUDY_PROGRESS ${JSON.stringify({ phase: 'post_stop_residency_0', mappings: valid, payload: 'private' })}`);
  expect(trace).toEqual([{ phase: 'post_stop_residency_0', mappings: valid }]);
});

async function quiet({ check = jest.fn(), activeWorkers = 0 } = {}) {
  let time = 0;
  const sample = jest.fn(async () => ({ elapsedMs: time, rss: 30, heapUsed: 10, heapTotal: 20, external: 4,
    arrayBuffers: 2, containerBytes: 40, createdWorkers: 2, exitedWorkers: 2, activeWorkers,
    mainHeapPhysicalBytes: 20, mainV8MallocBytes: 1, mappings: { status: 'unavailable' } }));
  const result = await observeQuiescentResidency({ sample, check, now: () => time, wait: async ms => { time += ms; } });
  return { result, sample, check };
}

test('quiet observation keeps five samples, waits two minutes and checks quiescence around every sample', async () => {
  const { result, sample, check } = await quiet();
  expect(result.durationMs).toBe(120000); expect(result.samples.map(row => row.elapsedMs)).toEqual([0, 30000, 60000, 90000, 120000]);
  expect(sample).toHaveBeenCalledTimes(5); expect(check).toHaveBeenCalledTimes(10);
  for (const mutate of [row => { row.secret = 'private'; }, row => { row.samples.pop(); }, row => { row.durationMs = 1; },
    row => { row.samples[2].createdWorkers++; }, row => { row.samples[1].elapsedMs = 1; },
    row => { row.samples[0].mappings.path = 'private'; }]) {
    const invalid = structuredClone(result); mutate(invalid); expect(() => assertQuiescentResidency(invalid)).toThrow();
  }
  await expect(quiet({ activeWorkers: 1 })).rejects.toThrow();
  const resumed = jest.fn().mockImplementationOnce(() => {}).mockImplementation(() => { throw new Error('resumed'); });
  await expect(quiet({ check: resumed })).rejects.toThrow('resumed'); expect(resumed).toHaveBeenCalledTimes(2);
});
