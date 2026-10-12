/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';

const scopes = new Set(['lint-tooling', 'vue-event-lint', 'csrf-usage']);
const phases = new Set(['eslint-config', 'collect', 'read', 'match', 'assert']);

// Test-only, bounded aggregates: never accept file paths, errors or source text.
export function createTestPhaseDiagnostics(scope, {
  enabled = process.env.CLASSIFARR_TEST_PHASE_DIAGNOSTICS === '1',
  clock = () => process.hrtime.bigint(),
  cpu = () => process.cpuUsage(),
  emit = record => console.info(JSON.stringify(record)),
} = {}) {
  if (!scopes.has(scope)) throw new TypeError('Unknown diagnostic scope');
  const aggregates = new Map();
  const sample = () => ({ time: clock(), cpu: cpu() });
  const elapsed = start => {
    const end = sample();
    return {
      wallMs: Number(end.time - start.time) / 1e6,
      cpuUserUs: end.cpu.user - start.cpu.user,
      cpuSystemUs: end.cpu.system - start.cpu.system,
    };
  };
  const beginPhase = phase => {
    if (!phases.has(phase)) throw new TypeError('Unknown diagnostic phase');
    return sample();
  };
  const endPhase = (phase, start, failed) => {
    const aggregate = aggregates.get(phase) ?? {
      phase, calls: 0, failedCalls: 0, wallMs: 0, cpuUserUs: 0, cpuSystemUs: 0,
    };
    const duration = elapsed(start);
    aggregate.calls += 1;
    aggregate.failedCalls += Number(failed);
    for (const key of ['wallMs', 'cpuUserUs', 'cpuSystemUs']) aggregate[key] += duration[key];
    aggregates.set(phase, aggregate);
  };
  const write = record => {
    // Diagnostic output cannot replace the test's result or original exception.
    try { emit(record); } catch { /* best-effort diagnostics */ }
  };
  let started = false;
  const beginRun = () => {
    if (started) throw new Error('Diagnostic operation already started');
    started = true;
    const identity = {
      event: 'test_phase_diagnostics', schemaVersion: 1,
      id: randomUUID(), scope, pid: process.pid,
    };
    write({ ...identity, type: 'start', at: new Date().toISOString() });
    return { identity, start: sample() };
  };
  const endRun = ({ identity, start }, failed) => write({
    ...identity, type: 'end', at: new Date().toISOString(),
    outcome: failed ? 'threw' : 'returned', total: elapsed(start),
    phases: [...aggregates.values()],
  });

  return {
    measureSync(phase, action) {
      if (!enabled) return action();
      const start = beginPhase(phase);
      let failed = true;
      try { const result = action(); failed = false; return result; }
      finally { endPhase(phase, start, failed); }
    },
    async measureAsync(phase, action) {
      if (!enabled) return action();
      const start = beginPhase(phase);
      let failed = true;
      try { const result = await action(); failed = false; return result; }
      finally { endPhase(phase, start, failed); }
    },
    runSync(action) {
      if (!enabled) return action();
      const run = beginRun();
      let failed = true;
      try { const result = action(); failed = false; return result; }
      finally { endRun(run, failed); }
    },
    async runAsync(action) {
      if (!enabled) return action();
      const run = beginRun();
      let failed = true;
      try { const result = await action(); failed = false; return result; }
      finally { endRun(run, failed); }
    },
  };
}
