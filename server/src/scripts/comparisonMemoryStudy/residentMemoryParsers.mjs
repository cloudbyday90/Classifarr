/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const ROLLUP_FIELDS = Object.freeze({ Rss: 'rssBytes', Pss: 'pssBytes', Pss_Anon: 'pssAnonBytes',
  Pss_File: 'pssFileBytes', Pss_Shmem: 'pssShmemBytes', Anonymous: 'anonymousBytes',
  Private_Clean: 'privateCleanBytes', Private_Dirty: 'privateDirtyBytes', Swap: 'swapBytes', LazyFree: 'lazyFreeBytes' });
export const CGROUP_FIELDS = Object.freeze({
  1: ['total_rss', 'total_cache', 'total_shmem', 'total_mapped_file', 'total_swap', 'total_dirty',
    'total_writeback', 'total_active_anon', 'total_inactive_anon', 'total_active_file', 'total_inactive_file'],
  2: ['anon', 'file', 'shmem', 'file_mapped', 'file_dirty', 'file_writeback', 'kernel', 'kernel_stack',
    'pagetables', 'slab', 'sock', 'active_anon', 'inactive_anon', 'active_file', 'inactive_file', 'swapcached'],
});

function counters(text, allowed, kib) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536) throw new Error('resident_counter_invalid');
  const result = {}, seen = new Set();
  for (const line of text.split('\n')) {
    const fields = line.trim().split(/\s+/), key = kib ? fields[0].replace(/:$/, '') : fields[0];
    if (!Object.hasOwn(allowed, key)) continue;
    if (seen.has(key) || fields.length !== (kib ? 3 : 2) || (kib && fields[2] !== 'kB') || !/^\d+$/.test(fields[1])) {
      throw new Error('resident_counter_invalid');
    }
    const value = Number(fields[1]) * (kib ? 1024 : 1);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('resident_counter_invalid');
    seen.add(key); result[allowed[key]] = value;
  }
  return result;
}

export function parseResidentRollup(text) {
  const result = counters(text, ROLLUP_FIELDS, true);
  if (!Object.hasOwn(result, 'rssBytes') || !Object.hasOwn(result, 'pssBytes')) throw new Error('resident_counter_invalid');
  return result;
}

export function parseResidentCgroup(text, version) {
  if (![1, 2].includes(version)) throw new Error('resident_counter_invalid');
  const result = counters(text, Object.fromEntries(CGROUP_FIELDS[version].map(key => [key, key])), false);
  const required = version === 1 ? ['total_rss', 'total_cache'] : ['anon', 'file'];
  if (required.some(key => !Object.hasOwn(result, key))) throw new Error('resident_counter_invalid');
  return result;
}

export function residentProcessIdentity(text) {
  if (typeof text !== 'string') throw new Error('resident_process_invalid');
  const end = text.lastIndexOf(') '), fields = text.slice(end + 2).trim().split(/\s+/);
  if (end < 0 || !/^\d+$/.test(fields[19] ?? '')) throw new Error('resident_process_invalid');
  return fields[19];
}

export function residentMemoryMembership(text, version) {
  if (typeof text !== 'string') throw new Error('resident_membership_invalid');
  const rows = text.trim().split('\n').map(line => line.match(/^\d+:([^:]*):(\/.*)$/))
    .filter(row => row && (version === 2 ? row[1] === '' : row[1].split(',').includes('memory')));
  if (rows.length !== 1) throw new Error('resident_membership_invalid');
  return rows[0][2];
}

export function residentProcessIds(text, ownPid) {
  if (typeof text !== 'string' || text.length > 65536) throw new Error('resident_process_invalid');
  const fields = text.trim().split(/\s+/);
  if (fields.some(field => !/^\d+$/.test(field))) throw new Error('resident_process_invalid');
  const ids = [...new Set(fields.map(Number))];
  if (ids.length > 128 || !ids.includes(ownPid) || ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
    throw new Error('resident_process_invalid');
  }
  return [ownPid, ...ids.filter(id => id !== ownPid)];
}
