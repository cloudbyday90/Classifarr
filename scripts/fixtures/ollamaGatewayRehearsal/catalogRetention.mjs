/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, readdir, stat, mkdir, open, rmdir } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { createOnlineArchive, withOnlineArchiveSnapshot } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { verifyArchiveRestore } from '/app/src/ollamaGateway/archiveVerifier.mjs';
import { catalogRetentionService } from '/app/src/ollamaGateway/catalogRetentionService.mjs';
import { catalogRetentionRepository, assertArchiveNotCatalogPinned } from '/app/src/ollamaGateway/catalogRetentionRepository.mjs';
import { archiveStorageAvailable } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
const action = process.argv[2], paths = { catalogs: '/catalogs', archives: '/archives', receipts: '/receipts' };
const connection = { host: '/var/run/postgresql', user: 'classifarr', database: 'gateway_online_archive_fixture' };
if (action === 'verify') {
  const receipt = await verifyArchiveRestore(`/catalogs/gateway-archive-${process.argv[3]}`, '/verification', AbortSignal.timeout(120000),
    { archives: '/archives', receipts: '/receipts' });
  assert.equal(receipt.rowsRestored, true); assert.equal(receipt.dependenciesAvailable, true);
  assert.equal(receipt.runtimeEnabled, false); assert.equal(receipt.purgeAuthorized, false);
  assert.deepEqual(await readdir('/verification'), []);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} else {
  const owner = new pg.Client(connection); let reader;
  try {
    await owner.connect(); const service = catalogRetentionService(owner), repository = catalogRetentionRepository(owner);
    if (action === 'setup') {
      // This exercise deliberately retains the legacy v5 admission contract.
      await owner.query(await readFile('/app/database/ollama-gateway-catalog/20261017_230000_catalog_retention.sql', 'utf8'));
    } else if (action === 'capacity') {
      await owner.query('SELECT pg_advisory_lock(11435,4)');
      const generated = [];
      try {
        for (const [parent, size, attempt] of [['/archives', 600, 1], ['/catalogs', 300, 2]]) {
          const row = (await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status)
            SELECT id,provider_hash,$1,repeat('c',64),$2,'failed' FROM ollama_gateway.admission RETURNING id`, [archivePolicyHash(90), attempt])).rows[0];
          const directory = `${parent}/gateway-archive-${row.id}`;
          await mkdir(directory, { mode: 0o700 }); generated.push(directory);
          const file = await open(`${directory}/gateway.dump`, 'wx', 0o600);
          try { await file.truncate(size * 1048576); } finally { await file.close(); }
        }
        const jobs = await archiveJobRepository(owner).list();
        assert.equal(await archiveStorageAvailable('/archives', '/receipts', jobs), true);
        assert.equal(await archiveStorageAvailable('/catalogs', '/receipts', jobs, ['/archives']), false);
      } finally {
        // Only the fixed sparse files and generated empty directories from this isolated invocation.
        for (const directory of generated) { await unlink(`${directory}/gateway.dump`); await rmdir(directory); }
      }
      process.stdout.write('catalog_combined_capacity_passed: sparse synthetic byte accounting, not dump throughput\n');
    } else if (action === 'capture') {
      const jobs = archiveJobRepository(owner);
      await owner.query('SELECT pg_advisory_lock(11435,4)');
      // Explicit synthetic cancellation between captures, not production completion or retry scheduling.
      const unfinished = (await owner.query("SELECT id FROM gateway_archive.job WHERE status='exporting'")).rows;
      for (const row of unfinished) await jobs.failed(row.id, 'cancelled');
      const configuration = { database: { ...connection, user: 'catalog_fixture_reader' }, providerHash: 'e'.repeat(64), retentionDays: 90 };
      const identity = await withOnlineArchiveSnapshot(owner, configuration, async value => value);
      const job = await jobs.begin(identity.report, identity.revision, archivePolicyHash(90));
      assert.ok(job.attempt >= 1 && job.attempt <= 3);
      await owner.query('SELECT pg_advisory_unlock(11435,4)');
      reader = new pg.Client(configuration.database); await reader.connect();
      const result = await createOnlineArchive(reader, configuration, '/catalogs', job, [], AbortSignal.timeout(120000),
        { archives: '/archives', receipts: '/receipts' });
      assert.equal(result.manifest.version, 5);
      process.stdout.write(`${job.id}\n`);
    } else if (action === 'accept') {
      const receipt = JSON.parse(process.argv[3]);
      await assert.rejects(service.retain(paths, receipt.archiveId, { ...receipt, purgeAuthorized: true }), { code: 'gateway_catalog_registration_invalid' });
      const retained = await service.retain(paths, receipt.archiveId, receipt);
      assert.equal(retained.state, 'retained');
      assert.deepEqual(await service.retain(paths, receipt.archiveId, receipt), retained);
      const roots = await repository.list();
      const entries = await repository.entries(roots[0].id);
      await owner.query('SELECT pg_advisory_lock(11435,4)');
      await assert.rejects(assertArchiveNotCatalogPinned(owner, entries[0].id), { code: 'gateway_catalog_dependency' });
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n, roots.length);
      process.stdout.write(`catalog_retained_${roots.length}\n`);
    } else if (action === 'faults') {
      const roots = await repository.list(); assert.equal(roots.length, 3);
      await assert.rejects(service.rotate(paths, AbortSignal.abort()));
      const path = `/catalogs/gateway-archive-${roots[2].archive_id}/manifest.json`, original = await readFile(path);
      await unlink(path);
      await assert.rejects(service.rotate(paths));
      assert.equal((await repository.list())[0].status, 'retained');
      await writeFile(path, original, { mode: 0o600, flag: 'wx' });
      await owner.query('SELECT pg_advisory_lock(11435,4)');
      await repository.transition(roots[0].id, 'retiring');
      await unlink(`/catalogs/gateway-archive-${roots[0].archive_id}/manifest.json`);
      await stat(`/catalogs/gateway-archive-${roots[0].archive_id}/gateway.dump`);
      const entries = await repository.entries(roots[0].id);
      await assert.rejects(assertArchiveNotCatalogPinned(owner, entries[0].id));
      process.stdout.write('catalog_retirement_boundary_staged: durable retiring plus missing marker; pins preserved\n');
    } else if (action === 'resume') {
      const before = await repository.list(), prior = before.find(root => root.status === 'retiring'); assert.ok(prior);
      assert.equal((await service.rotate(paths)).state, 'retired');
      await assert.rejects(stat(`/catalogs/gateway-archive-${prior.archive_id}`), { code: 'ENOENT' });
      assert.equal((await repository.list()).length, 2);
      assert.equal((await service.rotate(paths)).state, 'unchanged');
      const history = (await owner.query('SELECT count(*)::int AS n FROM gateway_catalog.snapshot')).rows[0].n;
      assert.equal(history, 3);
      await owner.query('SELECT pg_advisory_lock(11435,4)');
      const entries = await repository.entries(prior.id);
      for (const id of new Set(entries.map(entry => entry.id))) {
        await assert.rejects(assertArchiveNotCatalogPinned(owner, id), { code: 'gateway_catalog_dependency' });
        await stat(`/archives/gateway-archive-${id}/gateway.dump`);
      }
      const attempts = (await owner.query(`SELECT attempt FROM gateway_archive.job WHERE id=ANY($1::uuid[]) ORDER BY attempt`,
        [before.map(root => root.archive_id)])).rows;
      assert.deepEqual(attempts.map(row => row.attempt), [1, 2, 3]);
      process.stdout.write('catalog_retention_passed: two real restore-verified roots; shared pins; resumed fixed-file retirement; history and attempts preserved\n');
    } else throw new Error('catalog_retention_action_invalid');
  } finally { await reader?.end(); await owner.end(); }
}
