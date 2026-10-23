/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync, realpathSync, statfsSync } from 'node:fs';
import { runVmProbe, VM_PROBE_LIMIT } from './gatewayVmProbe.mjs';
import { isVmRevision, vmCheck, vmPreparationResult } from './gatewayVmPreparation.mjs';
import { captureGuestShutdown } from './gatewayVmShutdown.mjs';

const dockerArgs = ['--host', 'unix:///var/run/docker.sock', 'info', '--format',
  '{"os":{{json .OSType}},"arch":{{json .Architecture}},"cpus":{{json .NCPU}},"cgroup":{{json .CgroupVersion}}}'];
const unavailable = check => ({ check, status: 'unavailable' });

// Stable Node 24 only, including the October 2026 security patch minimum.
function supportsGuestNode(version) {
  const match = typeof version === 'string' && /^24\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) return false;
  const minor = Number(match[1]), patch = Number(match[2]);
  return Number.isSafeInteger(minor) && Number.isSafeInteger(patch)
    && (minor > 22 || (minor === 22 && patch >= 1));
}

/** Run inside the guest checkout, not through a Windows/remote Docker context. */
export function captureGuestPreparation({ root, revision, platform = process.platform, arch = process.arch,
  nodeVersion = process.versions.node, uid = process.getuid?.(), gid = process.getgid?.(), command = runVmProbe,
  canonical = realpathSync, controllers = () => readFileSync('/sys/fs/cgroup/cgroup.controllers', 'utf8'), shutdown = captureGuestShutdown,
  space = path => { const s = statfsSync(path, { bigint: true }); return Number(s.bavail * s.bsize); } } = {}) {
  if (!isVmRevision(revision) || typeof root !== 'string') throw new Error('gateway_vm_arguments_invalid');
  const checks = [vmCheck('linux_x64_controller', platform === 'linux' && arch === 'x64'),
    vmCheck('uid_gid_1000', uid === 1000 && gid === 1000),
    vmCheck('node_24', supportsGuestNode(nodeVersion))];
  if (platform !== 'linux') return vmPreparationResult('guest', [...checks, unavailable('guest_observation')]);
  const read = (file, args) => {
    try { const raw = command(file, args, { cwd: root });
      return typeof raw === 'string' && Buffer.byteLength(raw) < VM_PROBE_LIMIT ? raw.trim() : null;
    } catch { return null; }
  };
  // Do not run a repository/global fsmonitor hook or refresh optional index caches.
  const gitArgs = ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false'];
  const git = read('git', [...gitArgs, 'rev-parse', '--show-toplevel', 'HEAD']);
  const status = read('git', [...gitArgs, 'status', '--porcelain=v1', '--untracked-files=normal']);
  try {
    const lines = git?.split(/\r?\n/);
    checks.push(!lines || lines.length !== 2 || !isVmRevision(lines[1]) || status === null
      ? unavailable('clean_exact_checkout')
      : vmCheck('clean_exact_checkout', lines[1] === revision && canonical(lines[0]) === canonical(root) && status === ''));
  } catch { checks.push(unavailable('clean_exact_checkout')); }

  try {
    const raw = read('docker', dockerArgs), info = raw === null ? null : JSON.parse(raw);
    if (!info || Object.keys(info).sort().join(',') !== 'arch,cgroup,cpus,os'
      || typeof info.os !== 'string' || typeof info.arch !== 'string' || typeof info.cgroup !== 'string'
      || !Number.isSafeInteger(info.cpus)) throw new Error();
    checks.push(vmCheck('local_linux_x64_engine', info.os === 'linux' && ['x86_64', 'amd64'].includes(info.arch)),
      vmCheck('engine_four_cpus', info.cpus === 4), vmCheck('engine_cgroup_v2', info.cgroup === '2'));
  } catch { checks.push(unavailable('local_docker_observation')); }
  try {
    const raw = controllers();
    if (typeof raw !== 'string' || raw.length > 4096 || !/^[a-z_\s]+$/.test(raw)) throw new Error();
    const names = new Set(raw.trim().split(/\s+/));
    checks.push(vmCheck('cgroup_controllers', ['memory', 'cpu', 'pids'].every(name => names.has(name))));
  } catch { checks.push(unavailable('cgroup_controllers')); }
  let filesystemFreeBytes = null;
  try { const bytes = space(root); if (Number.isSafeInteger(bytes) && bytes >= 0) filesystemFreeBytes = bytes; } catch { /* Unknown is not zero. */ }
  checks.push(filesystemFreeBytes === null ? unavailable('filesystem_space_observation')
    : vmCheck('filesystem_space_observation', true));
  try {
    const row = shutdown();
    if (row?.check !== 'guest_shutdown_channel_bound' || !['matched', 'mismatch', 'unavailable'].includes(row.status)) throw new Error();
    checks.push({ check: row.check, status: row.status });
  } catch { checks.push(unavailable('guest_shutdown_channel_bound')); }
  return { ...vmPreparationResult('guest', checks), filesystemFreeBytes };
}
