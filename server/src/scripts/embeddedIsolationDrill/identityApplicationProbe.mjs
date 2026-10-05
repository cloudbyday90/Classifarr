/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { waitFor } from '../restoreRecoveryProcess.mjs';
import { boundedJson, fixtureRequest, fixtureSession } from './httpRoutingTransport.mjs';
import { migrationSql } from './identityMigrationDatabase.mjs';
import { startSelectedMaintenance } from '../../bootstrap/embeddedSelectedMaintenance.mjs';
import { verifySelectedConfigurationHttp } from './selectedConfigurationProbe.mjs';

/** Real packaged application, fixed loopback HTTP, synthetic credentials only. */
export async function verifySelectedApplication(application, identity, { custom = false } = {}) {
  await waitFor(async () => {
    assert(!application.hasExited(), 'selected_application_exited');
    try {
      const response = await fetch('http://127.0.0.1:21324/health', { signal: AbortSignal.timeout(1000) });
      return response.ok && (await boundedJson(response.body)).database === 'connected';
    } catch { return false; }
  }, 'selected_application_ready', 60_000);
  assert.equal((await fixtureRequest('/api/settings')).status, 401);
  const password = 'Synthetic-selected-fixture-v1!';
  const empty = (await migrationSql('SELECT count(*) FROM users')).stdout.trim() === '0';
  const login = await fixtureRequest(empty ? '/api/setup/create-admin' : '/api/auth/login', {
    body: empty ? { username: 'selected-fixture', password, confirmPassword: password }
      : { identifier: 'selected-fixture', password },
  });
  const session = fixtureSession(login);
  assert.equal((await fixtureRequest('/api/auth/me', { session })).status, 200);
  await verifySelectedConfigurationHttp(session, { custom, cookies: login.cookies });
  // Actual normal runtime admission, not a synthetic SQL lock, excludes maintenance.
  assert.deepEqual(await startSelectedMaintenance({ operation: 'schema', identity }).done, { code: 75, signal: null });
  const rows = (await migrationSql("SELECT count(*) FROM pg_stat_activity WHERE datname='classifarr' AND usename='cf_runtime'")).stdout.trim();
  assert(Number(rows) > 0 && Number(rows) <= 5, 'selected_runtime_pool_not_bounded');
  assert.equal((await migrationSql("SELECT count(*) FROM error_log WHERE level='ERROR'")).stdout.trim(), '0', 'selected_runtime_startup_errors');
}
