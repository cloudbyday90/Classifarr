/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { withOwnedCatalogSnapshot } from '/app/src/ollamaGateway/ownedCatalogSnapshot.mjs';
import { catalogJobRepository } from '/app/src/ollamaGateway/catalogJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { catalogDue } from '/app/src/ollamaGateway/catalogSchedule.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { catalogRetentionRepository } from '/app/src/ollamaGateway/catalogRetentionRepository.mjs';
import { readArchiveReceipt } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { validateCatalogVerification } from '/app/src/ollamaGateway/catalogVerificationResult.mjs';

const recordPath='/tmp/catalog-owned-pressure.json';
async function history(owner) {
  return (await owner.query(`SELECT 'archive' AS kind,id,to_jsonb(j)::text AS row FROM gateway_archive.job j
    UNION ALL SELECT 'catalog',id,to_jsonb(j)::text FROM gateway_catalog.job j ORDER BY kind,id`)).rows;
}

/** Controlled scheduling observation, real rows/dump/restore, no deadline or attempt resets. */
export async function runCatalogOwnedPressure({action,owner,configuration,paths,addRequest}) {
  await owner.query('SELECT pg_advisory_lock(11435,4)');
  if(action==='owned-prepare') {
    const before=(await owner.query('SELECT attempts::int,binding_count AS bindings FROM ollama_gateway.admission')).rows[0];
    assert.equal(before.attempts,before.bindings); assert.ok(before.bindings>0 && before.bindings<79998);
    const added=79998-before.bindings;
    await owner.query('BEGIN');
    try {
      await owner.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
        SELECT id,uuidv7(),owner_id,provider_hash,'owned-pressure-fixture',clock_timestamp()-interval '100 days',attempts+i,'unbound'
        FROM ollama_gateway.admission CROSS JOIN generate_series(1,$1::int) i`,[added]);
      await owner.query(`INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
        SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding WHERE installation='owned-pressure-fixture'`);
      await owner.query('UPDATE ollama_gateway.admission SET attempts=attempts+$1,binding_count=binding_count+$1',[added]);
      await owner.query('COMMIT');
    } catch(error) { await owner.query('ROLLBACK'); throw error; }
    return;
  }
  const repository=catalogJobRepository(owner);
  if(action==='owned-capture') {
    const original=await history(owner), jobs=await repository.list(), inferenceJobs=await archiveJobRepository(owner).list();
    const roots=await catalogRetentionRepository(owner).list();
    const captured=await withOwnedCatalogSnapshot(configuration,async view=>{
      assert.equal(view.report.bindingCount,80000); assert.equal(view.report.counterMatches,true);
      assert.equal(catalogDue({...view,jobs,inferenceJobs,roots,now:Date.parse(view.report.capturedAt)+3600001}),'due');
      const job=await repository.begin(view.report,view.revision,archivePolicyHash(90),view.semantic,view.compatibleRevisions);
      assert.equal(job.attempt,2);
      // A genuine claim/completion commits while the private frozen view remains open.
      await addRequest();
      const result=await view.capture({job,maintenance:owner,paths});
      assert.equal(result.manifest.version,7); assert.equal(result.manifest.report.bindingCount,80000);
      return {job,result};
    });
    await repository.published(captured.job.id,captured.result);
    await writeFile(recordPath,JSON.stringify({id:captured.job.id,original}),{mode:0o600,flag:'wx'});
    return;
  }
  assert.equal(action,'owned-check');
  const saved=JSON.parse(await readFile(recordPath,'utf8')), job=(await repository.list()).find(value=>value.id===saved.id);
  const receipt=await readArchiveReceipt(paths.receipts,job.id,validateCatalogVerification);
  assert.equal(receipt.rowsRestored,true); assert.equal(receipt.dependenciesAvailable,true);
  assert.equal(receipt.manifestSha256,job.manifest_sha256); assert.equal(receipt.dumpSha256,job.manifest.dump.sha256);
  const current=await history(owner), rows=new Map(current.map(row=>[row.id,row]));
  for(const row of saved.original) assert.deepEqual(rows.get(row.id),row);
  assert.equal(current.length,saved.original.length+1);
  assert.equal(job.manifest.report.bindingCount,80000); assert.equal(job.manifest.catalog.version,3);
  assert.deepEqual((await owner.query('SELECT attempts::int,binding_count AS bindings,active_request FROM ollama_gateway.admission')).rows[0],
    {attempts:80001,bindings:80001,active_request:null});
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM gateway_cleanup.operation')).rows[0].n,0);
  assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='classifarr-gateway-catalog-snapshot'")).rows[0].n,0);
  console.log(JSON.stringify({fixture:'owned-catalog-pressure',frozenBindings:80000,liveBindings:80001,attempt:job.attempt,
    restored:true,historyPreserved:true,purgeAuthorized:false,scheduling:'fixture_observation_only'}));
}
