/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { open } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { parseResidentRollup, parseResidentCgroup, residentProcessIdentity,
  residentMemoryMembership, residentProcessIds } from './residentMemoryParsers.mjs';

/** Fixed proc/cgroup callers only; never expose raw contents or errors. */
export async function readResidentText(path, openFile = open) {
  const handle = await openFile(path, 'r');
  try {
    const buffer = Buffer.alloc(65537);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (bytesRead === 0) return buffer.toString('utf8', 0, size);
      size += bytesRead;
    }
    throw new Error('resident_read_budget');
  } finally { await handle.close(); }
}

async function readProcess(read, pid, version, membership) {
  const base = `/proc/${pid}`;
  const before = residentProcessIdentity(await read(`${base}/stat`));
  if (residentMemoryMembership(await read(`${base}/cgroup`), version) !== membership) throw new Error('resident_membership_changed');
  const name = (await read(`${base}/comm`)).trim();
  const values = parseResidentRollup(await read(`${base}/smaps_rollup`));
  if (before !== residentProcessIdentity(await read(`${base}/stat`)) || name !== (await read(`${base}/comm`)).trim() ||
      residentMemoryMembership(await read(`${base}/cgroup`), version) !== membership) throw new Error('resident_process_changed');
  return { postgres: name === 'postgres', values };
}

/** Phase-only diagnostic, never used to admit work or infer zero from missing data. */
export async function readComparisonResidentMemory(version, { read = readResidentText, ownPid = process.pid,
  now = () => performance.now() } = {}) {
  const started = now(), result = { status: 'unavailable', cgroupVersion: version, durationMs: 0 };
  const root = version === 1 ? '/sys/fs/cgroup/memory' : '/sys/fs/cgroup';
  const boundedRead = path => {
    if (now() - started >= 250) throw new Error('resident_observation_budget');
    return read(path);
  };
  try {
    if (![1, 2].includes(version)) throw new Error('resident_cgroup_invalid');
    try { result.cgroup = parseResidentCgroup(await boundedRead(`${root}/memory.stat`), version); } catch { /* Missing is not zero. */ }
    const membership = residentMemoryMembership(await boundedRead('/proc/self/cgroup'), version);
    const ids = residentProcessIds(await boundedRead(`${root}/cgroup.procs`), ownPid);
    result.processes = { listed: ids.length, measured: 0, unavailable: 0,
      postgres: { count: 0, rssBytes: 0, pssBytes: 0 }, other: { count: 0, rssBytes: 0, pssBytes: 0 } };
    for (const [index, pid] of ids.entries()) {
      if (now() - started >= 250) { result.processes.unavailable += ids.length - index; break; }
      try {
        const { postgres, values } = await readProcess(boundedRead, pid, version, membership);
        if (pid === ownPid) result.self = values;
        else {
          const group = result.processes[postgres ? 'postgres' : 'other'];
          const rssBytes = group.rssBytes + values.rssBytes, pssBytes = group.pssBytes + values.pssBytes;
          if (!Number.isSafeInteger(rssBytes) || !Number.isSafeInteger(pssBytes)) throw new Error('resident_sum_invalid');
          group.count++; group.rssBytes = rssBytes; group.pssBytes = pssBytes;
        }
        result.processes.measured++;
      } catch { result.processes.unavailable++; }
    }
    result.status = result.cgroup && result.self && result.processes.unavailable === 0 ? 'complete' : 'partial';
  } catch { if (result.cgroup) result.status = 'partial'; }
  result.durationMs = Math.max(0, Math.ceil(now() - started));
  return result;
}
