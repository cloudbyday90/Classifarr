/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parseQualificationPressure } from './archiveQualificationProbe.mjs';

const number = text => {
  if (!/^\d+$/.test(text)) throw new Error('study_counter_invalid');
  const value = Number(text); if (!Number.isSafeInteger(value)) throw new Error('study_counter_invalid'); return value;
};
export function studyCpu(text, version) {
  if (![1, 2].includes(version) || typeof text !== 'string' || text.length > 65536) throw new Error('study_counter_invalid');
  const pairs = Object.fromEntries(text.trim().split('\n').map(line => line.trim().split(/\s+/)));
  const result = {};
  if (version === 2) result.cpuUsageUs = number(pairs.usage_usec);
  const throttled = pairs[version === 2 ? 'throttled_usec' : 'throttled_time'];
  if (throttled !== undefined) result.cpuThrottledUs = number(throttled) / (version === 2 ? 1 : 1000);
  return result;
}
export function studyIo(text, version) {
  if (![1, 2].includes(version) || typeof text !== 'string' || text.length > 65536) throw new Error('study_counter_invalid');
  let readBytes = 0, writeBytes = 0;
  for (const line of text.trim().split('\n').filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (version === 1 && parts[0] === 'Total' && parts.length === 2) { number(parts[1]); continue; }
    if (!/^\d+:\d+$/.test(parts[0]) || parts.length < 2) throw new Error('study_counter_invalid');
    if (version === 1) {
      if (parts.length !== 3 || !['Read','Write','Sync','Async','Total'].includes(parts[1])) throw new Error('study_counter_invalid');
      number(parts[2]);
      if (parts[1] === 'Read') readBytes += number(parts[2]);
      if (parts[1] === 'Write') writeBytes += number(parts[2]);
    } else for (const part of parts.slice(1)) {
      const [key, value, extra] = part.split('=');
      if (!/^[a-z_]+$/.test(key) || extra !== undefined) throw new Error('study_counter_invalid');
      number(value); if (key === 'rbytes') readBytes += number(value); if (key === 'wbytes') writeBytes += number(value);
    }
  }
  if (![readBytes, writeBytes].every(Number.isSafeInteger)) throw new Error('study_counter_invalid');
  return { readBytes, writeBytes };
}

export function createStudyResourceSample({ version, read, parsers, probe = null, extra = async () => ({}) }) {
  if (![1, 2].includes(version)) throw new Error('study_version_invalid');
  const root = version === 2 ? '/sys/fs/cgroup' : '/sys/fs/cgroup/memory';
  return async () => {
    const sample = {}, optional = async action => { try { Object.assign(sample, await action()); } catch { /* Unavailable is not zero. */ } };
    await optional(async () => {
      const memory = parsers.parseResidentCgroup(await read(`${root}/memory.stat`), version);
      return { currentBytes: number((await read(`${root}/${version === 2 ? 'memory.current' : 'memory.usage_in_bytes'}`)).trim()),
        anonBytes: memory[version === 2 ? 'anon' : 'total_rss'], fileBytes: memory[version === 2 ? 'file' : 'total_cache'] };
    });
    await optional(async () => {
      const pressure = parseQualificationPressure(await read(`${root}/memory.pressure`));
      return { pressureSomeUs: pressure.some, pressureFullUs: pressure.full };
    });
    if (version === 2) {
      await optional(async () => studyCpu(await read('/sys/fs/cgroup/cpu.stat'), version));
      await optional(async () => studyIo(await read('/sys/fs/cgroup/io.stat'), version));
    } else {
      for (const cpu of ['cpu', 'cpu,cpuacct']) {
        try { Object.assign(sample, studyCpu(await read(`/sys/fs/cgroup/${cpu}/cpu.stat`), version)); break; } catch { /* Try the other fixed mount. */ }
      }
      for (const cpu of ['cpuacct', 'cpu,cpuacct']) {
        try { sample.cpuUsageUs = number((await read(`/sys/fs/cgroup/${cpu}/cpuacct.usage`)).trim()) / 1000; break; } catch { /* Optional. */ }
      }
      await optional(async () => studyIo(await read('/sys/fs/cgroup/blkio/blkio.throttle.io_service_bytes'), version));
    }
    if (probe) await optional(async () => { const value = await probe(); return {
      ...(value.worker ? { workerRssBytes: value.worker.rssBytes } : {}), ...(value.observer ? { observerRssBytes: value.observer.rssBytes } : {}) }; });
    await optional(extra); return sample;
  };
}
