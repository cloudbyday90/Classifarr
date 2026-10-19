/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';

export const reuseConnection = {host:'/var/run/postgresql',user:'classifarr',database:'gateway_snapshot_reuse'};
export const reuseConfiguration = {providerHash:'d'.repeat(64),retentionDays:90};

export async function setupReuseData() {
  const admin = new pg.Client({...reuseConnection,database:'classifarr'}); await admin.connect();
  try {
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM libraries')).rows[0].n,0);
    await admin.query('CREATE DATABASE gateway_snapshot_reuse'); await admin.query('CREATE ROLE snapshot_reuse_reader LOGIN');
  } finally { await admin.end(); }
  const owner = new pg.Client(reuseConnection); await owner.connect();
  try {
    for (const name of ['ollama-gateway','ollama-gateway-archive','ollama-gateway-cleanup','ollama-gateway-catalog']) {
      await owner.query(await readFile(`/app/database/${name}/current.sql`,'utf8'));
    }
    await owner.query(`GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO snapshot_reuse_reader;
      GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO snapshot_reuse_reader;
      GRANT SELECT ON gateway_catalog.job TO snapshot_reuse_reader`);
    await owner.query('SELECT pg_advisory_lock(11435,4)');
    // Component-only synthetic history: no attempt to simulate an 80k pressure admission.
    await owner.query('BEGIN');
    await owner.query('UPDATE ollama_gateway.admission SET provider_hash=$1,owner_id=uuidv7()',[reuseConfiguration.providerHash]);
    await owner.query(`INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
      SELECT id,uuidv7(),owner_id,provider_hash,'snapshot-study',clock_timestamp()-interval '100 days',i,'unbound'
      FROM ollama_gateway.admission CROSS JOIN generate_series(1,110) i;
      INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
      SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding;
      UPDATE ollama_gateway.admission SET attempts=110,binding_count=110`);
    await owner.query('COMMIT');
    await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,reason,completed_at,manifest,manifest_sha256)
      SELECT id,provider_hash,repeat('e',64),encode(sha256(convert_to(i::text,'UTF8')),'hex'),1,'failed','export_failed',clock_timestamp(),'{}',repeat('f',64)
      FROM ollama_gateway.admission CROSS JOIN generate_series(1,256) i`);
    for (const value of ['catalog-one','catalog-two']) {
      const job = (await owner.query(`INSERT INTO gateway_catalog.job(ledger_id,provider_hash,policy_hash,revision,compatible_revisions,semantic_sha256,attempt,status)
        SELECT id,provider_hash,repeat('e',64),r,ARRAY[r],repeat('a',64),1,'exporting'
        FROM ollama_gateway.admission CROSS JOIN (SELECT encode(sha256(convert_to($1::text,'UTF8')),'hex') AS r) s RETURNING id`,[value])).rows[0];
      await owner.query("UPDATE gateway_catalog.job SET status='failed',reason='export_failed',completed_at=clock_timestamp() WHERE id=$1",[job.id]);
    }
  } finally { await owner.end(); }
}

export async function widenReuseData(owner) {
  // Real wider JSON bodies; compressible on purpose, not a TOAST/storage benchmark.
  await owner.query(`UPDATE gateway_archive.job SET manifest=jsonb_build_object('fixturePadding',repeat('x',65536))`);
}

export async function reuseGuard(owner) {
  return (await owner.query(`SELECT attempts::text,binding_count,active_request,cooldown_until,
    (SELECT count(*)::int FROM ollama_gateway.completion_receipt) AS completions,
    (SELECT count(*)::int FROM gateway_cleanup.operation) AS cleanup,
    (SELECT count(*)::int FROM gateway_archive.protection) AS protections,
    (SELECT count(*)::int FROM gateway_catalog.snapshot) AS roots,
    (SELECT count(*)::int FROM gateway_archive.job) AS archive_jobs,
    (SELECT sum(attempt)::int FROM gateway_archive.job) AS archive_attempts,
    (SELECT sum(attempt)::int FROM gateway_catalog.job) AS catalog_attempts,
    (SELECT count(*)::int FROM ollama_gateway.request_binding WHERE uuid_extract_version(id)=7 AND uuid_extract_version(request_id)=7) AS uuidv7
    FROM ollama_gateway.admission`)).rows[0];
}
