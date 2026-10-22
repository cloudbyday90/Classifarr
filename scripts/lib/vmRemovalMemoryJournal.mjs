/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectVmRemovalErrorDetail } from './vmRemovalErrorContract.mjs';
import { vmRemovalSimulationLimits as limits, simulationPhases, simulationSteps, simulationField,
  simulationInteger, invalidSimulation, stopSimulation, frozenSimulationCopy } from './vmRemovalSimulationContract.mjs';

export function defaultVmRemovalJournalOptions() {
  return { mode: 'simulation', initialState: 'absent', faultRecord: 0, fault: 'none',
    maxRecords: limits.records, maxRecordBytes: limits.recordBytes, maxBytes: limits.journalBytes };
}
function options(input) {
  const result = {};
  for (const key of ['mode', 'initialState', 'faultRecord', 'fault', 'maxRecords', 'maxRecordBytes', 'maxBytes']) {
    result[key] = simulationField(input, key);
  }
  if (result.mode !== 'simulation' || !['absent', 'existing', 'partial'].includes(result.initialState)
    || !['none', 'write_error', 'short_write', 'flush_error'].includes(result.fault)
    || !simulationInteger(result.faultRecord, 0, limits.records)
    || ((result.fault === 'none') !== (result.faultRecord === 0))) return invalidSimulation();
  for (const [key, max] of [['maxRecords', limits.records], ['maxRecordBytes', limits.recordBytes], ['maxBytes', limits.journalBytes]]) {
    if (!simulationInteger(result[key], 1, max)) return invalidSimulation();
  }
  return result;
}

/** Memory bookkeeping only. Acknowledgements do not perform a write, fsync or OS lock. */
export function createVmRemovalMemoryJournal(input = defaultVmRemovalJournalOptions()) {
  const config = options(input), records = [], claims = new Set();
  let attempted = 0, bytes = 0, poisoned = false;
  const snapshot = () => frozenSimulationCopy({ mode: 'simulation', initialState: config.initialState,
    attempted, committed: records.length, bytes, poisoned, claims: [...claims], records });
  function append(phase, kind, step, identity = null, failure = null) {
    if (!simulationPhases.includes(phase) || !['claim', 'intent', 'identity', 'complete', 'failure'].includes(kind)
      || ![...simulationSteps, 'journal', 'admission'].includes(step)
      || !(identity === null || simulationInteger(identity, 1, 256))) return invalidSimulation();
    if (poisoned) return stopSimulation('journal_poisoned', 'journal');
    if (config.initialState !== 'absent') return stopSimulation('prior_attempt', 'journal');
    // Require a claim for payload records, and reject duplicate claims without appending.
    if (kind === 'claim' ? claims.has(phase) : !claims.has(phase)) return stopSimulation('prior_attempt', 'journal');
    const record = { sequence: records.length + 1, phase, kind, step, identity,
      failure: failure === null ? null : projectVmRemovalErrorDetail(failure) };
    const size = Buffer.byteLength(JSON.stringify(record)) + 1;
    if (records.length >= config.maxRecords || size > config.maxRecordBytes || bytes + size > config.maxBytes) {
      poisoned = true; return stopSimulation('journal_limit', 'journal');
    }
    attempted++;
    if (kind === 'claim') claims.add(phase); // Claim remains consumed even if its write/flush is uncertain.
    if (attempted === config.faultRecord) {
      poisoned = true; return stopSimulation(config.fault, 'journal');
    }
    records.push(record); bytes += size;
    return frozenSimulationCopy(record);
  }
  return Object.freeze({ append, snapshot });
}
