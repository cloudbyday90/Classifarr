/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readlink } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

function unsigned(value) {
  if (!/^\d+$/.test(value.trim())) throw new Error('qualification_counter_invalid');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('qualification_counter_invalid');
  return number;
}

export function parseQualificationPressure(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 65536) throw new Error('qualification_pressure_invalid');
  const result = {};
  for (const line of text.trim().split('\n')) {
    const match = /^(some|full) avg10=\d+(?:\.\d+)? avg60=\d+(?:\.\d+)? avg300=\d+(?:\.\d+)? total=(\d+)$/.exec(line);
    if (!match || Object.hasOwn(result, match[1])) throw new Error('qualification_pressure_invalid');
    result[match[1]] = unsigned(match[2]);
  }
  if (!Object.hasOwn(result, 'some') || !Object.hasOwn(result, 'full')) throw new Error('qualification_pressure_invalid');
  return result;
}

/** Helpers come from the immutable image, not a replacement application module. */
export function createQualificationProbe({ version, workerPid, read, parsers,
  ownPid = process.pid, executable = process.execPath, dumpExecutable = '/usr/bin/pg_dump', link = readlink, now = () => performance.now() }) {
  if (![1, 2].includes(version) || !Number.isSafeInteger(workerPid) || workerPid < 1) throw new Error('qualification_probe_invalid');
  const root = version === 2 ? '/sys/fs/cgroup' : '/sys/fs/cgroup/memory';
  let workerIdentity;
  const identity = async (pid, bounded) => {
    const raw = await bounded(`/proc/${pid}/stat`);
    const fields = raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/);
    return { start: parsers.residentProcessIdentity(raw), parent: unsigned(fields[1]),
      executable: await link(`/proc/${pid}/exe`),
      membership: parsers.residentMemoryMembership(await bounded(`/proc/${pid}/cgroup`), version) };
  };
  const same = (a, b) => a.start === b.start && a.parent === b.parent && a.executable === b.executable && a.membership === b.membership;
  return async () => {
    const started = now(), result = { status: 'partial', dumpPresence: 'unknown', pressureStatus: 'unavailable' };
    const bounded = path => {
      if (now() - started >= 50) throw new Error('qualification_observation_budget');
      return read(path);
    };
    const processMemory = async (pid, expected) => {
      const before = await identity(pid, bounded);
      if (!same(before, expected)) throw new Error('qualification_process_changed');
      const values = parsers.parseResidentRollup(await bounded(`/proc/${pid}/smaps_rollup`));
      if (!same(before, await identity(pid, bounded))) throw new Error('qualification_process_changed');
      return values;
    };
    try {
      result.currentBytes = unsigned(await bounded(`${root}/${version === 2 ? 'memory.current' : 'memory.usage_in_bytes'}`));
      result.cgroup = parsers.parseResidentCgroup(await bounded(`${root}/memory.stat`), version);
    } catch { /* Missing is not zero; the worker remains independent. */ }
    try {
      result.pressureUs = parseQualificationPressure(await bounded(`${root}/memory.pressure`)); result.pressureStatus = 'available';
    } catch { /* Optional kernel interface. */ }
    try {
      const observer = await identity(ownPid, bounded);
      result.observer = await processMemory(ownPid, observer);
      const worker = await identity(workerPid, bounded);
      if (worker.parent !== ownPid || worker.executable !== executable || worker.membership !== observer.membership ||
          (workerIdentity && !same(worker, workerIdentity))) throw new Error('qualification_worker_changed');
      workerIdentity ??= worker;
      result.worker = await processMemory(workerPid, workerIdentity);
      const ids = parsers.residentProcessIds(await bounded(`${root}/cgroup.procs`), ownPid);
      let unknown = false, dumps = 0;
      for (const pid of ids) {
        if (pid === ownPid || pid === workerPid) continue;
        try {
          const candidate = await identity(pid, bounded);
          if (candidate.parent !== workerPid || candidate.executable !== dumpExecutable || candidate.membership !== worker.membership) continue;
          dumps++;
          if (dumps !== 1) throw new Error('qualification_multiple_dumps');
          result.dump = await processMemory(pid, candidate);
        } catch { unknown = true; }
      }
      if (!same(workerIdentity, await identity(workerPid, bounded))) throw new Error('qualification_worker_changed');
      result.dumpPresence = unknown ? 'unknown' : dumps === 1 ? 'present' : 'absent';
      if (unknown) delete result.dump;
    } catch { delete result.worker; delete result.dump; }
    result.durationMs = Math.max(0, now() - started);
    if (result.cgroup && result.currentBytes !== undefined && result.observer && result.worker && result.dumpPresence !== 'unknown') result.status = 'complete';
    return result;
  };
}
