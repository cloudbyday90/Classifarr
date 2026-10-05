/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { observeEmbeddedMaintenance } from '../../bootstrap/embeddedMaintenanceOutput.mjs';
import { migrationEnvironment } from './identityMigrationDatabase.mjs';

export function startSelectedFixtureChild(kind, { wait = false, onReady = () => {} } = {}) {
  assert.equal(kind, 'runtime');
  assert.equal(typeof wait, 'boolean');
  const script = '/app/src/scripts/embeddedIsolationDrill/identitySelectionRuntimeProbe.mjs';
  const child = spawn('/sbin/su-exec', ['classifarr', '/usr/local/bin/node', script,
    ...(wait ? ['--wait'] : [])], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: { ...migrationEnvironment(),
      POSTGRES_USER: 'cf_runtime', CLASSIFARR_SCHEMA_MAINTENANCE: 'external' },
  });
  let prefix = '', ready = false;
  if (wait) child.stdout.on('data', chunk => {
    if (ready) return;
    prefix = (prefix + chunk.toString()).slice(0, 128);
    if (prefix.includes('selected-runtime-ready\n')) { ready = true; onReady(); }
  });
  return observeEmbeddedMaintenance(child);
}
