/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { projectShutdownError } from './embeddedShutdownDiagnostics.mjs';

const root = resolve(import.meta.dirname, '../..');
export const SHUTDOWN_DIAGNOSTIC_PATHS = Object.freeze({
  http: '.tmp/ci/embedded-shutdown-diagnostics.json',
  queue: '.tmp/ci/queue-recovery-diagnostics.json',
});

export function saveShutdownReport(mode, report) {
  if (!Object.hasOwn(SHUTDOWN_DIAGNOSTIC_PATHS, mode)) throw new Error('invalid_arguments');
  const path = resolve(root, SHUTDOWN_DIAGNOSTIC_PATHS[mode]);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.partial`, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${path}.partial`, path);
}

/** Diagnostic only: never consumed as release acceptance or published provenance. */
export function createShutdownReport(mode, { env = process.env, save = saveShutdownReport } = {}) {
  const valid = (value, pattern) => typeof value === 'string' && pattern.test(value) ? value : null;
  const report = { schemaVersion: 'classifarr.shutdown-diagnostics.v1', mode, status: 'running',
    startedAt: new Date().toISOString(), completedAt: null,
    sourceRevision: valid(env.GITHUB_SHA, /^[a-f0-9]{40}$/),
    workflow: { runId: valid(env.GITHUB_RUN_ID, /^[1-9][0-9]{0,19}$/),
      runAttempt: valid(env.GITHUB_RUN_ATTEMPT, /^[1-9][0-9]{0,9}$/) },
    attempts: [], failure: null };
  const persist = () => {
    try { save(mode, report); }
    catch { throw new Error('shutdown_diagnostics_write_failed'); }
  };
  persist(); // Fail before Docker work if the initial report cannot be written.
  return {
    update(attempt) {
      const index = report.attempts.findIndex(item => item.resources.container === attempt.resources.container);
      if (index >= 0) report.attempts[index] = attempt;
      else if (report.attempts.length < 4) report.attempts.push(attempt);
      else throw new Error('shutdown_diagnostics_write_failed');
      persist();
    },
    finish(error) {
      report.status = error ? 'failed' : 'passed';
      report.failure = error ? projectShutdownError(error) : null;
      report.completedAt = new Date().toISOString();
      persist();
      return report;
    },
  };
}
