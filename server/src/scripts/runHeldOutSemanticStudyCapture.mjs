/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';
import { loadBoundedStdinJsonInput } from './boundedStdinJsonInput.mjs';

/** Bootstrap logging/read-only settings before loading runtime dependencies. */
async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { createHeldOutSemanticStudyCapture } = await import('../services/heldOutSemanticStudyCapture.mjs');
    return { capture: createHeldOutSemanticStudyCapture(), close: () => db.pool.end() };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

export async function runHeldOutSemanticStudyCapture({
  argv = process.argv.slice(2), stdin = process.stdin, loadRuntime = loadPrivateRuntime,
} = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) throw new Error('held_out_stdin_only');
  const request = await loadBoundedStdinJsonInput({ stdin });
  const runtime = await loadRuntime();
  try {
    const result = await runtime.capture.capture(request);
    if (result?.status?.id !== 'complete' || !result.document) throw new Error('held_out_capture_failed');
    return result.document;
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyCapture().then((document) => {
    process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
  }).catch(() => {
    process.stderr.write('Held-out semantic study capture could not run.\n');
    process.exitCode = 1;
  });
}
