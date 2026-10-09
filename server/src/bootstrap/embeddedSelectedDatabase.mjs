/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runEmbeddedDatabaseStartup } from './embeddedDatabaseStartup.mjs';
import { runEmbeddedDatabaseOperation } from './embeddedDatabaseOperation.mjs';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { prepareSelectedDatabase, readSelectedDatabaseFile, SELECTED_DATABASE_DATA } from './embeddedSelectedDatabaseLayout.mjs';
import { launchSelectedDatabase, verifySelectedDatabaseShutdown } from './embeddedSelectedDatabaseProcess.mjs';
import { observeProbe } from './embeddedProbeDiagnostics.mjs';

function identityOf(text, pid) {
  const lines = text.split('\n');
  if (!Number.isSafeInteger(pid) || pid <= 0 || lines[0] !== String(pid) || lines[1] !== SELECTED_DATABASE_DATA
    || !/^[1-9]\d*$/.test(lines[2]) || lines[3] !== '5432') throw new Error('selected_database_identity_changed');
  return { identity: lines.slice(0, 3).join('\n'), ready: lines[7]?.trim() === 'ready' };
}

/** Called only after durable selection, while its trusted parent retains the lease. */
export function createSelectedEmbeddedDatabase({ prepare = prepareSelectedDatabase, read = readSelectedDatabaseFile,
  launch = launchSelectedDatabase, control = verifySelectedDatabaseShutdown, start = runEmbeddedDatabaseStartup,
  waitForExit = waitForEmbeddedExit, timeoutMs = 300_000, report = () => {},
} = {}) {
  let state = 'new', busy = false, account, child, identity;
  const exclusive = async work => {
    if (busy) throw new Error('database_operation_busy');
    busy = true;
    try { return await work(); } finally { busy = false; }
  };
  const requireAdopted = () => { if (state !== 'adopted') throw new Error('database_not_adopted'); };
  const current = async signal => {
    signal?.throwIfAborted();
    if (child.hasExited()) throw new Error('selected_database_process_exited');
    const text = await read('pid', account.uid, { signal });
    signal?.throwIfAborted();
    if (child.hasExited()) throw new Error('selected_database_process_exited');
    const lines = text.trim().split('\n');
    // PostgreSQL can still be writing its new PID file. Never adopt a partial file.
    if (state === 'starting' && !identity && lines.length < 8 && (!lines[0] || lines[0] === String(child.pid))) {
      return { identity: undefined, ready: false };
    }
    const value = identityOf(text, child.pid);
    if (identity && identity !== value.identity) throw new Error('selected_database_identity_changed');
    return value;
  };
  return {
    async adopt({ signal } = {}) {
      if (state !== 'new') throw new Error('database_adoption_unavailable');
      return exclusive(async () => {
        state = 'starting';
        try {
          await start({ signal, timeoutMs, report,
            prepare: async cancellation => { account = await prepare({ signal: cancellation }); },
            launch: () => { child = launch(account); return child; },
            probe: async (_pid, cancellation) => {
              let value;
              try { value = await current(cancellation); }
              catch (error) { if (error.code === 'ENOENT') return { ready: false, phase: 'starting_or_recovering' }; throw error; }
              identity = value.identity;
              return { ready: value.ready, phase: 'starting_or_recovering' };
            },
          });
          state = 'adopted';
        } catch (error) { state = 'failed'; throw error; }
      });
    },
    async check({ signal, observe } = {}) {
      requireAdopted();
      return exclusive(async () => {
        observeProbe(observe, 'identity_before');
        if (!(await current(signal)).ready) throw new Error('selected_database_not_ready');
        observeProbe(observe, 'complete');
      });
    },
    async stop() {
      requireAdopted();
      return exclusive(async () => {
        state = 'stopping';
        try {
          await runEmbeddedDatabaseOperation(async signal => {
            if (!child.hasExited()) { await current(signal); child.signal('SIGINT'); }
            const result = await waitForExit(child.done, 20_000);
            signal.throwIfAborted();
            if (result.code !== 0 || result.signal !== null) throw new Error('selected_database_shutdown_unconfirmed');
            await control({ signal });
            try { await read('pid', account.uid, { signal }); }
            catch (error) { if (error.code === 'ENOENT') return; throw error; }
            throw new Error('selected_database_shutdown_unconfirmed');
          }, { timeoutMs: 25_000 });
          state = 'stopped';
        } catch (error) { state = 'failed'; throw error; }
      });
    },
  };
}
