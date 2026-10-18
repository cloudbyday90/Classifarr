/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { captureCatalogContent } from '/app/src/ollamaGateway/catalogContent.mjs';
import { catalogDue, catalogSemanticRevision } from '/app/src/ollamaGateway/catalogSchedule.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { catalogJobRepository } from '/app/src/ollamaGateway/catalogJobRepository.mjs';
import { catalogRetentionRepository, assertArchiveNotCatalogPinned } from '/app/src/ollamaGateway/catalogRetentionRepository.mjs';
import { captureScheduledCatalog } from '/app/src/ollamaGateway/catalogCapture.mjs';
import { verifyRotationHistory } from './rotationStudyContract.mjs';

const path = '/tmp/catalog-rotation-study.json';
async function history(client) {
  const inference = (await client.query("SELECT id,(to_jsonb(j)-'status')::text AS body FROM gateway_archive.job j ORDER BY created_at,id LIMIT 17")).rows;
  const catalog = (await client.query('SELECT id,to_jsonb(j)::text AS body FROM gateway_catalog.job j ORDER BY created_at,id LIMIT 17')).rows;
  return { inference, catalog };
}

export async function runCatalogRotationStudy({ action, owner, reader, configuration, paths }) {
  await owner.query('SELECT pg_advisory_lock(11435,4)');
  if (action === 'study-begin') {
    await writeFile(path, JSON.stringify({ cycle: 0, ...await history(owner) }), { mode: 0o600, flag: 'wx' }); return;
  }
  if (action === 'study-refresh') {
    const repository = catalogJobRepository(owner), jobs = await repository.list();
    const inferenceJobs = await archiveJobRepository(owner).list(), roots = await catalogRetentionRepository(owner).list();
    const captured = await withOnlineArchiveSnapshot(reader, configuration, async context => {
      const semantic = catalogSemanticRevision(await captureCatalogContent(reader, undefined, { bytes: 0 }, 3));
      assert.equal(catalogDue({ ...context, semantic, jobs, inferenceJobs, roots,
        now: Date.parse(context.report.capturedAt) + 86400001 }), 'due');
      // Only this pure observation is in the future. All SQL timestamps, counters and guards remain real.
      const job = await repository.begin(context.report, context.revision, archivePolicyHash(90), semantic, context.compatibleRevisions);
      const result = await captureScheduledCatalog({ source: reader, maintenance: owner, configuration, paths, job, context, signal: AbortSignal.timeout(120000) });
      assert.equal(job.attempt, 2); assert.equal(result.manifest.version, 7); return { job, result };
    });
    await repository.published(captured.job.id, captured.result); return;
  }
  assert.equal(action, 'study-check');
  assert.ok((await stat(path)).size < 262144);
  const before = JSON.parse(await readFile(path, 'utf8')), cycle = before.cycle + 1;
  const after = await history(owner);
  const admission = (await owner.query('SELECT attempts::int AS attempts,binding_count AS bindings FROM ollama_gateway.admission')).rows[0];
  const roots = (await owner.query('SELECT archive_id,status FROM gateway_catalog.snapshot ORDER BY created_at,id LIMIT 17')).rows;
  Object.assign(after, admission, { catalogAttempts: (await catalogJobRepository(owner).list()).map(job => job.attempt),
    rootCounts: { total: roots.length, retained: roots.filter(root => root.status === 'retained').length, retired: roots.filter(root => root.status === 'retired').length },
    cleanupOperations: (await owner.query('SELECT count(*)::int AS n FROM gateway_cleanup.operation')).rows[0].n });
  const result = verifyRotationHistory(before, after, cycle);
  const jobs = await archiveJobRepository(owner).list();
  for (const job of jobs.slice(0, -2)) {
    assert.equal(job.status, 'retired'); await assertArchiveNotCatalogPinned(owner, job.id);
    await assert.rejects(stat(`/archives/gateway-archive-${job.id}`), { code: 'ENOENT' });
  }
  for (const job of jobs.slice(-2)) { assert.equal(job.status, 'verified'); assert.ok((await stat(`/archives/gateway-archive-${job.id}/gateway.dump`)).size > 0); }
  for (const root of roots.filter(root => root.status === 'retired')) await assert.rejects(stat(`/catalogs/gateway-archive-${root.archive_id}`), { code: 'ENOENT' });
  await writeFile(path, JSON.stringify({ cycle, ...after }), { mode: 0o600 });
  console.log(JSON.stringify({ fixture: 'rotation-cycle', ...result, obsoleteFilesRemoved: true, oldPinsReleased: true, historicalRowsPreserved: true }));
}
