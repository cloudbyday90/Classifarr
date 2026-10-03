/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runEmbeddedDatabaseStatusProbe } from './embeddedDatabaseStatusProbe.mjs';
import { runEmbeddedDatabaseOperation } from './embeddedDatabaseOperation.mjs';
import { readEmbeddedDatabaseIdentityFile } from './embeddedDatabaseIdentityFile.mjs';
import { runEmbeddedDatabaseShutdownCommand } from './embeddedDatabaseShutdownCommand.mjs';

const PG_DATA = '/app/data/postgres';

export function parseEmbeddedDatabaseIdentity(text) {
  const [pid, path, started] = text.trim().split('\n');
  if (!/^[1-9]\d*$/.test(pid) || path !== PG_DATA || !/^[1-9]\d*$/.test(started)) {
    throw new Error('database_identity_invalid');
  }
  return `${pid}\n${path}\n${started}`;
}

/** Fixed local cluster only; no SQL, passwords, caller-supplied commands or paths. */
export function createEmbeddedDatabaseControl({ command = runEmbeddedDatabaseShutdownCommand,
  read = readEmbeddedDatabaseIdentityFile, status = runEmbeddedDatabaseStatusProbe,
} = {}) {
  let identity, busy = false, state = 'new';
  const exclusive = async work => {
    if (busy) throw new Error('database_operation_busy');
    busy = true;
    try { return await work(); } finally { busy = false; }
  };
  const requireAdopted = () => { if (state !== 'adopted') throw new Error('database_not_adopted'); };
  const readIdentity = async signal => {
    signal?.throwIfAborted();
    const text = await read({ signal });
    signal?.throwIfAborted();
    return parseEmbeddedDatabaseIdentity(text);
  };
  const verifyIdentity = async signal => {
    const current = await readIdentity(signal);
    if (!identity || current !== identity) throw new Error('database_identity_changed');
  };
  return {
    async adopt({ signal } = {}) {
      if (state !== 'new') throw new Error('database_adoption_unavailable');
      return exclusive(async () => {
        state = 'adopting';
        try {
          const candidate = await runEmbeddedDatabaseOperation(async cancellation => {
            const before = await readIdentity(cancellation);
            await status({ signal: cancellation });
            if (await readIdentity(cancellation) !== before) throw new Error('database_identity_changed');
            return before;
          }, { signal, timeoutMs: 5000 });
          signal?.throwIfAborted();
          identity = candidate;
          state = 'adopted';
        } catch (error) { state = 'failed'; throw error; }
      });
    },
    async check({ signal } = {}) {
      requireAdopted();
      return exclusive(async () => {
        await verifyIdentity(signal);
        let failure;
        try { await status({ signal }); }
        catch (error) {
          if (!['database_probe_timeout', 'database_probe_resource_pressure'].includes(error?.code)) throw error;
          failure = error;
        }
        // Neither success nor a transient result grants replacement ownership.
        await verifyIdentity(signal);
        if (failure) throw failure;
      });
    },
    async stop({ signal } = {}) {
      requireAdopted();
      return exclusive(async () => {
        state = 'stopping';
        try {
          await runEmbeddedDatabaseOperation(async cancellation => {
            let missing = false;
            try { await verifyIdentity(cancellation); }
            catch (error) {
              if (error?.code !== 'ENOENT') throw error;
              missing = true;
            }
            cancellation.throwIfAborted();
            if (!missing) await command('stop', { signal: cancellation });
            cancellation.throwIfAborted();
            const { stdout } = await command('control', { signal: cancellation });
            cancellation.throwIfAborted();
            if (!/Database cluster state:\s+shut down\s*\n/.test(stdout)) throw new Error('database_shutdown_unconfirmed');
            // Do not report a replacement or newly reappeared PID as stopped.
            try { await readIdentity(cancellation); }
            catch (error) { if (error?.code === 'ENOENT') return; throw error; }
            throw new Error('database_shutdown_unconfirmed');
          }, { signal, timeoutMs: 25_000 });
          state = 'stopped';
        } catch (error) { state = 'failed'; throw error; }
      });
    },
  };
}
