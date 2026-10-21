/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { win32, join } from 'node:path';
import { registryCommand } from './registryCommand.mjs';
import { isVmGuid, requireGatewayVmProfile } from './gatewayVmPreparation.mjs';
import { vmCreationQuery, VM_CREATION_REASONS } from './gatewayVmCreationQuery.mjs';

export const VM_CREATION_TIMEOUT_MS = 15 * 60 * 1000;
export const VM_CREATION_MAX_BYTES = 64 * 1024;
// Fixed bootstrap avoids Windows' command-line length limit. Only our fixed script
// and base64 JSON data enter stdin; no caller-supplied command/script is accepted.
export const VM_CREATION_BOOTSTRAP = '& ([ScriptBlock]::Create([Console]::In.ReadToEnd()))';
const name = 'Classifarr-Study';
const stages = ['preflight', 'permissions', 'capacity', 'collisions', 'directories', 'disk', 'vm', 'settings', 'verify'];

function parentPath(value) {
  if (typeof value !== 'string' || value.length > 180 || /[\x00-\x1f\x7f]/.test(value) || !/^[a-z]:\\[a-z0-9 ._()\\-]+$/i.test(value)
    || win32.normalize(value) !== value || value.endsWith('\\')) throw new Error('gateway_vm_creation_arguments_invalid');
  const segments = value.slice(3).split('\\');
  if (segments.length > 28 || segments.some(part => !part || /[. ]$/.test(part)
    || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('gateway_vm_creation_arguments_invalid');
  return value;
}

export function planVmCreation({ vmParent, diskParent }) {
  const profile = requireGatewayVmProfile();
  vmParent = parentPath(vmParent); diskParent = parentPath(diskParent);
  const a = vmParent.toLowerCase(), b = diskParent.toLowerCase();
  if (a === b || a.startsWith(`${b}\\`) || b.startsWith(`${a}\\`)) throw new Error('gateway_vm_creation_arguments_invalid');
  return Object.freeze({ name, vmParent, diskParent, vmDirectory: win32.join(vmParent, name),
    diskDirectory: win32.join(diskParent, name), diskFile: win32.join(diskParent, name, `${name}.vhdx`),
    cpus: profile.cpus, memoryBytes: profile.memoryBytes, diskBytes: profile.diskBytes,
    generation: profile.generation, automaticStartAction: profile.automaticStartAction,
    automaticStopAction: profile.automaticStopAction });
}

function result(status, stage, mutationAttempted, vmId, reasonCode) {
  return { version: 1, status, stage, mutationAttempted, ...(vmId ? { vmId } : {}),
    ...(reasonCode ? { reasonCode } : {}),
    automaticRetry: false, studyReady: false, handoffAuthenticated: false };
}

/** Invoked once by an administrator. No retries, elevation, deletion or VM power operations. */
export async function createStudyVm(parents, { platform = process.platform, systemRoot = process.env.SystemRoot,
  env = process.env, signal, command = registryCommand } = {}) {
  const plan = planVmCreation(parents);
  if (platform !== 'win32' || typeof systemRoot !== 'string' || !/^[a-z]:\\[a-z0-9 ._()\\-]+$/i.test(systemRoot)
    || /[\x00-\x1f\x7f]/.test(systemRoot) || win32.normalize(systemRoot) !== systemRoot) return result('blocked', 'platform', false);
  if (signal?.aborted) return result('blocked', 'cancelled_before_start', false);
  const childEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^(?:systemroot|windir|systemdrive|temp|tmp|userprofile|localappdata|appdata|programfiles|programfiles\(x86\)|programw6432|comspec|pathext|path|allusersprofile|programdata)$/i.test(key)) {
      childEnv[key] = value;
    }
  }
  childEnv.PSModulePath = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules');
  const query = vmCreationQuery(plan);
  let captured;
  try {
    captured = await command(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(VM_CREATION_BOOTSTRAP, 'utf16le').toString('base64')],
      { input: query, env: childEnv, signal, timeoutMs: VM_CREATION_TIMEOUT_MS, maxBytes: VM_CREATION_MAX_BYTES });
    if (captured?.ok !== true || captured.timedOut || captured.outputLimited || captured.cancelled || signal?.aborted
      || typeof captured.stdout !== 'string' || Buffer.byteLength(captured.stdout) >= VM_CREATION_MAX_BYTES
      || typeof captured.stderr !== 'string' || captured.stderr.trim() !== '') throw new Error();
    const v = JSON.parse(captured.stdout.trim().replace(/^\uFEFF/, ''));
    if (v && !Array.isArray(v) && Object.keys(v).sort().join(',') === 'mutationAttempted,stage,status,vmId'
      && v.status === 'created_off' && v.stage === 'verify' && v.mutationAttempted === true && isVmGuid(v.vmId)) {
      return result('created_off', 'verify', true, v.vmId.toLowerCase());
    }
    if (v && !Array.isArray(v) && Object.keys(v).sort().join(',') === 'mutationAttempted,reasonCode,stage,status'
      && VM_CREATION_REASONS.includes(v.reasonCode)
      && stages.includes(v.stage) && typeof v.mutationAttempted === 'boolean'
      && ((v.status === 'blocked' && v.mutationAttempted === false && stages.indexOf(v.stage) < 4)
        || (v.status === 'review_required' && v.mutationAttempted === true && stages.indexOf(v.stage) >= 4))) {
      return result(v.status, v.stage, v.mutationAttempted, undefined, v.reasonCode);
    }
  } catch { /* The service may have accepted a write. Suppress all raw output and exceptions. */ }
  return result('review_required', captured?.cancelled ? 'cancelled' : captured?.timedOut ? 'timeout' : 'capture', true);
}
