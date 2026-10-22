/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isProxy } from 'node:util/types';
import { emptyVmRemovalErrorDetail, projectVmRemovalErrorDetail } from './vmRemovalErrorContract.mjs';

export const vmRemovalSimulationLimits = Object.freeze({ records: 16, recordBytes: 65536,
  journalBytes: 524288, outputBytes: 65536, observations: 6, calls: 16, vms: 128, drives: 64, combinedDrives: 1024 });
export const simulationPhases = Object.freeze(['create', 'inspect', 'remove']);
export const simulationSteps = Object.freeze(['observe_initial', 'create_disk', 'create_vm', 'configure_vm',
  'observe_created', 'observe_inspect', 'observe_remove', 'observe_remove_final', 'remove_vm', 'observe_absence', 'dispose']);
const outcomes = ['error', 'timeout', 'cancelled', 'capture_failed', 'source_changed', 'identity_changed'];
export const invalidSimulation = () => { throw new Error('vm_removal_simulation_invalid'); };
export const simulationInteger = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;

// No object expansion, getters, proxy traps or enumeration of unknown private extras.
export function simulationField(value, key, isArray = false) {
  if (!value || typeof value !== 'object' || isProxy(value)) return invalidSimulation();
  const proto = Object.getPrototypeOf(value);
  if (isArray ? !Array.isArray(value) || proto !== Array.prototype
    : Array.isArray(value) || (proto !== null && proto !== Object.prototype)) return invalidSimulation();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return invalidSimulation();
  return descriptor.value;
}
export function simulationArray(value, max) {
  const length = simulationField(value, 'length', true);
  if (!simulationInteger(length, 0, max)) return invalidSimulation();
  return Array.from({ length }, (_, i) => simulationField(value, String(i), true));
}
export function unavailableSimulationError() {
  return { ...emptyVmRemovalErrorDetail(), status: 'unavailable', projectionFailed: true };
}
export class SimulationStop extends Error {
  constructor(reason, step, detail = unavailableSimulationError(), projectionFailed = false) {
    super('vm_removal_simulation_stopped');
    this.reason = reason; this.step = step; this.detail = detail; this.projectionFailed = projectionFailed;
  }
}
export const stopSimulation = (reason, step) => { throw new SimulationStop(reason, step); };
/** Internal owned DTOs only; this copier is not a sanitizer for arbitrary caller objects. */
export const frozenSimulationCopy = value => {
  const copied = JSON.parse(JSON.stringify(value));
  function freeze(item) {
    if (item !== null && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); }
  }
  freeze(copied); return copied;
};

/** Defaults contain fictional integer handles, never a native identity or path. */
export function successfulVmRemovalScenario() {
  return { mode: 'simulation', sourceRevision: 1, inventoryComplete: true,
    referenceCoverage: 'synthetic_complete', inventory: [{ id: 1, disks: [1] }, { id: 2, disks: [2] }],
    nameAbsent: true, rootAbsent: true, returnedDisk: 201, returnedVm: 201, observedDisk: 201, observedVm: 201,
    off: true, disconnected: true, startupDisabled: true, checkpoints: 0,
    diskUnchanged: true, treeUnchanged: true, vmAbsent: true, faults: [] };
}
export function requireVmRemovalScenario(input) {
  if (simulationField(input, 'mode') !== 'simulation') return invalidSimulation();
  const booleans = ['inventoryComplete', 'nameAbsent', 'rootAbsent', 'off', 'disconnected', 'startupDisabled',
    'diskUnchanged', 'treeUnchanged', 'vmAbsent'];
  const result = { mode: 'simulation' };
  for (const key of booleans) {
    const v = simulationField(input, key); if (typeof v !== 'boolean') return invalidSimulation(); result[key] = v;
  }
  for (const key of ['sourceRevision', 'returnedDisk', 'returnedVm', 'observedDisk', 'observedVm', 'checkpoints']) {
    const v = simulationField(input, key); if (!simulationInteger(v, 0, 256)) return invalidSimulation(); result[key] = v;
  }
  const coverage = simulationField(input, 'referenceCoverage');
  if (!['synthetic_complete', 'configured_only', 'unsupported'].includes(coverage)) return invalidSimulation();
  result.referenceCoverage = coverage;
  result.inventory = simulationArray(simulationField(input, 'inventory'), 129).map(row => {
    const id = simulationField(row, 'id'); if (!simulationInteger(id, 0, 256)) return invalidSimulation();
    const disks = simulationArray(simulationField(row, 'disks'), 65);
    if (disks.some(v => !simulationInteger(v, 0, 256))) return invalidSimulation();
    return { id, disks };
  });
  const seen = new Set();
  result.faults = simulationArray(simulationField(input, 'faults'), simulationSteps.length).map(row => {
    const step = simulationField(row, 'step'), outcome = simulationField(row, 'outcome');
    if (!simulationSteps.includes(step) || !outcomes.includes(outcome) || seen.has(step)) return invalidSimulation();
    seen.add(step);
    let detail, projectionFailed = false;
    try {
      detail = projectVmRemovalErrorDetail(simulationField(row, 'detail'));
      if (detail.status === 'none') { detail = unavailableSimulationError(); projectionFailed = true; }
    } catch { detail = unavailableSimulationError(); projectionFailed = true; }
    return { step, outcome, detail, projectionFailed };
  });
  return frozenSimulationCopy(result);
}
