/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { startSelectedRestoreHttp } from '../../bootstrap/embeddedSelectedRestoreHttp.mjs';
import { readEmbeddedAccounts, requireSeparatedEmbeddedAccounts } from '../../bootstrap/embeddedIdentityPolicy.mjs';
import { waitFor } from '../restoreRecoveryProcess.mjs';
import { fixtureRequest, fixtureSession } from './httpRoutingTransport.mjs';
import { withBlocker } from './identityMaintenanceProbe.mjs';
import { MIGRATION_ROOT, candidateStart, candidateStop, migrationCommand, migrationSql } from './identityMigrationDatabase.mjs';

/** Guarded caller has an isolated, selected database; all data here is synthetic. */
export async function verifySelectedRestoreHttp() {
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {
    const identities = requireSeparatedEmbeddedAccounts(readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')));
    await candidateStart();
    let app;
    const scalar = async sql => (await migrationSql(sql)).stdout.trim();
    try {
      await migrationCommand('classifarr', 'node', ['--input-type=module', '-e', `
        import { writeFile, symlink } from 'node:fs/promises';
        import { encryptBackupPayload } from './src/services/backupCipher.mjs';
        await writeFile('/app/data/backups/classifarr_config_http.enc.json', JSON.stringify({encrypted:true,
          data:encryptBackupPayload({version:'2.0',data:{settings:[{key:'selected_http_restore_probe',value:'restored'}]}},'synthetic-http-password')}),{flag:'wx',mode:0o600});
        await symlink('/app/data/secrets/api_key_encryption_key','/app/data/backups/classifarr_config_symlink.json');
      `]);
      const keyBefore = await readFile('/app/data/secrets/api_key_encryption_key');
      const cipherBefore = await scalar("SELECT key_hash FROM api_keys WHERE name='selected-configuration-fixture'");
      const receipts = Number(await scalar('SELECT count(*) FROM policy_backup_restore_verifications'));
      const events = [];
      const launch = () => startSelectedRestoreHttp({ identities, configuration: { LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'false' },
        onFatal: () => { throw new Error('fixture_restore_worker_not_joined'); }, report: status => events.push(status) });
      const ready = () => waitFor(async () => {
        assert(!app.hasExited(), 'selected_restore_http_exited');
        try { const response = await fetch('http://127.0.0.1:21324/health', { signal: AbortSignal.timeout(1000) });
          return response.ok && (await response.json()).operatingMode === 'restore'; } catch { return false; }
      }, 'selected_restore_http_ready', 30_000);
      app = launch(); await ready();
      assert.equal((await fixtureRequest('/api/backup/list')).status, 401);
      const login = await fixtureRequest('/api/auth/login', { body: { identifier: 'selected-fixture', password: 'Synthetic-selected-fixture-v1!' } });
      let session = fixtureSession(login);
      assert.equal((await fixtureRequest('/api/queue/status', { session })).status, 503);
      const body = { filename: 'classifarr_config_http.enc.json', password: 'synthetic-http-password', mode: 'merge' };
      assert.equal((await fixtureRequest('/api/backup/import', { session: { cookie: session.cookie }, body })).status, 403);
      assert.equal((await fixtureRequest('/api/backup/preview', { session, body: { ...body, filename: 'classifarr_config_symlink.json' } })).status, 400);
      assert.equal((await fixtureRequest('/api/backup/preview', { session, body: { ...body, password: 'incorrect' } })).status, 400);
      assert.equal((await fixtureRequest('/api/backup/preview', { session, body })).status, 200);
      const listing = await fixtureRequest('/api/backup/list', { session });
      assert.equal(listing.status, 200);
      assert(!listing.body.backups.some(row => row.filename.includes('symlink')));
      assert.equal(events.length, 0, 'worker_started_before_authorized_import');
      const peers = Number(await scalar("SELECT count(*) FROM pg_stat_activity WHERE datname='classifarr' AND usename='cf_runtime'"));
      assert(peers > 0 && peers <= 5, 'restore_web_database_identity_missing');
      await withBlocker('settings', async () => {
        const pending = fixtureRequest('/api/backup/import', { session, body }).catch(() => null);
        await waitFor(async () => {
          assert(!app.hasExited(), 'restore_http_exited_before_fault');
          return await scalar("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'INSERT INTO settings%'") === '1';
        }, 'restore_http_worker_blocked', 10_000);
        app.signal('SIGKILL');
        assert.equal((await app.done).signal, 'SIGKILL');
        await pending;
      });
      assert.equal(await scalar("SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1"), 'restore_in_progress');
      assert.equal(Number(await scalar('SELECT count(*) FROM policy_backup_restore_verifications')), receipts);
      assert.equal(await scalar("SELECT count(*) FROM settings WHERE key='selected_http_restore_probe'"), '0');
      app = launch(); await ready();
      session = fixtureSession(await fixtureRequest('/api/auth/login', { body: { identifier: 'selected-fixture', password: 'Synthetic-selected-fixture-v1!' } }));
      const response = await fixtureRequest('/api/backup/import', { session, body });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.newApiKey, null);
      assert.equal(await scalar("SELECT value FROM settings WHERE key='selected_http_restore_probe'"), 'restored');
      assert.equal(await scalar("SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1"), 'ready');
      assert.equal(Number(await scalar('SELECT count(*) FROM policy_backup_restore_verifications')), receipts + 1);
      assert.equal((await fixtureRequest('/api/backup/import', { session, body })).status, 503);
      assert.deepEqual(events, ['started', 'unavailable', 'started', 'complete']);
      assert(keyBefore.equals(await readFile('/app/data/secrets/api_key_encryption_key')));
      assert.equal(await scalar("SELECT key_hash FROM api_keys WHERE name='selected-configuration-fixture'"), cipherBefore);
      app.signal('SIGTERM'); assert.deepEqual(await app.done, { code: 0, signal: null });
      assert.equal(await scalar("SELECT count(*) FROM pg_stat_activity WHERE usename='cf_runtime'"), '0');
    } finally {
      if (app && !app.hasExited()) app.signal('SIGKILL');
      if (app) await app.done;
      await candidateStop();
    }
  });
}
