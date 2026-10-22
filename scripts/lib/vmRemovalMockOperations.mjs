/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SimulationStop, stopSimulation, vmRemovalSimulationLimits as limits,
  simulationSteps, invalidSimulation } from './vmRemovalSimulationContract.mjs';

/** An owned data interpreter, not an injectable executor or native adapter. */
export function createVmRemovalMockOperations() {
  let calls = 0, observations = 0, drivesValidated = 0;
  const trace = [], effects = { create_disk: 0, create_vm: 0, configure_vm: 0, remove_vm: 0 };
  function call(step, scenario) {
    if (!simulationSteps.includes(step)) return invalidSimulation();
    if (calls >= limits.calls) return stopSimulation('call_limit', step);
    calls++;
    trace.push(step);
    if (Object.hasOwn(effects, step)) effects[step]++;
    const fault = scenario.faults.find(row => row.step === step);
    if (fault) throw new SimulationStop(fault.outcome, step, fault.detail, fault.projectionFailed);
  }
  function observe(step, scenario, fixturePresent, diskId, vmId) {
    if (observations >= limits.observations) return stopSimulation('observation_limit', step);
    call(step, scenario);
    observations++;
    if (scenario.sourceRevision !== 1) return stopSimulation('source_changed', step);
    if (!scenario.inventoryComplete) return stopSimulation('observation_incomplete', step);
    if (scenario.referenceCoverage !== 'synthetic_complete') return stopSimulation('references_unsupported', step);
    if (scenario.inventory.length + (fixturePresent ? 1 : 0) > limits.vms) return stopSimulation('inventory_limit', step);
    const ids = new Set(); let count = 0;
    for (const row of scenario.inventory) {
      if (!row.id || ids.has(row.id) || (fixturePresent && row.id === vmId)) return stopSimulation('inventory_identity', step);
      ids.add(row.id); count += row.disks.length;
      if (row.disks.length > limits.drives || count > limits.combinedDrives) return stopSimulation('inventory_limit', step);
      if (row.disks.some(id => !id)) return stopSimulation('inventory_identity', step);
      if (row.disks.includes(diskId)) return stopSimulation('foreign_reference', step);
    }
    drivesValidated += count;
  }
  const snapshot = () => ({ calls, observations, drivesValidated, trace: [...trace], effects: { ...effects } });
  return Object.freeze({ call, observe, snapshot });
}
