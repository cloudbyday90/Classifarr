/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';

async function loadPrivateRuntime({ crossReferences = false } = {}) {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  if (crossReferences) process.env.PGOPTIONS += ' -c statement_timeout=10000 -c lock_timeout=1000';
  const db = await import('../config/database.mjs');
  try {
    const [{ createSourceIdentityExternalEvidenceReplay }, { getMediaServerService }, { tmdbService }] = await Promise.all([
      import('../services/sourceIdentityExternalEvidenceReplay.mjs'),
      import('../services/mediaServers/index.mjs'),
      import('../services/tmdb.mjs'),
    ]);
    let replay;
    if (crossReferences) {
      const [{ createSourceIdentityCrossReferenceDiagnosis }, { createSourceIdentityExternalEvidenceReplayReadService }] = await Promise.all([
        import('../services/sourceIdentityCrossReferenceDiagnosis.mjs'),
        import('../services/sourceIdentityExternalEvidenceReplayReadService.mjs'),
      ]);
      const reader = createSourceIdentityExternalEvidenceReplayReadService();
      replay = createSourceIdentityCrossReferenceDiagnosis({ readRows: limits => reader.read(limits), getMediaServerService, tmdbService });
    } else {
      replay = createSourceIdentityExternalEvidenceReplay({ query: db.query, getMediaServerService, tmdbService });
    }
    return {
      replay,
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
  if (!Array.isArray(argv) || (argv.length !== 0 && (argv.length !== 1 || argv[0] !== '--cross-references'))) {
    throw new Error('source_identity_evidence_replay_invalid_arguments');
  }
  const runtime = argv.length ? await loadRuntime({ crossReferences: true }) : await loadRuntime();
  try {
    return await runtime.replay.replay();
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runSourceIdentityExternalEvidenceReplay().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (['failed', 'cancelled', 'timed_out'].includes(result.status.id)) process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Source identity external-evidence replay could not run.\n');
    process.exitCode = 1;
  });
}
