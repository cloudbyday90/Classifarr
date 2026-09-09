/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    const [{ createSourceIdentityExternalEvidenceReplay }, { getMediaServerService }, { tmdbService }] = await Promise.all([
      import('../services/sourceIdentityExternalEvidenceReplay.mjs'),
      import('../services/mediaServers/index.mjs'),
      import('../services/tmdb.mjs'),
    ]);
    return {
      replay: createSourceIdentityExternalEvidenceReplay({ query: db.query, getMediaServerService, tmdbService }),
      close: () => db.pool.end(),
    };
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

/** Runs a bounded, aggregate-only replay with a read-only database session. */
export async function runSourceIdentityExternalEvidenceReplay({
  argv = process.argv.slice(2), loadRuntime = loadPrivateRuntime,
} = {}) {
  if (!Array.isArray(argv) || argv.length !== 0) throw new Error('source_identity_evidence_replay_stdin_only');
  const runtime = await loadRuntime();
  try {
    return await runtime.replay.replay();
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runSourceIdentityExternalEvidenceReplay().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id === 'failed') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Source identity external-evidence replay could not run.\n');
    process.exitCode = 1;
  });
}
