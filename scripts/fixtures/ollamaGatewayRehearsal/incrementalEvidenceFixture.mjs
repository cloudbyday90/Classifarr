/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
import { openGatewayLedger } from '/app/src/ollamaGateway/ledger.mjs';
import { withOnlineArchiveSnapshot,createOnlineArchive } from '/app/src/ollamaGateway/onlineArchive.mjs';
import { archiveJobRepository } from '/app/src/ollamaGateway/archiveJobRepository.mjs';
import { archivePolicyHash } from '/app/src/ollamaGateway/archiveSchedule.mjs';
import { readVerifiedGatewayArchive } from '/app/src/ollamaGateway/archiveFiles.mjs';
import { managedArchivePath,readArchiveReceipt } from '/app/src/ollamaGateway/archiveManagedFiles.mjs';
import { ensureArchiveProtection } from '/app/src/ollamaGateway/archiveProtectionFiles.mjs';
import { candidateBatchSha256 } from '/app/src/ollamaGateway/archiveProtectionPolicy.mjs';

/** Synthetic history construction, not accelerated production scheduling or reset budgets. */
export async function incrementalEvidenceFixture(client,action,configuration) {
  assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
  assert.equal(configuration.database.database,'gateway_catalog_qualification');
  const repository=archiveJobRepository(client);
  await client.query('SELECT pg_advisory_lock(11435,4)');
  if (action==='evidence-seed') {
    await client.query(`CREATE ROLE qualification_cleanup LOGIN;
      GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO qualification_cleanup;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO qualification_cleanup;
      GRANT EXECUTE ON FUNCTION gateway_cleanup.admit(uuid,text,text,text),gateway_cleanup.execute_batch(uuid,integer),
        gateway_cleanup.reconcile(uuid) TO qualification_cleanup`);
    await writeFile('/configuration/cleanup.json',JSON.stringify({ database:{ ...configuration.database,host:'/source-socket',user:'qualification_cleanup' },
      providerHash:configuration.providerHash,retentionDays:90,archives:'/archives',receipts:'/receipts' }),{ flag:'wx',mode:0o600 });
    await client.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
      SELECT id,uuidv7(),owner_id,provider_hash,'synthetic',clock_timestamp()-interval '100 days',i,'unbound'
      FROM ollama_gateway.admission CROSS JOIN generate_series(1,100) i;
      INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
      SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding;
      UPDATE ollama_gateway.admission SET attempts=100,binding_count=100`);
    return { seeded:100 };
  }
  if (action==='evidence-generate') {
    const reader=new pg.Client(configuration.database), ledger=await openGatewayLedger(client,configuration.providerHash), ids=[];
    try {
      await reader.connect();
      for (let pair=0;pair<10;pair++) {
        const request=await ledger.claim('synthetic'); assert.ok(request);
        await ledger.complete(request,false,{ state:'response_completed',httpStatus:200 });
        const snapshot=await withOnlineArchiveSnapshot(reader,configuration,async value => value);
        for (let attempt=1;attempt<=2;attempt++) {
          const { id }=(await client.query('SELECT uuidv7() AS id')).rows[0];
          const job={ id,ledger_id:snapshot.report.ledgerId,provider_hash:configuration.providerHash,
            revision:snapshot.revision,policy_hash:archivePolicyHash(90),attempt };
          await createOnlineArchive(reader,configuration,'/archives',job,[],AbortSignal.timeout(120000)); ids.push(id);
        }
      }
    } finally { await reader.end(); }
    await writeFile('/configuration/evidence-batch.json',JSON.stringify(ids),{ mode:0o600 });
    return { captured:ids.length };
  }
  if (action==='evidence-accept') {
    const ids=JSON.parse(await readFile('/configuration/evidence-batch.json','utf8'));
    assert.equal(ids.length,20);
    for (let index=0;index<ids.length;index+=2) {
      const pair=[];
      for (const [offset,id] of ids.slice(index,index+2).entries()) {
        const checked=await readVerifiedGatewayArchive(managedArchivePath('/archives',id));
        const receipt=await readArchiveReceipt('/receipts',id); assert.equal(receipt.verified,true);
        assert.equal(receipt.manifestSha256,checked.manifestSha256); const m=checked.manifest;
        await client.query(`INSERT INTO gateway_archive.job(id,ledger_id,provider_hash,policy_hash,revision,attempt,status,
          manifest,manifest_sha256,receipt,completed_at) VALUES($1,$2,$3,$4,$5,$6,'verified',$7,$8,$9,clock_timestamp())`,
        [id,m.report.ledgerId,m.report.providerHash,m.policyHash,m.revision,offset+1,m,checked.manifestSha256,receipt]);
        pair.push({ id,ledger_id:m.report.ledgerId,provider_hash:m.report.providerHash,manifest_sha256:checked.manifestSha256 });
      }
      const rows=(await repository.list()).filter(job => pair.some(member => member.id===job.id));
      const first=await repository.evidence(rows[0]);
      const hold=await repository.protect(pair,candidateBatchSha256(first.manifest.retention));
      for (const row of (await repository.list()).filter(job => job.recovery_protection_id===hold.id)) {
        const job=await repository.evidence(row); await ensureArchiveProtection(managedArchivePath('/archives',job.id),job);
      }
      await repository.ready(hold.id);
    }
    return (await client.query(`SELECT count(*)::int AS archives,sum(octet_length(to_jsonb(j)::text))::float8 AS evidenceBytes,
      sum(octet_length(jsonb_build_array(j.manifest,j.receipt)::text))::float8 AS payloadBytes
      FROM gateway_archive.job j`)).rows[0];
  }
  const [last]=(await repository.list()).slice(-1);
  const path=`${managedArchivePath('/archives',last.id)}/protection.json`;
  if (action==='evidence-tamper') {
    await writeFile('/configuration/evidence-marker.json',await readFile(path),{ flag:'wx',mode:0o600 });
    await writeFile(path,'{}'); return { tampered:last.id };
  }
  if (action==='evidence-repair-fixture') {
    await writeFile(path,await readFile('/configuration/evidence-marker.json')); return { restored:last.id };
  }
  throw new Error('incremental_evidence_fixture_action');
}
