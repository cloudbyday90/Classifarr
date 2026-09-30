/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';

/** Observe exit immediately. A successful kill() only means a signal was sent. */
export function startEmbeddedApplication({ spawnFn = spawn, environment = process.env } = {}) {
  const child = spawnFn(process.execPath, ['/app/src/index.mjs'], {
    cwd: '/app', env: environment, shell: false, stdio: ['ignore', 'inherit', 'inherit'],
  });
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
