/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { catalogRetentionService } from '/app/src/ollamaGateway/catalogRetentionService.mjs';
import { catalogRetentionRepository } from '/app/src/ollamaGateway/catalogRetentionRepository.mjs';

/** Final synthetic-fixture step: retain refuses excluded-history faults itself. */
export async function checkRetentionReadGuards(client) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  const paths = { catalogs:'/catalogs',archives:'/archives',receipts:'/receipts' };
  const service = catalogRetentionService(client), repository = catalogRetentionRepository(client);
  const roots = await repository.list(); assert.ok(roots.length >= 1);
  const root = roots.at(-1), pins = await repository.entries(root.id);
  await client.query('SELECT pg_advisory_lock(11435,4)');
  const inference = (await client.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows;
  const { id } = (await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,manifest_sha256,manifest)
    SELECT id,provider_hash,repeat('a',64),encode(sha256(convert_to(uuidv7()::text,'UTF8')),'hex'),1,'failed',repeat('a',64),
      jsonb_build_object('padding',repeat('x',140000)) FROM ollama_gateway.admission RETURNING id`)).rows[0];
  await assert.rejects(service.retain(paths,root.archive_id,root.verification),{ code:'gateway_catalog_size_limit' });
  await client.query("UPDATE gateway_archive.job SET manifest='{}' WHERE id=$1",[id]);
  await client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status)
    SELECT id,provider_hash,repeat('a',64),encode(sha256(convert_to(uuidv7()::text,'UTF8')),'hex'),1,'failed'
    FROM ollama_gateway.admission CROSS JOIN generate_series(1,10001-(SELECT count(*)::int FROM gateway_archive.job)) i`);
  await assert.rejects(service.retain(paths,root.archive_id,root.verification),{ code:'gateway_catalog_size_limit' });
  assert.deepEqual(await repository.list(),roots); assert.deepEqual(await repository.entries(root.id),pins);
  assert.deepEqual((await client.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows,inference);
  process.stdout.write('catalog_retention_read_guards_passed: excluded oversized row and 10001 jobs refuse; roots, pins and inference unchanged\n');
}
