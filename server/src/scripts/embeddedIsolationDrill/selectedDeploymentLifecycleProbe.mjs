/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { runSelectedDeploymentLifecycle } from '../../bootstrap/selectedDeploymentLifecycle.mjs';
import { startSelectedApplication } from '../../bootstrap/embeddedSelectedApplication.mjs';
import { startSelectedRestoreHttp } from '../../bootstrap/embeddedSelectedRestoreHttp.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { validateMigrationReceipt } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { verifySelectedDatabaseShutdown } from '../../bootstrap/embeddedSelectedDatabaseProcess.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';
import { MIGRATION_ROOT, migrationSql } from './identityMigrationDatabase.mjs';
import { waitFor } from '../restoreRecoveryProcess.mjs';
import { boundedJson, fixtureRequest, fixtureSession } from './httpRoutingTransport.mjs';

/** Synthetic caller owns the journal; never an operator command or live converter. */
export async function verifySelectedDeploymentLifecycle() {
  const keyBefore = await readFile('/app/data/secrets/api_key_encryption_key');
  for (const mode of ['normal', 'restore', 'normal']) {
    await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
      const { binding, steps } = await prepareIdentityMigration();
      const processRef = new EventEmitter(), events = [];
      let application, completed = false;
      const launched = start => options => { application = start(options); return application; };
      const run = runSelectedDeploymentLifecycle({ journal, binding, processRef,
        environment: { CLASSIFARR_RUNTIME_MODE: mode, PUID: '1000', PGID: '1000',
          UMASK: process.umask().toString(8).padStart(3, '0'), NODE_OPTIONS: '--max-old-space-size=1536',
          PGVECTOR_RUNTIME_STAGING: 'disabled', CLASSIFARR_POSTGRES_STARTUP_TIMEOUT_SECONDS: '60',
          LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'false' },
        verify: async ({ signal }) => {
          await steps.prepare(validateMigrationReceipt(await journal.read(), binding));
          signal.throwIfAborted(); await steps.verification();
        },
        verifyVectorStaging: async ({ mode: staging, signal }) => {
          assert.equal(staging, 'disabled');
          const configuration = await readFile('/app/data/embedded-postgres/postgresql.conf', 'utf8');
          signal.throwIfAborted();
          assert(!configuration.includes('dynamic_library_path'), 'fixture_vector_staging_not_disabled');
        },
        startNormal: launched(startSelectedApplication), startRestore: launched(startSelectedRestoreHttp),
        report: status => { events.push(status); },
      }).finally(() => { completed = true; });
      // Observe lifecycle rejection immediately, without hiding it from the awaited join.
      run.catch(() => {});
      try {
        await waitFor(async () => {
          assert(!completed, 'deployment_exited_before_ready');
          try {
            const response = await fetch('http://127.0.0.1:21324/health', { signal: AbortSignal.timeout(1000) });
            const health = await boundedJson(response.body);
            return response.ok && (mode === 'restore' ? health.operatingMode === 'restore'
              : health.status === 'healthy' && health.database === 'connected');
          } catch { return false; }
        }, 'deployment_http_ready', 60_000);
        await assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/);
        const session = fixtureSession(await fixtureRequest('/api/auth/login', {
          body: { identifier: 'selected-fixture', password: 'Synthetic-selected-fixture-v1!' },
        }));
        assert.equal((await fixtureRequest('/api/auth/me', { session })).status, 200);
        if (mode === 'restore') {
          assert(!events.includes('maintenance_started'), 'restore_http_ran_schema');
          assert.equal((await fixtureRequest('/api/queue/status', { session })).status, 503);
          const response = await fixtureRequest('/api/backup/import', { session,
            body: { filename: 'classifarr_config_http.enc.json', password: 'synthetic-http-password', mode: 'merge' } });
          assert.equal(response.status, 200); assert.equal(response.body.newApiKey, null);
          assert.equal((await migrationSql("SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1")).stdout.trim(), 'ready');
        } else assert(events.includes('maintenance_completed'), 'normal_http_skipped_schema');
      } finally {
        processRef.emit('SIGTERM');
        assert.equal(await run, 0, 'deployment_shutdown_failed');
      }
      assert(application.hasExited()); assert(events.includes('database_stopped'));
      assert.equal(processRef.listenerCount('SIGTERM'), 0);
      await verifySelectedDatabaseShutdown({ signal: AbortSignal.timeout(5000) });
      await assert.rejects(readFile('/app/data/embedded-postgres/candidate/postmaster.pid'), error => error.code === 'ENOENT');
    });
  }
  assert(keyBefore.equals(await readFile('/app/data/secrets/api_key_encryption_key')));
}
