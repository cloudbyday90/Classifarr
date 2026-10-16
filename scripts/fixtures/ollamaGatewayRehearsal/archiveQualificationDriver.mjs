/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readlink, readdir, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { qualificationResources } from './archiveQualificationResources.mjs';
import pg from '/app/node_modules/pg/lib/index.js';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [kind, mode] = process.argv.slice(2);
async function identity(pid) {
  const raw = await readFile(`/proc/${pid}/stat`, 'utf8');
  const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
  return { pid: Number(pid), parent: Number(fields[1]), start: fields[19],
    executable: await readlink(`/proc/${pid}/exe`), state: fields[0] };
}
async function restoreProgress() {
  const names = (await readdir('/verification')).filter(name => /^gateway-verify-[A-Za-z0-9]+$/.test(name));
  if (names.length !== 1) return 0;
  const client = new pg.Client({ host: `/verification/${names[0]}`, user: 'archive_restore', database: 'postgres',
    connectionTimeoutMillis: 500, query_timeout: 1000 });
  client.on('error', () => {});
  try {
    await client.connect();
    return Number((await client.query(`SELECT coalesce(max(tuples_processed),0)::text AS rows
      FROM pg_stat_progress_copy WHERE command='COPY FROM'`)).rows[0].rows);
  } catch { return 0; } finally { await client.end(); }
}
async function run() {
  assert.ok(['archiver', 'verifier','cleanup'].includes(kind));
  assert.ok(['normal', 'pause', 'cancel'].includes(mode));
  const resources = await qualificationResources();
  process.stdout.write(`${JSON.stringify({ fixture: 'limits', ...resources.limits })}\n`);
  const entry = kind === 'archiver' ? 'runGatewayArchiveWorker.mjs' : kind === 'cleanup' ? 'runGatewayCleanupWorker.mjs' : 'runGatewayArchiveVerifier.mjs';
  const child = spawn(process.execPath, [`/app/src/scripts/${entry}`, '--once'], {
    env: { PATH: '/usr/bin:/bin', ...(kind === 'archiver' ? { CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE: '/configuration/worker.json' } :
      kind === 'cleanup' ? { CLASSIFARR_GATEWAY_CLEANUP_CONFIG_FILE: '/configuration/cleanup.json' } : {}) },
    stdio: ['ignore', 'inherit', 'inherit'], shell: false,
  });
  let ended = false, observed = false;
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', code => { ended = true; resolve(code); });
  });
  const deadline = Date.now() + 210000;
  try {
    while (!ended) {
      assert.ok(Date.now() < deadline, 'qualification_worker_deadline');
      if (mode !== 'normal' && !observed) {
        for (const pid of (await readdir('/proc')).filter(value => /^[1-9][0-9]*$/.test(value))) {
          let candidate;
          try { candidate = await identity(pid); } catch { continue; }
          const target = kind === 'archiver' ? '/pg_dump' : '/pg_restore';
          if (candidate.parent !== child.pid || !candidate.executable.endsWith(target)) continue;
          let bytes = 0, restoredRows = 0;
          if (kind === 'archiver') {
            for (const name of await readdir('/archives')) {
              if (!/^gateway-archive-[a-f0-9-]{36}$/.test(name)) continue;
              try {
                await stat(`/archives/${name}/manifest.json`);
              } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                bytes += (await stat(`/archives/${name}/gateway.dump`)).size;
              }
            }
            if (!bytes) continue;
          } else {
            restoredRows = await restoreProgress();
            if (!restoredRows) continue;
          }
          // Fixed packaged executable, direct child, observed before signalling. No production hook.
          process.kill(candidate.pid, 'SIGSTOP');
          for (let attempt = 0; ; attempt++) {
            if ((await identity(candidate.pid)).state === 'T') break;
            assert.ok(attempt < 50, 'qualification_stop_not_observed'); await delay(10);
          }
          observed = true;
          process.stdout.write(`${JSON.stringify({ fixture: 'boundary', kind, pid: candidate.pid, bytes, restoredRows,
            executable: candidate.executable, parent: candidate.parent })}\n`);
          if (mode === 'cancel') process.kill(child.pid, 'SIGTERM');
          break;
        }
      }
      await delay(20);
    }
    assert.equal(await closed, 0, 'qualification_worker_failed');
    assert.ok(mode === 'normal' || observed, 'qualification_boundary_missed');
    const metrics = await resources.metrics();
    assert.equal(metrics.memoryEvents.oom_kill, '0');
    assert.equal(metrics.memoryEvents.oom ?? metrics.memoryEvents.under_oom, '0');
    assert.equal(metrics.pidsEvents, 'max 0');
    process.stdout.write(`${JSON.stringify({ fixture: 'metrics', kind, ...metrics })}\n`);
  } finally {
    if (!ended) { child.kill('SIGKILL'); await closed; }
  }
}
await run();
