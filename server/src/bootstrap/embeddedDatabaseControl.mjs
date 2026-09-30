/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const PG_DATA = '/app/data/postgres';
const PG_CTL = '/usr/libexec/postgresql18/pg_ctl';
const PG_CONTROL = '/usr/libexec/postgresql18/pg_controldata';

export function parseEmbeddedDatabaseIdentity(text) {
  const [pid, path, started] = text.trim().split('\n');
  if (!/^[1-9]\d*$/.test(pid) || path !== PG_DATA || !/^[1-9]\d*$/.test(started)) {
    throw new Error('database_identity_invalid');
  }
  return `${pid}\n${path}\n${started}`;
}

/** Fixed local cluster only; no SQL, passwords, caller-supplied commands or paths. */
export function createEmbeddedDatabaseControl({ run = execute, read = readFile } = {}) {
  let identity;
  const options = { cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
    shell: false, timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 };
  const readIdentity = async () => parseEmbeddedDatabaseIdentity(await read('/app/data/postgres/postmaster.pid', 'utf8'));
  const verifyIdentity = async () => {
    const current = await readIdentity();
    if (!identity || current !== identity) throw new Error('database_identity_changed');
  };
  return {
    async adopt() {
      identity = await readIdentity();
      await run(PG_CTL, ['-D', PG_DATA, 'status'], options);
      await verifyIdentity();
    },
    async check() {
      await verifyIdentity();
      await run(PG_CTL, ['-D', PG_DATA, 'status'], options);
    },
    async stop() {
      if (!identity) throw new Error('database_not_adopted');
      let missing = false;
      try { await verifyIdentity(); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // No PID file can mean it already stopped; only control data can confirm.
        missing = true;
      }
      if (!missing) {
        await run(PG_CTL, ['-D', PG_DATA, '-m', 'fast', '-w', '-t', '20', 'stop'],
          { ...options, timeout: 22_000 });
      }
      const { stdout } = await run(PG_CONTROL, [PG_DATA], options);
      if (!/Database cluster state:\s+shut down\s*\n/.test(stdout)) throw new Error('database_shutdown_unconfirmed');
    },
  };
}
