/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readdir, readlink, readFile, realpath } from 'node:fs/promises';
import { qualificationResources } from './archiveQualificationResources.mjs';
import { soakProfile, studyWorkerBlocked } from './soakProfile.mjs';
import { createStudyMeasurements, requireStudyCoverage } from './studyMeasurements.mjs';
import { createStudyResourceSample } from './studyResource.mjs';
import { createQualificationProbe } from './archiveQualificationProbe.mjs';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import * as residentParsers from '/app/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const [kind, mode] = process.argv.slice(2);
const profile = soakProfile(process.env.CLASSIFARR_SOAK_PROFILE ?? 'regression');
assert.ok(['archiver', 'verifier', 'catalog-verifier'].includes(kind));
assert.ok(['once', 'loop'].includes(mode));
const resources = await qualificationResources();
console.log(JSON.stringify({ fixture: 'limits', kind, ...resources.limits }));
const child = spawn(process.execPath, [kind === 'archiver' ? '/app/src/scripts/runGatewayArchiveWorker.mjs' :
  '/app/src/scripts/runGatewayArchiveVerifier.mjs', ...(mode === 'once' ? ['--once'] : []), ...(kind === 'catalog-verifier' ? ['--catalog'] : [])], {
  env: { PATH: '/usr/bin:/bin', ...(kind === 'archiver' ? { CLASSIFARR_GATEWAY_ARCHIVE_WORKER_CONFIG_FILE: '/configuration/worker.json' } : {}) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let lines = 0, blocked = false;
for (const stream of [child.stdout, child.stderr]) createInterface({ input: stream }).on('line', line => {
  if (++lines > 100 || line.length > 4096) { child.kill('SIGKILL'); return; }
  // Fixed packaged state records only, never raw child stderr or provider bodies.
  try {
    const record = JSON.parse(line);
    console.log(JSON.stringify({ fixture: 'worker-state', kind, at: Date.now(), ...record }));
    if (studyWorkerBlocked(profile.name, record)) { blocked = true; child.kill('SIGTERM'); }
  }
  catch { console.log(JSON.stringify({ fixture: 'worker-error', kind })); }
});
console.log(JSON.stringify({ fixture: 'worker-start', kind, at: Date.now() }));
const stop = () => child.kill('SIGTERM'); process.once('SIGTERM', stop); process.once('SIGINT', stop);
const timer = setTimeout(() => child.kill('SIGKILL'), mode === 'loop' ? profile.workerMs : 180000);
let sampling = false, samplePending, samplingFailure = false;
const windows = new Map();
const target = await realpath(kind === 'archiver' ? '/usr/bin/pg_dump' : '/usr/bin/pg_restore');
const measurements = profile.name === 'extended' && mode === 'loop' ? createStudyMeasurements(createStudyResourceSample({
  version: resources.limits.version, read: readResidentText, parsers: residentParsers,
  probe: createQualificationProbe({ version: resources.limits.version, workerPid: child.pid, read: readResidentText,
    parsers: residentParsers, executable: await realpath(process.execPath), dumpExecutable: target }),
})) : null;
const sampler = setInterval(() => {
  if (sampling) return; sampling = true;
  samplePending = (async () => {
    await measurements?.tick();
    for (const pid of (await readdir('/proc')).filter(value => /^[1-9][0-9]*$/.test(value))) {
      let executable;
      try { executable = await readlink(`/proc/${pid}/exe`); } catch { continue; }
      if (executable !== target) continue;
      let fields;
      try { const raw = await readFile(`/proc/${pid}/stat`, 'utf8'); fields = raw.slice(raw.lastIndexOf(')') + 2).split(' '); } catch { continue; }
      if (Number(fields[1]) !== child.pid) continue;
      const key = `${pid}:${fields[19]}`, at = Date.now(), prior = windows.get(key);
      assert.ok(prior || windows.size < 20, 'soak_child_window_limit');
      windows.set(key, { executable, start: prior?.start ?? at, end: at });
    }
  })().catch(() => { samplingFailure = true; stop(); }).finally(() => { sampling = false; });
}, 250);
try {
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  clearInterval(sampler); await samplePending; await measurements?.stop();
  const metrics = await resources.metrics();
  console.log(JSON.stringify({ fixture: 'resources', kind, at: Date.now(), ...metrics }));
  if (measurements) {
    const summary = measurements.summary(); let coveragePassed = false;
    try {
      requireStudyCoverage(summary, profile.durationMs - 120000 - (kind === 'catalog-verifier' ? 20000 : 0) - 5000);
      coveragePassed = true;
    } catch { /* Retain partial observations, then fail closed below. */ }
    console.log(JSON.stringify({ fixture: 'study-observations', kind, coveragePassed, ...summary }));
    assert.equal(blocked, false, 'study_archive_blocked');
    assert.equal(coveragePassed, true, 'study_coverage_invalid');
  }
  assert.equal(code, 0, 'soak_worker_failed');
  assert.equal(samplingFailure, false, 'soak_sampling_failed');
  assert.ok(Object.values(metrics.memoryEvents).every(value => Number(value) === 0), 'soak_memory_event');
  assert.ok(metrics.pidsEvents.split(/\s+/).every(value => value === 'max' || value === '0'), 'soak_pid_event');
  for (const window of windows.values()) console.log(JSON.stringify({ fixture: 'child-window', kind, ...window }));
} finally { clearInterval(sampler); await samplePending; await measurements?.stop(); clearTimeout(timer); stop(); process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop); }
