/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { createOllamaApplicationFixture } from './helpers/ollamaApplicationFixture.mjs';
import { withOnlineArchiveSnapshot, assertArchiveSnapshot } from '../../ollamaGateway/onlineArchiveSnapshot.mjs';
import { catalogJobRepository } from '../../ollamaGateway/catalogJobRepository.mjs';
import { captureCatalogContent } from '../../ollamaGateway/catalogContent.mjs';
import { captureArchiveContent } from '../../ollamaGateway/archiveContent.mjs';
import { checkCatalogRelationships } from '../../ollamaGateway/catalogRelationships.mjs';
import { catalogSemanticRevision } from '../../ollamaGateway/catalogSchedule.mjs';
import { archivePolicyHash } from '../../ollamaGateway/archiveSchedule.mjs';
import { requireCatalogCaptureFormat, readCatalogAdmission, checkCatalogAdmissionHistory } from '../../ollamaGateway/catalogAdmission.mjs';
import { runCatalogAssessment } from '../../ollamaGateway/catalogCoordinator.mjs';
import { catalogSample, syntheticHash } from '../fixtures/gatewayCatalogRetention.mjs';
import { canonicalAdmission } from '../fixtures/gatewayCatalogAdmission.mjs';
import { withOwnedCatalogSnapshot } from '../../ollamaGateway/ownedCatalogSnapshot.mjs';
import { withCatalogSnapshotContent,captureSnapshotCatalogContent } from '../../ollamaGateway/catalogSnapshotContent.mjs';

let fixture, owner, source, configuration, repository;
const migration = name => readFile(new URL(`../../../../database/ollama-gateway-catalog/${name}`, import.meta.url), 'utf8');
beforeEach(async () => {
  await getPool().query('DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE');
  fixture = await createOllamaApplicationFixture(getPool(), null, async () => {
  owner = await getPool().connect();
  await owner.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='classifarr_gateway_cleanup_owner') THEN
    DROP OWNED BY classifarr_gateway_cleanup_owner; DROP ROLE classifarr_gateway_cleanup_owner; END IF; END $$`);
  for (const name of ['ollama-gateway-archive', 'ollama-gateway-cleanup', 'ollama-gateway-catalog']) {
    await owner.query(await readFile(new URL(`../../../../database/${name}/current.sql`, import.meta.url), 'utf8'));
  }
  await owner.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='frozen_source_reader') THEN
    DROP OWNED BY frozen_source_reader; DROP ROLE frozen_source_reader; END IF; END $$;
    CREATE ROLE frozen_source_reader LOGIN PASSWORD 'synthetic-frozen-only';
    GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO frozen_source_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup,gateway_catalog TO frozen_source_reader;
    SELECT pg_advisory_lock(11435,4); SET timezone='UTC'`);
  });
  source = new pg.Client({ ...getPool().options, user: 'frozen_source_reader', password: 'synthetic-frozen-only', options: '-c default_transaction_read_only=on' });
  await source.connect(); repository = catalogJobRepository(owner);
  configuration = { providerHash: (await owner.query('SELECT provider_hash FROM ollama_gateway.admission')).rows[0].provider_hash, retentionDays: 90 };
});
afterEach(async () => {
  await source?.end();
  try {
    await owner.query('ROLLBACK; DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE');
    await owner.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='frozen_source_reader') THEN
      DROP OWNED BY frozen_source_reader; DROP ROLE frozen_source_reader; END IF; END $$`);
  } finally { owner.release(true); await fixture?.close(); }
});
async function admitted(consume) {
  return withOnlineArchiveSnapshot(source, configuration, async context => {
    const tables = await captureCatalogContent(source, undefined, { bytes: 0 }, 3), semantic = catalogSemanticRevision(tables);
    const job = await repository.begin(context.report, context.revision, archivePolicyHash(90), semantic, context.compatibleRevisions);
    const manifest = { ...catalogSample(job.id, context.report.ledgerId, []).manifest, version: 7, report: context.report,
      revision: context.revision, policyHash: job.policy_hash, content: await captureArchiveContent(source),
      catalog: { version: 3, tables, semanticSha256: semantic, dependencies: { count: 0, bytes: 0, sha256: createHash('sha256').digest('hex') } } };
    manifest.catalog.admission = await readCatalogAdmission(owner, manifest);
    return consume({ context, job, manifest });
  });
}

function ownedConfiguration() {
  const {host,port,database}=getPool().options;
  return {...configuration,database:{host,port,database,user:'frozen_source_reader',password:'synthetic-frozen-only'}};
}
async function ownedConnections() {
  return (await owner.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='classifarr-gateway-catalog-snapshot'")).rows[0].n;
}

test('owned API confines transaction authority, remains frozen across unrelated transaction replacement and disposes escaped capture',async()=>{
  let escaped;
  await withOwnedCatalogSnapshot(ownedConfiguration(),async view=>{
    escaped=view; expect(await ownedConnections()).toBe(1);
    expect(Object.keys(view).sort()).toEqual(['capture','compatibleRevisions','report','revision','semantic','signal']);
    expect(view.query).toBeUndefined(); expect(view.end).toBeUndefined(); expect(view.connection).toBeUndefined();
    expect(()=>{view.report.counts.request_binding=99;}).toThrow();
    await source.query('BEGIN; COMMIT; BEGIN; ROLLBACK');
    const request=await fixture.ledger.claim('local'); await fixture.ledger.complete(request,false,{state:'response_completed',httpStatus:200});
    expect(view.report.bindingCount).toBe(0);
    expect(()=>view.capture({source,job:{},maintenance:owner,paths:{}})).toThrow('gateway_catalog_contract');
  });
  expect(()=>escaped.capture({job:{},maintenance:owner,paths:{}})).toThrow(); expect(await ownedConnections()).toBe(0);
  await withOwnedCatalogSnapshot(ownedConfiguration(),async view=>{expect(view.report.bindingCount).toBe(1);});
  expect(await ownedConnections()).toBe(0);
});

test('terminated private backend and cancellation cannot turn a callback result into success or leak sessions',async()=>{
  await expect(withOwnedCatalogSnapshot(ownedConfiguration(),async()=>{
    const rows=(await owner.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND application_name='classifarr-gateway-catalog-snapshot'")).rows;
    expect(rows).toHaveLength(1); await owner.query('SELECT pg_terminate_backend($1)',[rows[0].pid]); return 'must_not_succeed';
  })).rejects.toThrow();
  expect(await ownedConnections()).toBe(0);
  const controller=new AbortController();
  await expect(withOwnedCatalogSnapshot(ownedConfiguration(),()=>{controller.abort();return 'must_not_succeed';},controller.signal)).rejects.toThrow('gateway_archive_cancelled');
  expect(await ownedConnections()).toBe(0); expect(await repository.list()).toEqual([]);
});

test('real catalog reuse matches streamed summaries/charges and the exact original overflow row with prior charges',async()=>{
  await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,reason,completed_at)
    SELECT id,provider_hash,$1,encode(sha256(convert_to(i::text,'UTF8')),'hex'),1,'failed','export_failed',clock_timestamp()
    FROM ollama_gateway.admission CROSS JOIN generate_series(1,3) i`,[archivePolicyHash(90)]);
  await withOnlineArchiveSnapshot(source,configuration,async context=>{
    const bytes={bytes:0}, expected=await captureCatalogContent(source,undefined,bytes,3);
    await withCatalogSnapshotContent(source,context,undefined,async()=>{
      const successful={bytes:37}; expect(await captureSnapshotCatalogContent(source,context,undefined,successful)).toEqual(expected);
      expect(successful.bytes).toBe(bytes.bytes+37);
      for(const remaining of [0,1,500,bytes.bytes-1]){
        const original={bytes:268435456-remaining}, reused={...original};
        await expect(captureCatalogContent(source,undefined,original,3)).rejects.toThrow('gateway_catalog_size_limit');
        await expect(captureSnapshotCatalogContent(source,context,undefined,reused)).rejects.toThrow('gateway_catalog_size_limit');
        expect(reused.bytes).toBe(original.bytes);
        expect((await source.query("SELECT count(*)::int AS n FROM pg_cursors WHERE name='gateway_catalog_cursor'")).rows[0].n).toBe(0);
      }
      await expect(captureCatalogContent(source,undefined,{bytes:0},3,1)).rejects.toThrow('gateway_catalog_contract');
    });
  });
});

test('owned snapshot handles genuine 80k synthetic bindings without counter resets and isolates concurrent inference',async()=>{
  expect((await owner.query('SELECT attempts::text,binding_count FROM ollama_gateway.admission')).rows[0]).toEqual({attempts:'0',binding_count:0});
  await owner.query(`BEGIN;
    INSERT INTO ollama_gateway.request_binding(ledger_id,request_id,owner_id,provider_hash,installation,admitted_at,attempt,evidence_kind)
    SELECT id,uuidv7(),owner_id,provider_hash,'owned-pressure-fixture',clock_timestamp()-interval '100 days',i,'unbound'
    FROM ollama_gateway.admission CROSS JOIN generate_series(1,80000) i;
    INSERT INTO ollama_gateway.completion_receipt(request_id,outcome,http_status,recorded_at)
    SELECT request_id,'response_completed',200,admitted_at FROM ollama_gateway.request_binding;
    UPDATE ollama_gateway.admission SET attempts=80000,binding_count=80000; COMMIT;`);
  await withOwnedCatalogSnapshot(ownedConfiguration(),async view=>{
    expect(view.report).toMatchObject({attempts:'80000',bindingCount:80000,counterMatches:true});
    const request=await fixture.ledger.claim('local'); await fixture.ledger.complete(request,false,{state:'response_completed',httpStatus:200});
    expect(view.report.counts.request_binding).toBe(80000); expect(view.report.counts.completion_receipt).toBe(80000);
  });
  expect((await owner.query('SELECT attempts::text,binding_count,active_request FROM ollama_gateway.admission')).rows[0]).toEqual({attempts:'80001',binding_count:80001,active_request:null});
  expect((await owner.query('SELECT count(*)::int AS n FROM gateway_cleanup.operation')).rows[0].n).toBe(0);
  expect(await ownedConnections()).toBe(0);
});

test('one frozen SELECT-only view survives actual admission/completion and retains a separate immutable job', async () => {
  let saved;
  await admitted(async ({ context, job, manifest }) => {
    saved = context; assertArchiveSnapshot(source, context);
    await expect(withOnlineArchiveSnapshot(source, configuration, () => {})).rejects.toThrow('gateway_archive_snapshot_invalid');
    assertArchiveSnapshot(source, context);
    expect(() => assertArchiveSnapshot(owner, context)).toThrow('gateway_archive_snapshot_invalid');
    const request = await fixture.ledger.claim('local'); await fixture.ledger.complete(request, false, { state: 'response_completed', httpStatus: 200 });
    expect((await source.query('SELECT count(*)::int AS n FROM ollama_gateway.request_binding')).rows[0].n).toBe(0);
    expect((await owner.query('SELECT count(*)::int AS n FROM ollama_gateway.request_binding')).rows[0].n).toBe(1);
    expect((await source.query('SELECT count(*)::int AS n FROM gateway_catalog.job')).rows[0].n).toBe(0);
    expect((await owner.query('SELECT count(*)::int AS n FROM gateway_catalog.job')).rows[0].n).toBe(1);
    await checkCatalogRelationships(source, job.id, context.report, 3);
    await checkCatalogAdmissionHistory(source, manifest);
    const altered = structuredClone(manifest), alteredRow = JSON.parse(manifest.catalog.admission.row);
    alteredRow.attempt = 2; altered.catalog.admission.row = canonicalAdmission(alteredRow);
    altered.catalog.admission.sha256 = createHash('sha256').update(altered.catalog.admission.row).digest('hex');
    await expect(checkCatalogAdmissionHistory(source, altered)).rejects.toThrow('gateway_catalog_budget_blocked');
    expect(await captureCatalogContent(source, undefined, { bytes: 0 }, 3)).toEqual(manifest.catalog.tables);
    await expect(checkCatalogRelationships(source, job.id, context.report, 2)).rejects.toThrow();
  });
  expect(() => assertArchiveSnapshot(source, saved)).toThrow('gateway_archive_snapshot_invalid');
  await withOnlineArchiveSnapshot(source, configuration, async next => { expect(next.report.counts.request_binding).toBe(1); });
});
test('cancelled and fabricated contexts cannot authorize capture', async () => {
  const controller = new AbortController(); let saved;
  await expect(withOnlineArchiveSnapshot(source, configuration, async context => { saved = context; controller.abort(); }, controller.signal)).rejects.toThrow();
  expect(() => assertArchiveSnapshot(source, saved)).toThrow(); expect(() => assertArchiveSnapshot(source, {})).toThrow();
  expect((await source.query('SELECT 1 AS n')).rows[0].n).toBe(1);
});
test('SQL publication requires the original job and canonical record hash, not just JavaScript validation', async () => {
  await admitted(async ({ job, manifest }) => {
    // Contract-only fake dump descriptor: this does not claim a real export/restore.
    const row = JSON.parse(manifest.catalog.admission.row);
    for (const mutate of [value => { value.catalog.admission.sha256 = syntheticHash; },
      value => { value.catalog.admission.row = canonicalAdmission({ ...row, attempt: 3 }); value.catalog.admission.sha256 = createHash('sha256').update(value.catalog.admission.row).digest('hex'); },
      value => { value.catalog.admission = null; }, value => { value.version = 6; }]) {
      const bad = structuredClone(manifest); mutate(bad);
      await expect(owner.query("UPDATE gateway_catalog.job SET status='awaiting_verification',manifest=$2,manifest_sha256=$3 WHERE id=$1",
        [job.id, bad, syntheticHash])).rejects.toThrow();
      expect((await repository.list())[0].status).toBe('exporting');
    }
    await repository.published(job.id, { manifest, manifestSha256: syntheticHash });
    expect((await repository.list())[0]).toMatchObject({ status: 'awaiting_verification', attempt: 1, revision: job.revision });
  });
});
test('missing format capability refuses the real coordinator before any source read or admission', async () => {
  await owner.query('DROP FUNCTION gateway_catalog.capture_format()');
  const untouched = { query: () => { throw new Error('source_must_not_be_read'); } };
  await expect(runCatalogAssessment({ source: untouched, maintenance: owner })).rejects.toThrow('gateway_catalog_format_unavailable');
  expect(await repository.list()).toEqual([]);
});
test('explicit old-v2 upgrade preserves failed jobs, ordinals and cooldowns exactly', async () => {
  await owner.query('DROP SCHEMA gateway_catalog CASCADE');
  for (const name of ['20261017_230000_catalog_retention.sql', '20261017_235000_catalog_jobs.sql']) await owner.query(await migration(name));
  await expect(requireCatalogCaptureFormat(owner)).rejects.toThrow('gateway_catalog_format_unavailable');
  const identity = await withOnlineArchiveSnapshot(source, configuration, value => value);
  const job = await repository.begin(identity.report, identity.revision, archivePolicyHash(90), syntheticHash, identity.compatibleRevisions);
  await repository.failed(job.id, 'cancelled');
  const before = (await owner.query('SELECT to_jsonb(j)::text AS row FROM gateway_catalog.job j')).rows;
  await owner.query(await migration('20261018_130000_frozen_snapshot.sql')); await requireCatalogCaptureFormat(owner);
  expect((await owner.query('SELECT to_jsonb(j)::text AS row FROM gateway_catalog.job j')).rows).toEqual(before);
  await expect(repository.begin(identity.report, identity.revision, archivePolicyHash(90), syntheticHash, identity.compatibleRevisions)).rejects.toThrow('gateway_catalog_budget_blocked');
});
test('upgrade refuses unfinished work, retaining the admitted job and absence of new capability', async () => {
  await owner.query('DROP SCHEMA gateway_catalog CASCADE');
  for (const name of ['20261017_230000_catalog_retention.sql', '20261017_235000_catalog_jobs.sql']) await owner.query(await migration(name));
  const identity = await withOnlineArchiveSnapshot(source, configuration, value => value);
  const job = await repository.begin(identity.report, identity.revision, archivePolicyHash(90), syntheticHash, identity.compatibleRevisions);
  await expect(owner.query(await migration('20261018_130000_frozen_snapshot.sql'))).rejects.toThrow('gateway_catalog_upgrade_blocked');
  await owner.query('ROLLBACK');
  expect((await repository.list())[0]).toMatchObject({ id: job.id, status: 'exporting', attempt: 1 });
  await expect(requireCatalogCaptureFormat(owner)).rejects.toThrow('gateway_catalog_format_unavailable');
});
