/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, readlink, readdir, stat } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { qualificationResources } from './archiveQualificationResources.mjs';
import pg from '/app/node_modules/pg/lib/index.js';
import { catalogQualificationBoundary } from './catalogQualificationBoundary.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [kind, mode, store] = process.argv.slice(2);
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
  assert.ok(['archiver', 'verifier','cleanup','catalog-verifier','batch-verifier'].includes(kind));
  assert.ok(['normal', 'pause', 'cancel','publication','acknowledgment','contention'].includes(mode));
  assert.ok(store === undefined || store === 'catalog');
  const boundary = ['publication','acknowledgment'].includes(mode) ? await catalogQualificationBoundary(mode) : null;
  const resources = await qualificationResources();
  process.stdout.write(`${JSON.stringify({ fixture: 'limits', ...resources.limits })}\n`);
  const entry = kind === 'archiver' ? 'runGatewayArchiveWorker.mjs' : kind === 'cleanup' ? 'runGatewayCleanupWorker.mjs' : 'runGatewayArchiveVerifier.mjs';
  const child = spawn(process.execPath, [...(kind === 'cleanup' ? ['--import','/fixtures/cleanupQueryDiagnostics.mjs'] : []),
    ...(kind === 'batch-verifier' ? ['/fixtures/archiveEvidenceVerifier.mjs'] :
      [`/app/src/scripts/${entry}`, '--once', ...(kind === 'catalog-verifier' ? ['--catalog'] : [])])], {
    env: { PATH: '/usr/bin:/bin', ...(kind === 'archiver' ? { CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE: '/configuration/worker.json' } :
      kind === 'cleanup' ? { CLASSIFARR_GATEWAY_CLEANUP_CONFIG_FILE: '/configuration/cleanup.json',CLASSIFARR_GATEWAY_FIXTURE: 'isolated' } :
        kind === 'batch-verifier' ? { CLASSIFARR_GATEWAY_FIXTURE:'isolated' } : {}) },
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
      if (!['normal','contention'].includes(mode) && !observed) {
        if (boundary) {
          const evidence = await boundary.observe();
          if (evidence) {
            const before = await identity(child.pid);
            assert.equal(before.parent, process.pid);
            process.kill(child.pid, 'SIGSTOP');
            for (let attempt=0; ; attempt++) {
              const current=await identity(child.pid); assert.equal(current.start,before.start);
              if (current.state==='T') break;
              assert.ok(attempt<50,'qualification_stop_not_observed'); await delay(10);
            }
            observed = true;
            process.stdout.write(`${JSON.stringify({ fixture: 'boundary', kind, pid: child.pid, ...evidence, ...await resources.metrics() })}\n`);
          }
          await delay(10); continue;
        }
        for (const pid of (await readdir('/proc')).filter(value => /^[1-9][0-9]*$/.test(value))) {
          let candidate;
          try { candidate = await identity(pid); } catch { continue; }
          const target = kind === 'archiver' ? '/pg_dump' : '/pg_restore';
          if (candidate.parent !== child.pid || !candidate.executable.endsWith(target)) continue;
          let bytes = 0, restoredRows = 0;
          if (kind === 'archiver') {
            const parent = store === 'catalog' ? '/catalogs' : '/archives';
            for (const name of await readdir(parent)) {
              if (!/^gateway-archive-[a-f0-9-]{36}$/.test(name)) continue;
              try {
                await stat(`${parent}/${name}/manifest.json`);
              } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                bytes += (await stat(`${parent}/${name}/gateway.dump`)).size;
              }
            }
            if (!bytes) continue;
          } else {
            const command = (await readFile(`/proc/${candidate.pid}/cmdline`, 'utf8')).split('\0').filter(Boolean);
            assert.match(command.at(-1), /^\/verification\/gateway-verify-[A-Za-z0-9]+\/input\/gateway\.dump$/,
              'restore_must_use_private_checked_input');
            restoredRows = await restoreProgress();
            if (!restoredRows) continue;
          }
          // Fixed packaged executable, direct child, observed before signalling. No production hook.
          const current = await identity(candidate.pid);
          assert.equal(current.start, candidate.start); assert.equal(current.parent, candidate.parent);
          assert.equal(current.executable, candidate.executable);
          process.kill(candidate.pid, 'SIGSTOP');
          for (let attempt = 0; ; attempt++) {
            if ((await identity(candidate.pid)).state === 'T') break;
            assert.ok(attempt < 50, 'qualification_stop_not_observed'); await delay(10);
          }
          observed = true;
          process.stdout.write(`${JSON.stringify({ fixture: 'boundary', kind, pid: candidate.pid, bytes, restoredRows,
            executable: candidate.executable, parent: candidate.parent, ...await resources.metrics() })}\n`);
          if (mode === 'cancel') process.kill(child.pid, 'SIGTERM');
          break;
        }
      }
      await delay(20);
    }
    assert.equal(await closed, mode === 'contention' ? 1 : 0, 'qualification_worker_failed');
    assert.ok(['normal','contention'].includes(mode) || observed, 'qualification_boundary_missed');
    if (mode === 'contention') process.stdout.write(`${JSON.stringify({ state: 'contender_refused' })}\n`);
    const metrics = await resources.metrics();
    assert.equal(metrics.memoryEvents.oom_kill, '0');
    assert.equal(metrics.memoryEvents.oom ?? metrics.memoryEvents.under_oom, '0');
    assert.equal(metrics.pidsEvents, 'max 0');
    process.stdout.write(`${JSON.stringify({ fixture: 'metrics', kind, ...metrics })}\n`);
  } finally {
    if (!ended) { child.kill('SIGKILL'); await closed; }
    await boundary?.close();
  }
}
await run();
