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
    const { createHeldOutSemanticStudyEligibilityAudit } = await import('../services/heldOutSemanticStudyEligibilityAudit.mjs');
    return { audit: createHeldOutSemanticStudyEligibilityAudit(), close: () => db.pool.end() };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

/** Runs the private broad-policy eligibility audit without file input. */
export async function runHeldOutSemanticStudyEligibilityAudit({
  argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime,
} = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) throw new Error('held_out_eligibility_audit_stdin_only');
  const runtime = await loadRuntime();
  try {
    return await runtime.audit.audit();
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyEligibilityAudit().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id !== 'complete') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Held-out semantic study eligibility audit could not run.\n');
    process.exitCode = 1;
  });
}
