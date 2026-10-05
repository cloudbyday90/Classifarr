/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { createMigrationDiagnosticStore } from './migrationDiagnosticStore.mjs';
import { diagnosticSchema, DIAGNOSTIC_LIMITATIONS, DIAGNOSTIC_STEPS, MAX_DIAGNOSTIC_BYTES, migrationTargetHash, sanitizeMigrationError } from './migrationDiagnosticContract.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('MigrationDiagnostics');

/** Observation only. Never changes the result or admission rules of maintenance. */
export function createMigrationDiagnostics({ environment = process.env, store = createMigrationDiagnosticStore({ environment }), now = () => new Date(), enabled = environment.NODE_ENV !== 'test' } = {}) {
  return {
    async run(operation) {
      const attemptId = randomUUID();
      const startedAt = now().toISOString();
      const events = [];
      let sequence = 0;
      let omittedEvents = 0;
      let hadFailure = false;
      function record(step, details = {}) {
        // Only internal structured values are accepted; raw messages/SQL never enter this trace.
        if (!DIAGNOSTIC_STEPS.includes(step)) return;
        const event = { sequence: sequence++, at: now().toISOString(), step };
        if (details.migration) event.migration = details.migration;
        if (details.contentHash) event.contentHash = details.contentHash;
        if (details.error) {
          Object.assign(event, sanitizeMigrationError(details.error));
          hadFailure = true;
        }
        events.push(event);
        if (events.length > 512) { events.shift(); omittedEvents++; }
      }
      async function persist(outcome) {
        if (!enabled || !hadFailure) return;
        try {
          const report = {
            version: 1, attemptId, targetHash: migrationTargetHash(environment), startedAt,
            finishedAt: now().toISOString(), outcome,
            runtime: { node: process.version, platform: ['linux', 'win32', 'darwin'].includes(process.platform) ? process.platform : 'other', arch: ['x64', 'arm64'].includes(process.arch) ? process.arch : 'other',
              sourceRevision: /^[a-f0-9]{40}$/.test(environment.CLASSIFARR_BUILD_REVISION || '') ? environment.CLASSIFARR_BUILD_REVISION : 'unknown' },
            events, omittedEvents, limitations: DIAGNOSTIC_LIMITATIONS,
          };
          while (Buffer.byteLength(JSON.stringify(report, null, 2) + '\n') > MAX_DIAGNOSTIC_BYTES && events.length > 1) {
            events.shift(); report.omittedEvents++;
          }
          await store.write(diagnosticSchema.parse(report));
          logger.warn('Migration diagnostic report saved', { attemptId, outcome });
        } catch {
          logger.warn('Migration diagnostic report could not be saved; original failure is unchanged', { attemptId });
        }
      }
      record('attempt_started');
      try {
        const result = await operation(record);
        record('attempt_complete');
        await persist('recovered');
        return result;
      } catch (error) {
        record('attempt_failed', { error });
        await persist('failed');
        throw error;
      }
    },
  };
}
