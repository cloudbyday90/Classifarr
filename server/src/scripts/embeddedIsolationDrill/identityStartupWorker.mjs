/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { runSelectedEmbeddedStartup } from '../../bootstrap/embeddedSelectedStartup.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { validateMigrationReceipt } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT, migrationSql } from './identityMigrationDatabase.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';
import { createSelectedEmbeddedDatabase } from '../../bootstrap/embeddedSelectedDatabase.mjs';
import { launchSelectedDatabase, verifySelectedDatabaseShutdown } from '../../bootstrap/embeddedSelectedDatabaseProcess.mjs';
import { provisionEmbeddedApplicationLayout } from '../../bootstrap/embeddedApplicationLayout.mjs';
import { selectedRuntimeComposition } from '../../bootstrap/embeddedSelectedRuntimeComposition.mjs';
import { readEmbeddedAccounts, requireSeparatedEmbeddedAccounts } from '../../bootstrap/embeddedIdentityPolicy.mjs';
import { encryptBackupPayload } from '../../services/backupCipher.mjs';
import { verifySelectedApplication } from './identityApplicationProbe.mjs';
import { prepareSelectedConfigurationProfile } from './selectedConfigurationProbe.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert(process.argv.length === 2 || (process.argv.length === 3
  && ['--signal', '--cancel-start', '--restore', '--custom-file', '--custom-environment'].includes(process.argv[2])));
const wait = process.argv[2] === '--signal';
const cancelStartup = process.argv[2] === '--cancel-start';
const restore = process.argv[2] === '--restore';
const custom = process.argv[2]?.startsWith('--custom-');
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
  const { binding, steps } = await prepareIdentityMigration({ journal });
  const identities = requireSeparatedEmbeddedAccounts(readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')));
  const password = randomBytes(32).toString('hex');
  const request = restore ? Buffer.from(JSON.stringify({ version: 1, mode: 'merge', password,
    backup: { encrypted: true, data: encryptBackupPayload({ version: '2.0',
      data: { settings: [{ key: 'selected_dispatch_restore_probe', value: 'restored' }] } }, password) } })) : null;
  const profile = custom ? await prepareSelectedConfigurationProfile(process.argv[2].slice('--custom-'.length)) : null;
  const composition = selectedRuntimeComposition({ mode: restore ? 'restore' : 'normal', identities, request,
    configuration: restore ? {} : profile?.configuration ?? { LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'false' } });
  let applicationCheck;
  let launched;
  const database = createSelectedEmbeddedDatabase({ launch: account => {
    launched = launchSelectedDatabase(account);
    // Real process, real host signal after launch, before admission completes.
    if (cancelStartup) queueMicrotask(() => process.kill(process.pid, 'SIGTERM'));
    return launched;
  } });
  let code;
  try { code = await runSelectedEmbeddedStartup({ journal, binding,
    verify: async ({ signal }) => {
      await steps.prepare(validateMigrationReceipt(await journal.read(), binding));
      signal.throwIfAborted();
      await steps.verification();
      await provisionEmbeddedApplicationLayout({ signal });
    },
    database: { ...database, stop: async () => {
      if (restore) {
        assert.equal((await migrationSql("SELECT value FROM settings WHERE key='selected_dispatch_restore_probe'")).stdout.trim(), 'restored');
        assert.equal((await migrationSql("SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1")).stdout.trim(), 'ready');
        assert.equal((await migrationSql("SELECT count(*) FROM pg_stat_activity WHERE usename='cf_runtime'")).stdout.trim(), '0');
      }
      await database.stop();
    } },
    ...composition,
    startMaintenance: () => {
      const maintenance = composition.startMaintenance();
      if (!profile) return maintenance;
      return { ...maintenance, done: maintenance.done.then(async result => {
        if (result.code === 0 && result.signal === null) await profile.prepareFileFallback();
        return result;
      }) };
    },
    startApplication: restore ? null : () => {
      assert(!cancelStartup);
      const application = composition.startApplication();
      applicationCheck = verifySelectedApplication(application, identities.database, { custom }).then(() => {
        if (wait) process.stdout.write('selected-startup-ready\n');
        else application.signal('SIGTERM');
      });
      applicationCheck.catch(() => application.signal('SIGKILL'));
      return application;
    },
  }); } finally { request?.fill(0); }
  await applicationCheck;
  await profile?.verifyPreserved();
  assert.equal(code, cancelStartup ? 1 : 0, 'selected_startup_failed');
  if (cancelStartup) {
    assert(launched?.hasExited(), 'cancelled_database_child_not_joined');
    await verifySelectedDatabaseShutdown({ signal: AbortSignal.timeout(5000) });
    await assert.rejects(readFile('/app/data/embedded-postgres/candidate/postmaster.pid'), error => error.code === 'ENOENT');
  }
  // Even after the supervisor stopped PG, this caller still owns the lease.
  await assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/);
});
process.stdout.write('selected-startup-passed\n');
