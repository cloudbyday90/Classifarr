/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';

/** Observe exit immediately. A successful kill() only means a signal was sent. */
export function startEmbeddedApplication({ spawnFn = spawn, environment = process.env, queueMaintenance = false, imageIndexMaintenance = false } = {}) {
  if (typeof queueMaintenance !== 'boolean' || typeof imageIndexMaintenance !== 'boolean'
    || (imageIndexMaintenance && !queueMaintenance)) throw new Error('embedded_application_launch_invalid');
  /** @type {import('node:child_process').StdioOptions} */
  const stdio = ['ignore', 'inherit', 'inherit'];
  if (queueMaintenance) stdio.push('pipe');
  if (imageIndexMaintenance) stdio.push('pipe');
  const child = spawnFn(process.execPath, ['/app/src/index.mjs'], {
    cwd: '/app', env: queueMaintenance ? { ...environment, CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL: 'stdio-v1',
      ...(imageIndexMaintenance ? { CLASSIFARR_IMAGE_INDEX_CHANNEL: 'stdio-v1' } : {}) } : environment,
    shell: false, stdio,
  });
  return { ...observeEmbeddedChild(child), ...(queueMaintenance ? { maintenanceChannel: child.stdio[3] } : {}),
    ...(imageIndexMaintenance ? { imageIndexChannel: child.stdio[4] } : {}) };
}

export function observeEmbeddedChild(child) {
  let exited = false;
  let failed = false;
  const done = new Promise(resolve => {
    child.on('error', () => {
      failed = true;
      // A signal failure is not an exit. A failed spawn has no process to join.
      if (child.pid === undefined) { exited = true; resolve({ code: 1, signal: null }); }
    });
    child.once('exit', (code, signal) => {
      exited = true;
      resolve({ code: failed ? 1 : code, signal });
    });
  });
  return {
    done,
    hasExited: () => exited,
    signal: signal => {
      if (!exited) child.kill(signal);
    },
  };
}

export async function waitForEmbeddedExit(done, milliseconds) {
  let timer;
  try {
    return await Promise.race([done, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('application_exit_timeout')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
