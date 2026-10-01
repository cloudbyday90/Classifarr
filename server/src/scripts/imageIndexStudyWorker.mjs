/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { startCompatibleImageIndex } from '../bootstrap/embeddedCompatibleImageIndex.mjs';
import { waitForEmbeddedExit } from '../bootstrap/embeddedChildProcess.mjs';
import { IMAGE_INDEX_WORKER_TIMEOUT_MS } from '../utils/imageIndexHandoffProtocol.mjs';
import { readStudyIndexActivity, sampleStudyIndex } from './imageIndexStudyObservation.mjs';

/** Child exit and PostgreSQL cancellation are distinct observations. */
export async function awaitStudyIndexIdle(query) {
  const deadline = performance.now() + 10000;
  while (await readStudyIndexActivity(query)) {
    if (performance.now() >= deadline) throw new Error('image_index_study_database_still_active');
    await delay(100);
  }
}

export async function executeStudyImageWorker({ task, query, sampler, phase, interrupt = false,
  start = startCompatibleImageIndex, spawnFn = spawn }) {
  let pid, interrupted = false, watchdog = false;
  const started = performance.now();
  const runtime = start({ task, spawnFn: (...args) => { const child = spawnFn(...args); pid = child.pid; return child; } });
  const timer = setTimeout(() => { watchdog = true; runtime.signal('SIGTERM'); }, IMAGE_INDEX_WORKER_TIMEOUT_MS);
  try {
    while (!runtime.hasExited() && !watchdog) {
      const activity = await sampleStudyIndex(query, sampler, phase, pid);
      if (interrupt && !interrupted && activity?.phase === 'waiting for writers before build') {
        interrupted = true; runtime.signal('SIGTERM');
      }
      await delay(interrupt ? 100 : 500);
    }
    const exit = await waitForEmbeddedExit(runtime.done, 5000);
    await awaitStudyIndexIdle(query);
    return { durationMs: Math.round(performance.now() - started), exitCode: exit.code,
      signal: exit.signal, watchdog, interrupted };
  } finally {
    clearTimeout(timer);
    if (!runtime.hasExited()) { runtime.signal('SIGKILL'); await waitForEmbeddedExit(runtime.done, 5000); }
    await awaitStudyIndexIdle(query);
  }
}
