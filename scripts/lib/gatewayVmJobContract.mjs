/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isVmGuid } from './gatewayVmPreparation.mjs';

// Model deadlines, not a production executor configuration or a power-off timer.
export const VM_JOB_DEADLINES = Object.freeze({ inspect: 10000, starting: 120000,
  readiness: 180000, work: 4 * 60 * 60 * 1000, drain: 120000, confirm: 10000, stopping: 120000 });
export const VM_JOB_MAX_OBSERVATIONS = 64;
const uuidv7 = value => typeof value === 'string' && value.length === 36
  && /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const digest = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
export function exactVmKeys(value, names) {
  const expected = names === '' ? [] : names.split(' ');
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}

export function requireVmJobBinding(value) {
  if (!exactVmKeys(value, 'mode jobId vmId configDigest ownerToken') || value.mode !== 'simulation'
    || !uuidv7(value.jobId) || !uuidv7(value.ownerToken) || !isVmGuid(value.vmId) || !digest(value.configDigest)) {
    throw new Error('gateway_vm_job_binding_invalid');
  }
  return Object.freeze({ ...value });
}

export function matchesVmJobObservation(value, binding, sequence) {
  return exactVmKeys(value, 'jobId vmId configDigest ownerToken sequence bootId power exclusive kind details')
    && ['jobId', 'vmId', 'configDigest', 'ownerToken'].every(key => value[key] === binding[key])
    && Number.isSafeInteger(value.sequence) && value.sequence === sequence + 1
    && value.exclusive === true && typeof value.kind === 'string'
    && ['Off', 'Running', 'Saved', 'Paused', 'Unknown'].includes(value.power)
    && (value.bootId === null || isVmGuid(value.bootId));
}
