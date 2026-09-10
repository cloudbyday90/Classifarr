/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { createHeldOutSemanticStudyCohortCapture } = await import('../services/heldOutSemanticStudyCohortCapture.mjs');
    return { capture: createHeldOutSemanticStudyCohortCapture(), close: () => db.pool.end() };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

/** Runs one private, automatically selected study cohort with no file input. */
export async function runHeldOutSemanticStudyCohortCapture({
  argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime,
} = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) throw new Error('held_out_cohort_stdin_only');
  const runtime = await loadRuntime();
  try {
    return await runtime.capture.capture();
  } finally {
    await runtime.close();
  }
}

function publicReport(result) {
  return Object.freeze({
    receipt: result?.receipt ?? null,
    status: result?.status ?? { id: 'capture_failed' },
  });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyCohortCapture().then((result) => {
    process.stdout.write(`${JSON.stringify(publicReport(result), null, 2)}\n`);
    if (result.status.id !== 'captured_pending_independent_labels') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Held-out semantic study cohort capture could not run.\n');
    process.exitCode = 1;
  });
}
