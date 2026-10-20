/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import profile from '../fixtures/gateway-hyperv-profile.json' with { type: 'json' };

const expected = {
  version: 1, hypervisor: 'hyperv', generation: 2, cpus: 4, memoryBytes: 8589934592,
  dynamicMemory: false, diskBytes: 68719476736, diskType: 'Fixed', diskFormat: 'VHDX',
  switchType: 'Internal', access: 'host-only-key-based-ssh', measurementInternet: false,
  controller: 'guest-local-linux-x64-uid-gid-1000',
};
export function requireGatewayVmProfile(value = profile) {
  try { assert.deepEqual(value, expected); } catch { throw new Error('gateway_vm_profile_invalid'); }
  return Object.freeze({ ...expected });
}

export const isVmGuid = value => typeof value === 'string'
  && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export const isVmRevision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function vmPreparationResult(mode, checks) {
  return { version: 1, mode, status: checks.some(row => row.status === 'unavailable') ? 'unavailable'
    : checks.some(row => row.status === 'mismatch') ? 'mismatch' : 'matched', checks, studyReady: false,
  remaining: ['administrator_identity_and_network_review', 'native_guest_image_qualification',
    'windows_and_guest_interference_guards', 'separate_study_approval'] };
}

export const vmCheck = (check, matches) => ({ check, status: matches ? 'matched' : 'mismatch' });

function keys(value, names) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === names.split(' ').sort().join(',');
}

/** Private observation from the fixed PowerShell query; never publish raw fields. */
export function assessHypervConfiguration(value, { vmId, switchId }) {
  const p = requireGatewayVmProfile();
  if (!isVmGuid(vmId) || !isVmGuid(switchId)) throw new Error('gateway_vm_arguments_invalid');
  if (!keys(value, 'vmId generation cpus memoryBytes dynamicMemory disks adapters switchId switchType checkpoints')
    || !isVmGuid(value.vmId) || !isVmGuid(value.switchId)
    || !Number.isSafeInteger(value.generation) || !Number.isSafeInteger(value.cpus)
    || !Number.isSafeInteger(value.memoryBytes) || typeof value.dynamicMemory !== 'boolean'
    || !Number.isSafeInteger(value.checkpoints) || value.checkpoints < 0
    || !Array.isArray(value.disks) || value.disks.length > 8
    || !Array.isArray(value.adapters) || value.adapters.length > 8
    || typeof value.switchType !== 'string'
    || !value.disks.every(disk => keys(disk, 'size type format parent') && Number.isSafeInteger(disk.size)
      && typeof disk.type === 'string' && typeof disk.format === 'string' && typeof disk.parent === 'boolean')
    || !value.adapters.every(adapter => keys(adapter, 'switchId') && isVmGuid(adapter.switchId))) {
    return vmPreparationResult('host', [{ check: 'hyperv_observation', status: 'unavailable' }]);
  }
  return vmPreparationResult('host', [
    vmCheck('selected_vm', value.vmId.toLowerCase() === vmId.toLowerCase()),
    vmCheck('generation', value.generation === p.generation), vmCheck('cpus', value.cpus === p.cpus),
    vmCheck('static_memory', value.memoryBytes === p.memoryBytes && value.dynamicMemory === p.dynamicMemory),
    vmCheck('fixed_disk', value.disks.length === 1 && value.disks[0].size === p.diskBytes
      && value.disks[0].type === p.diskType && value.disks[0].format === p.diskFormat && !value.disks[0].parent),
    vmCheck('selected_internal_switch', value.switchId.toLowerCase() === switchId.toLowerCase()
      && value.switchType === p.switchType && value.adapters.length === 1
      && value.adapters[0].switchId.toLowerCase() === switchId.toLowerCase()),
    vmCheck('no_checkpoints', value.checkpoints === 0),
  ]);
}
