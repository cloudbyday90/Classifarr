/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { selectedApplicationEnvironment, assertSelectedApplicationBoundary } from './embeddedSelectedApplication.mjs';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { createSelectedRestoreHandoff } from './embeddedRestoreHandoff.mjs';

export function selectedRestoreHttpEnvironment(configuration = {}) {
  return { ...selectedApplicationEnvironment(configuration), CLASSIFARR_RUNTIME_MODE: 'restore' };
}

export function assertSelectedRestoreHttpBoundary(environment, context, accounts) {
  if (environment.CLASSIFARR_RUNTIME_MODE !== 'restore') throw new Error('selected_restore_http_boundary_invalid');
  assertSelectedApplicationBoundary({ ...environment, CLASSIFARR_RUNTIME_MODE: 'normal' }, context, accounts);
}

/** Internal only: caller holds selection lease, verifies DB selection and stops normal runtimes. */
export function startSelectedRestoreHttp({ identities, configuration = {}, onFatal,
  report = status => process.stdout.write(`${JSON.stringify({ component: 'RestoreMaintenance', status })}\n`),
  spawnFn = spawn, uid = process.getuid?.(), platform = process.platform,
}) {
  const application = { uid: parseEmbeddedId(identities?.application?.uid), gid: parseEmbeddedId(identities?.application?.gid) };
  const database = { uid: parseEmbeddedId(identities?.database?.uid), gid: parseEmbeddedId(identities?.database?.gid) };
  if (platform !== 'linux' || uid !== 0 || typeof onFatal !== 'function'
    || application.uid === database.uid || application.gid === database.gid) throw new Error('selected_restore_http_identity_invalid');
  const child = spawnFn('/sbin/su-exec', [`${application.uid}:${application.gid}`, '/usr/local/bin/node',
    '/app/src/scripts/runSelectedRestoreHttp.mjs', '--run'], {
    cwd: '/app', shell: false, env: selectedRestoreHttpEnvironment(configuration),
    stdio: ['ignore', 'inherit', 'inherit', 'pipe'],
  });
  const observed = observeEmbeddedChild(child);
  const closed = new Promise(resolve => { child.once('close', resolve); });
  const broker = createSelectedRestoreHandoff({ channel: child.stdio[3], identity: database, uid, onFatal, report });
  return { ...observed, done: Promise.all([observed.done, closed]).then(async ([result]) => {
    await broker.stop(); return result;
  }) };
}
