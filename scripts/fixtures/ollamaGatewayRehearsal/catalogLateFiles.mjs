/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { createOnlineArchive } from '/app/src/ollamaGateway/onlineArchive.mjs';

/** Function-level file-race checks, not scheduler admission or accelerated retries. */
export async function checkLateCatalogFiles(reader, configuration, job) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
  assert.equal(configuration.database.database, 'gateway_online_archive_fixture');
  const { id } = (await reader.query(`SELECT id FROM gateway_archive.job WHERE status='verified'
    AND recovery_protection_id IS NOT NULL ORDER BY id LIMIT 1`)).rows[0];
  const query = reader.query.bind(reader);
  for (const kind of ['dump','manifest','receipt','protection']) {
    const path = kind === 'receipt' ? `/receipts/${id}.json` :
      `/archives/gateway-archive-${id}/${kind === 'dump' ? 'gateway.dump' : `${kind}.json`}`;
    assert.ok((await stat(path)).size < 1048576, 'late_fixture_file_bound');
    const original = await readFile(path), parent = await mkdtemp('/tmp/catalog-late-');
    let passes = 0, mutated = false;
    reader.query = async (...args) => {
      if (args[0].startsWith('DECLARE gateway_catalog_cursor') && args[0].includes(' AS required') && ++passes === 2) {
        assert.ok((await stat(`${parent}/gateway-archive-${job.id}/gateway.dump`)).size > 0, 'late_fixture_export_missing');
        await writeFile(path, kind === 'dump' ? 'invalid-dump' : '{}'); mutated = true;
      }
      return query(...args);
    };
    try {
      await assert.rejects(createOnlineArchive(reader,configuration,parent,job,[],AbortSignal.timeout(120000),{
        archives:'/archives',receipts:'/receipts',
      }), error => ['gateway_archive_verification_failed','gateway_catalog_dependency'].includes(error.code));
      assert.ok(mutated && passes === 2, 'late_fixture_boundary_missed');
      await assert.rejects(stat(`${parent}/gateway-archive-${job.id}/manifest.json`),{ code:'ENOENT' });
    } finally { reader.query = query; await writeFile(path,original); }
  }
  process.stdout.write('catalog_late_files_passed: dump, manifest, receipt and protection changes after real export refuse publication\n');
}
