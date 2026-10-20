/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { isVmGuid, isVmUuidv7, vmCheck, vmPreparationResult } from './gatewayVmPreparation.mjs';
import { exactVmKeys } from './gatewayVmJobContract.mjs';

export const VM_HANDOFF_BYTES = 4096;
export const unavailableVmHandoff = () => vmPreparationResult('handoff', [{ check: 'handoff_record', status: 'unavailable' }]);

function privateLiteral(value) {
  if (typeof value !== 'string' || value.length > 45) return false;
  if (isIP(value) === 4) {
    const [a, b] = value.split('.').map(Number);
    return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
  }
  return isIP(value) === 6 && /^(?:fc|fd)[0-9a-f:]+$/i.test(value);
}

function consistentKey(key, fingerprint) {
  if (typeof key !== 'string' || key.length !== 80 || typeof fingerprint !== 'string' || fingerprint.length !== 50) return false;
  const match = /^ssh-ed25519 ([A-Za-z0-9+/]{68})$/.exec(key);
  if (!match) return false;
  const wire = Buffer.from(match[1], 'base64');
  return wire.length === 51 && wire.toString('base64') === match[1]
    && wire.readUInt32BE(0) === 11 && wire.subarray(4, 15).equals(Buffer.from('ssh-ed25519'))
    && wire.readUInt32BE(15) === 32 && wire.subarray(19).some(byte => byte !== 0)
    && fingerprint === `SHA256:${createHash('sha256').update(wire).digest('base64').replace(/=+$/, '')}`;
}

/** Format/intent checks only. Neither a record nor its matching hash authenticates a host. */
export function assessVmHandoff(text, { vmId, switchId }) {
  if (!isVmGuid(vmId) || !isVmGuid(switchId)) throw new Error('gateway_vm_arguments_invalid');
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text) > VM_HANDOFF_BYTES) return unavailableVmHandoff();
    const normalized = text.replace(/\r\n/g, '\n'), value = JSON.parse(normalized);
    const forms = [JSON.stringify(value), JSON.stringify(value, null, 2)];
    if (!forms.some(form => normalized === form || normalized === `${form}\n`)
      || !exactVmKeys(value, 'version handoffId vmId switchId ssh') || value.version !== 1
      || !isVmUuidv7(value.handoffId) || !isVmGuid(value.vmId) || !isVmGuid(value.switchId)
      || !exactVmKeys(value.ssh, 'address port user hostKey hostKeyFingerprint')
      || !privateLiteral(value.ssh.address) || !Number.isSafeInteger(value.ssh.port) || value.ssh.port < 1 || value.ssh.port > 65535
      || typeof value.ssh.user !== 'string' || value.ssh.user.length > 32 || value.ssh.user === 'root'
      || !/^[a-z_][a-z0-9_-]*$/.test(value.ssh.user) || /[\r\n]/.test(value.ssh.user)
      || !consistentKey(value.ssh.hostKey, value.ssh.hostKeyFingerprint)) return unavailableVmHandoff();
    return vmPreparationResult('handoff', [vmCheck('handoff_format', true),
      vmCheck('handoff_selected_vm', value.vmId.toLowerCase() === vmId.toLowerCase()),
      vmCheck('handoff_selected_switch', value.switchId.toLowerCase() === switchId.toLowerCase()),
      vmCheck('ssh_host_key_fingerprint_consistent', true)]);
  } catch { return unavailableVmHandoff(); }
}
