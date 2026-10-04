/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { observeEmbeddedMaintenance } from '../../bootstrap/embeddedMaintenanceOutput.mjs';
import { CANDIDATE, candidateStart, candidateStop, migrationCommand, migrationEnvironment } from './identityMigrationDatabase.mjs';

// Fixed disposable candidate only. Not the production cluster adapter.
export function selectedCandidateDatabase() {
  let identity;
  const readIdentity = async signal => {
    const text = await readFile('/identity-migration/candidate/postmaster.pid', { encoding: 'utf8', signal });
    const [pid, path, started] = text.split('\n');
    assert.match(pid, /^[1-9]\d*$/); assert.equal(path, CANDIDATE); assert.match(started, /^[1-9]\d*$/);
    return `${pid}\n${path}\n${started}`;
  };
  const stop = async () => {
    assert(identity, 'candidate_not_adopted');
    assert.equal(await readIdentity(), identity, 'candidate_identity_changed');
    await candidateStop();
    await assert.rejects(readIdentity(), error => error.code === 'ENOENT');
    assert.match((await migrationCommand('postgres', 'pg_controldata', [CANDIDATE])).stdout,
      /Database cluster state:\s+shut down\s*\n/);
    identity = null;
  };
  return {
    async adopt({ signal }) {
      signal.throwIfAborted();
      // Preparation/verification proved this registered, fixed candidate stopped.
      // Uncertain pg_ctl failure fails the disposable container, not a fallback.
      await candidateStart();
      identity = await readIdentity();
      if (signal.aborted) { await stop(); signal.throwIfAborted(); }
    },
    async check({ signal }) {
      signal.throwIfAborted();
      assert(identity, 'candidate_not_adopted');
      assert.equal(await readIdentity(signal), identity, 'candidate_identity_changed');
    },
    stop,
  };
}

export function startSelectedFixtureChild(kind, { wait = false, onReady = () => {} } = {}) {
  assert(['schema', 'runtime'].includes(kind));
  assert.equal(typeof wait, 'boolean');
  const schema = kind === 'schema';
  const script = schema ? '/app/src/scripts/runDatabaseSchemaMaintenance.mjs'
    : '/app/src/scripts/embeddedIsolationDrill/identitySelectionRuntimeProbe.mjs';
  const child = spawn('/sbin/su-exec', [schema ? 'postgres' : 'classifarr', '/usr/local/bin/node', script,
    ...(schema ? ['--apply'] : wait ? ['--wait'] : [])], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: { ...migrationEnvironment(),
      ...(!schema ? { POSTGRES_USER: 'cf_runtime', CLASSIFARR_SCHEMA_MAINTENANCE: 'external' } : {}) },
  });
  let prefix = '', ready = false;
  if (!schema && wait) child.stdout.on('data', chunk => {
    if (ready) return;
    prefix = (prefix + chunk.toString()).slice(0, 128);
    if (prefix.includes('selected-runtime-ready\n')) { ready = true; onReady(); }
  });
  return observeEmbeddedMaintenance(child);
}
