/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const MAPPING_FIELDS = Object.freeze({ Size: 'sizeBytes', Rss: 'rssBytes', Pss: 'pssBytes',
  Anonymous: 'anonymousBytes', Private_Dirty: 'privateDirtyBytes', Swap: 'swapBytes', LazyFree: 'lazyFreeBytes' });
export const MAPPING_CATEGORIES = Object.freeze(['anonymousWritable', 'anonymousReserved', 'anonymousExecutable',
  'anonymousOther', 'heap', 'stack', 'filePrivate', 'shared', 'special']);
export const MAPPING_BUCKETS = Object.freeze(['upTo64KiB', 'upTo1MiB', 'upTo16MiB', 'over16MiB']);
export const MAPPING_MAX_BYTES = 8 * 1024 ** 2;
export const MAPPING_MAX_COUNT = 8192;
const empty = () => Object.fromEntries(['count', ...Object.values(MAPPING_FIELDS)].map(key => [key, 0]));
const invalid = () => { throw new Error('comparison_mapping_invalid'); };

function category(permissions, name) {
  if (permissions[3] === 's') return 'shared';
  if (name === '[heap]') return 'heap';
  if (name === '[stack]' || name.startsWith('[stack:')) return 'stack';
  if (name && !name.startsWith('[anon:')) return name.startsWith('[') ? 'special' : 'filePrivate';
  if (permissions[2] === 'x') return 'anonymousExecutable';
  if (permissions.slice(0, 3) === '---') return 'anonymousReserved';
  return permissions[1] === 'w' ? 'anonymousWritable' : 'anonymousOther';
}

/** Incremental numeric aggregation: at most one mapping and one partial line, no raw output. */
export function createMappingCounterParser() {
  const categories = Object.fromEntries(MAPPING_CATEGORIES.map(key => [key, empty()]));
  const writableSizeBuckets = Object.fromEntries(MAPPING_BUCKETS.map(key => [key, empty()]));
  let pending = '', current = null, bytes = 0, count = 0, finished = false;
  const add = (target, values) => {
    for (const [key, value] of Object.entries(values)) {
      target[key] += value;
      if (!Number.isSafeInteger(target[key])) invalid();
    }
  };
  const line = text => {
    if (Buffer.byteLength(text) > 8192) invalid();
    const header = text.match(/^[a-f\d]+-[a-f\d]+ ([r-][w-][x-][ps]) [a-f\d]+ [a-f\d]+:[a-f\d]+ \d+\s*(.*)$/i);
    if (header) {
      if (current || ++count > MAPPING_MAX_COUNT) invalid();
      current = { category: category(header[1], header[2]), values: { count: 1 } };
      return;
    }
    if (!current) { if (text) invalid(); return; }
    if (text.startsWith('VmFlags:')) {
      if (Object.values(MAPPING_FIELDS).some(key => current.values[key] === undefined)) invalid();
      const { values } = current;
      if (values.sizeBytes === 0 || values.rssBytes > values.sizeBytes || values.pssBytes > values.rssBytes ||
          values.anonymousBytes > values.rssBytes || values.privateDirtyBytes > values.rssBytes) invalid();
      add(categories[current.category], values);
      if (current.category === 'anonymousWritable') {
        const index = values.sizeBytes <= 65536 ? 0 : values.sizeBytes <= 1024 ** 2 ? 1 : values.sizeBytes <= 16 * 1024 ** 2 ? 2 : 3;
        add(writableSizeBuckets[MAPPING_BUCKETS[index]], values);
      }
      current = null; return;
    }
    const key = text.split(':', 1)[0];
    if (!Object.hasOwn(MAPPING_FIELDS, key)) return;
    const match = text.match(/^\w+:\s+(\d+) kB$/), target = MAPPING_FIELDS[key];
    if (!match || Object.hasOwn(current.values, target)) invalid();
    const value = Number(match[1]) * 1024;
    if (!Number.isSafeInteger(value) || value < 0) invalid();
    current.values[target] = value;
  };
  return {
    push(chunk) {
      if (finished || typeof chunk !== 'string' || Buffer.byteLength(chunk) > 65540) invalid();
      bytes += Buffer.byteLength(chunk); if (bytes > MAPPING_MAX_BYTES) invalid();
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\n')) !== -1) { line(pending.slice(0, end)); pending = pending.slice(end + 1); }
      if (Buffer.byteLength(pending) > 8192) invalid();
    },
    finish() {
      if (finished || current || pending || !count) invalid();
      finished = true;
      return { status: 'complete', categories, writableSizeBuckets };
    },
  };
}
