/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const commandOptions = { timeout: 10000, maxBuffer: 4096, windowsHide: true };
const validId = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);

function numbers(text, length) {
  if (typeof text !== 'string' || text.length > 256 || !/^[\d\s]+$/.test(text)) {
    throw new Error('diagnostic_resource_limits_unverified');
  }
  const values = text.trim().split(/\s+/).map(Number);
  if (values.length !== length || values.some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('diagnostic_resource_limits_unverified');
  }
  return values;
}

async function readKernelLimits(id, execute) {
  let result;
  try {
    result = await execute('docker', ['exec', id, 'cat', '/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/cpu.max'], commandOptions);
  } catch (error) {
    // Only a completed cat refusal can try the conventional v1 layouts. Never retry a timeout.
    if (error?.code !== 1) throw new Error('diagnostic_resource_limits_unverified');
    for (const cpuPath of ['cpu', 'cpu,cpuacct']) {
      try {
        result = await execute('docker', ['exec', id, 'cat', '/sys/fs/cgroup/memory/memory.limit_in_bytes',
          `/sys/fs/cgroup/${cpuPath}/cpu.cfs_quota_us`, `/sys/fs/cgroup/${cpuPath}/cpu.cfs_period_us`], commandOptions);
      } catch (failure) {
        if (failure?.code === 1) continue;
        throw new Error('diagnostic_resource_limits_unverified');
      }
      return { values: numbers(result.stdout, 3), version: 1 };
    }
    throw new Error('diagnostic_resource_limits_unverified');
  }
  return { values: numbers(result.stdout, 3), version: 2 };
}

/** Offline Linux diagnostics only. Reject unknown limits before admitting fixture work. */
export async function verifyDiagnosticContainerResources(id, { memoryGiB, cpuCount }, { execute = run } = {}) {
  const memoryBytes = memoryGiB * 1024 ** 3, nanoCpus = cpuCount * 1e9;
  if (!validId(id) || typeof memoryGiB !== 'number' || memoryGiB <= 0 || memoryGiB > 2 ||
      typeof cpuCount !== 'number' || cpuCount <= 0 || cpuCount > 2 ||
      !Number.isSafeInteger(memoryBytes) || !Number.isSafeInteger(nanoCpus)) {
    throw new Error('diagnostic_resource_request_invalid');
  }
  let docker, kernel;
  try {
    const result = await execute('docker', ['inspect', id, '--format', '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}'], commandOptions);
    docker = numbers(result.stdout, 2);
    kernel = await readKernelLimits(id, execute);
  } catch { throw new Error('diagnostic_resource_limits_unverified'); }
  const [kernelMemory, quota, period] = kernel.values;
  if (docker[0] !== memoryBytes || docker[1] !== nanoCpus || kernelMemory !== memoryBytes || quota / period !== cpuCount) {
    throw new Error('diagnostic_resource_limits_mismatch');
  }
  return { memoryBytes, cpuCount, cgroupVersion: kernel.version };
}

/** Inspection only: the caller owns stopping its exact container, even after failure. */
export async function assertDiagnosticContainerRemoved(id, { execute = run } = {}) {
  if (!validId(id)) throw new Error('diagnostic_container_id_invalid');
  let result;
  try { result = await execute('docker', ['ps', '-aq', '--filter', `id=${id}`], commandOptions); }
  catch { throw new Error('diagnostic_container_cleanup_unverified'); }
  if (result.stdout.trim()) throw new Error('diagnostic_container_cleanup_failed');
}
