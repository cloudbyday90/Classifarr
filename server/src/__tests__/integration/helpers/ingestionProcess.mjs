/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function eventually(check, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(20);
  }
  throw new Error(`Timed out: ${label}`);
}

/** Only the integration runner's disposable database and loopback fixture. */
export function startIngestionProcess(options, origin) {
  if (!/^classifarr_suite_[a-f0-9]{12}$/.test(options.database) ||
      !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || options.user !== 'test') {
    throw new Error('isolated_ingestion_fixture_required');
  }
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => /^(SystemRoot|WINDIR|PATH|TEMP|TMP|TMPDIR)$/i.test(key)));
  Object.assign(env, {
    NODE_ENV: 'test', LOG_LEVEL: 'silent',
    POSTGRES_HOST: options.host, POSTGRES_PORT: String(options.port),
    POSTGRES_DB: options.database, POSTGRES_USER: options.user, POSTGRES_PASSWORD: options.password,
    FIXTURE_JELLYFIN_ORIGIN: origin,
    API_KEY_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });
  const child = fork(fileURLToPath(new URL('./ingestionProcessEntry.mjs', import.meta.url)), [], {
    env, execArgv: ['--import', new URL('./ingestionProcessIsolation.mjs', import.meta.url).href],
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  // Do not expose provider URLs, credentials or raw application logs on failure.
  child.stdout.resume();
  child.stderr.resume();
  let exited = false, ready = false, sequence = 0, failure = null;
  const pending = new Map();
  function rejectPending(error) {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  }
  child.on('error', () => { failure = new Error('ingestion_fixture_spawn_failed'); rejectPending(failure); });
  child.on('exit', () => { exited = true; rejectPending(new Error('ingestion_fixture_exited')); });
  child.on('message', message => {
    if (message.type === 'ready') { ready = true; return; }
    if (message.type === 'fatal') { failure = new Error('ingestion_fixture_initialization_failed'); return; }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timer);
    if (message.type === 'result') entry.resolve(message.result);
    else entry.reject(new Error(`ingestion_fixture_command_failed:${message.code ?? 'unknown'}`));
  });
  return {
    async ready() {
      await eventually(() => {
        if (failure || exited) throw failure ?? new Error('ingestion_fixture_exited_before_ready');
        return ready;
      }, 'ingestion worker startup', 30_000);
    },
    sync(libraryId) {
      if (!ready || exited) return Promise.reject(new Error('ingestion_fixture_not_running'));
      const id = ++sequence;
      const result = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id); reject(new Error('ingestion_fixture_command_timeout'));
          child.kill('SIGKILL');
        }, 30_000);
        pending.set(id, { resolve, reject, timer });
        child.send({ id, libraryId }, error => {
          if (error) { clearTimeout(timer); pending.delete(id); reject(new Error('ingestion_fixture_send_failed')); }
        });
      });
      return result;
    },
    async kill() {
      if (!exited) child.kill('SIGKILL');
      await eventually(() => exited, 'ingestion worker exit');
    },
  };
}
