/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';

const read = async path => (await readFile(`/sys/fs/cgroup/${path}`, 'utf8')).trim();
const pairs = value => Object.fromEntries(value.split('\n').map(line => line.split(/\s+/)));
export async function qualificationResources() {
  let v2;
  try { v2 = await read('memory.max'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (v2 !== undefined) return {
    limits: { version: 2, memory: v2, swap: await read('memory.swap.max'), cpu: await read('cpu.max'), pids: await read('pids.max') },
    metrics: async () => ({ peakBytes: Number(await read('memory.peak')), memoryEvents: pairs(await read('memory.events')),
      pidsEvents: await read('pids.events') }),
  };
  const memory = await read('memory/memory.limit_in_bytes');
  const combined = await read('memory/memory.memsw.limit_in_bytes');
  let cpu;
  for (const path of ['cpu', 'cpu,cpuacct']) {
    try { cpu = `${await read(`${path}/cpu.cfs_quota_us`)} ${await read(`${path}/cpu.cfs_period_us`)}`; break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!cpu) throw new Error('qualification_cpu_limits_unavailable');
  return {
    limits: { version: 1, memory, swap: String(BigInt(combined) - BigInt(memory)), cpu, pids: await read('pids/pids.max') },
    metrics: async () => {
      const oom = pairs(await read('memory/memory.oom_control'));
      return { peakBytes: Number(await read('memory/memory.max_usage_in_bytes')),
        memoryEvents: { under_oom: oom.under_oom, oom_kill: oom.oom_kill, limitHits: await read('memory/memory.failcnt') },
        pidsEvents: await read('pids/pids.events') };
    },
  };
}
