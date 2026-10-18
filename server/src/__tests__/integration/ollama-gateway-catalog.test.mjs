/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { checkCatalogReader } from '../../ollamaGateway/catalogReader.mjs';
import { checkArchiveRole } from '../../ollamaGateway/archiveWorkerConfiguration.mjs';
import { captureCatalogContent, visitCatalogRows } from '../../ollamaGateway/catalogContent.mjs';
import { visitCatalogDependencyRows } from '../../ollamaGateway/catalogRowReader.mjs';
import { checkCatalogRelationships } from '../../ollamaGateway/catalogRelationships.mjs';
import { withArchiveMaintenance } from '../../ollamaGateway/archiveMaintenanceLock.mjs';
let owner, reader, job, report;
beforeEach(async () => {
  owner = await getPool().connect();
  await owner.query('DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
  for (const role of ['classifarr_gateway_cleanup_owner', 'catalog_test_reader']) {
    if ((await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await owner.query(`DROP OWNED BY ${role}; DROP ROLE ${role}`);
  }
  for (const name of ['ollama-gateway','ollama-gateway-archive','ollama-gateway-cleanup']) {
    await owner.query(await readFile(new URL(`../../../../database/${name}/current.sql`,import.meta.url),'utf8'));
  }
  await owner.query(`CREATE ROLE catalog_test_reader LOGIN PASSWORD 'synthetic-catalog-only';
    GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_test_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO catalog_test_reader;
    SELECT pg_advisory_lock(11435,4)`);
  const admission = (await owner.query(`UPDATE ollama_gateway.admission SET provider_hash=repeat('e',64),owner_id=uuidv7() RETURNING id,provider_hash`)).rows[0];
  report = { ledgerId: admission.id,providerHash: admission.provider_hash };
  job = (await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,created_at)
    VALUES($1,$2,repeat('a',64),repeat('b',64),1,'exporting','2026-10-17 00:00:00.123456+00') RETURNING id`,[report.ledgerId,report.providerHash])).rows[0];
  await owner.query('SELECT pg_advisory_unlock(11435,4)');
  reader = new pg.Client({ ...getPool().options,user: 'catalog_test_reader',password: 'synthetic-catalog-only' }); await reader.connect();
});
afterEach(async () => {
  await reader?.end();
  try {
    await owner.query('ROLLBACK; DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE; DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
    await owner.query('DROP OWNED BY classifarr_gateway_cleanup_owner,catalog_test_reader; DROP ROLE classifarr_gateway_cleanup_owner,catalog_test_reader');
  } finally { owner?.release(true); }
});
async function snapshot(action) {
  await reader.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL datestyle='ISO, YMD'");
  try { return await action(); } finally { await reader.query('ROLLBACK'); }
}
test('explicit real-login reader is safe, legacy reader boundary unchanged, mutations denied',async () => {
  await checkCatalogReader(reader);
  await expect(checkArchiveRole(reader,true)).rejects.toThrow('gateway_archive_role_unsafe');
  for (const query of ['UPDATE ollama_gateway.admission SET attempts=0','DELETE FROM gateway_archive.job',
    'UPDATE gateway_cleanup.operation SET attempt=1','SELECT gateway_cleanup.reconcile(NULL)']) {
    await expect(reader.query(query)).rejects.toMatchObject({ code: '42501' });
  }
});
test.each([
  'GRANT UPDATE ON gateway_archive.job TO catalog_test_reader',
  'GRANT UPDATE(attempt) ON gateway_cleanup.operation TO catalog_test_reader',
  'GRANT EXECUTE ON FUNCTION gateway_cleanup.reconcile(uuid) TO catalog_test_reader',
  'GRANT classifarr_gateway_cleanup_owner TO catalog_test_reader',
  'GRANT CREATE ON SCHEMA gateway_cleanup TO catalog_test_reader',
  'REVOKE SELECT ON gateway_archive.protection FROM catalog_test_reader',
])('reader refuses changed effective authority: %s',async query => {
  await owner.query(query); await expect(checkCatalogReader(reader)).rejects.toThrow('gateway_catalog_reader_unsafe');
});
test('same snapshot preserves microseconds and ignores later committed catalog changes',async () => {
  await snapshot(async () => {
    const before = await captureCatalogContent(reader,undefined,{ bytes: 0 });
    const rows = []; await visitCatalogRows(reader,0,row => rows.push(row.row));
    expect(rows[0]).toContain('2026-10-17T00:00:00.123456+00:00');
    await owner.query("SELECT pg_advisory_lock(11435,4); UPDATE gateway_archive.job SET retry_after='2026-10-17 00:05:00.654321+00'");
    expect(await captureCatalogContent(reader,undefined,{ bytes: 0 })).toEqual(before);
    await checkCatalogRelationships(reader,job.id,report);
  });
  await snapshot(async () => { const rows = []; await visitCatalogRows(reader,0,row => rows.push(row.row)); expect(rows[0]).toContain('654321'); });
});
test('oversized SQL rows are refused before transmission; aggregate budget and cancellation also refuse',async () => {
  await owner.query("SELECT pg_advisory_lock(11435,4); UPDATE gateway_archive.job SET manifest=jsonb_build_object('oversize',repeat('x',140000)),manifest_sha256=repeat('a',64)");
  await snapshot(async () => {
    const seen = []; await expect(visitCatalogRows(reader,0,row => seen.push(row.row))).rejects.toThrow('gateway_catalog_size_limit'); expect(seen).toEqual([]);
  });
  await owner.query('UPDATE gateway_archive.job SET manifest=NULL,manifest_sha256=NULL');
  await snapshot(() => expect(captureCatalogContent(reader,undefined,{ bytes: 268435456 })).rejects.toThrow('gateway_catalog_size_limit'));
  await snapshot(() => expect(captureCatalogContent(reader,AbortSignal.abort(),{ bytes: 0 })).rejects.toThrow());
});
test('unexpected schema and cross-ledger/pending claims fail closed',async () => {
  await snapshot(() => expect(checkCatalogRelationships(reader,job.id,{ ...report,ledgerId: '0199ea26-7d80-7000-8000-000000000001' })).rejects.toThrow());
  await owner.query('ALTER TABLE gateway_archive.job ADD COLUMN unexpected text');
  await snapshot(() => expect(captureCatalogContent(reader,undefined,{ bytes: 0 })).rejects.toThrow('gateway_catalog_schema'));
});
test('maintenance contention does not wait or execute capture',async () => {
  await owner.query('SELECT pg_advisory_lock(11435,4)'); let called = false;
  expect(await withArchiveMaintenance(reader,async () => { called=true; })).toEqual({ state: 'maintenance_busy',purgeAuthorized: false });
  expect(called).toBe(false);
});

async function failedHistory(count, padding = 0) {
  await owner.query('SELECT pg_advisory_lock(11435,4)');
  await owner.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,attempt,status,manifest_sha256,manifest)
    SELECT $1,$2,repeat('a',64),encode(sha256(convert_to(uuidv7()::text,'UTF8')),'hex'),1,'failed',repeat('a',64),
      jsonb_build_object('padding',repeat('x',$4::int)) FROM generate_series(1,$3::int) i`,
  [report.ledgerId,report.providerHash,count,padding]);
}

test('selective dependencies preserve exact canonical text/order while omitting failed payloads',async () => {
  await failedHistory(100,75000);
  await owner.query(`UPDATE gateway_archive.job SET status='verified',manifest_sha256=repeat('a',64),
    manifest='{"title":"日本語 🎬","version":4}',receipt='{}' WHERE id=$1`,[job.id]);
  await snapshot(async () => {
    const before = await captureCatalogContent(reader,undefined,{ bytes: 0 });
    const full = [], selected = [], empty = [];
    await visitCatalogRows(reader,0,row => full.push(row));
    await visitCatalogDependencyRows(reader,row => selected.push(row));
    await visitCatalogDependencyRows(reader,row => empty.push(row),undefined,new Set());
    expect(selected).toEqual(full.filter(row => JSON.parse(row.row).status === 'verified'));
    expect(selected[0].row).toContain('日本語 🎬');
    expect(selected[0].row).toContain('2026-10-17T00:00:00.123456+00:00');
    expect(empty).toEqual([]);
    expect(selected.reduce((bytes,row) => bytes+Buffer.byteLength(row.row),0))
      .toBeLessThan(full.reduce((bytes,row) => bytes+Buffer.byteLength(row.row),0)/1000);
    expect(await captureCatalogContent(reader,undefined,{ bytes: 0 })).toEqual(before);
  });
});

test('selection is parameterized, bounded and frozen before asynchronous reads',async () => {
  await owner.query(`SELECT pg_advisory_lock(11435,4); UPDATE gateway_archive.job SET status='verified',
    manifest_sha256=repeat('a',64),manifest='{"version":4}',receipt='{}'`);
  await snapshot(async () => {
    const expected = []; await visitCatalogRows(reader,0,row => expected.push(row));
    const selection = new Set([job.id]), rows = [];
    const reading = visitCatalogDependencyRows(reader,row => rows.push(row),undefined,selection);
    selection.clear();
    await reading; expect(rows).toEqual(expected);
  });
  for (const selected of [[],new Set(['invalid']),new Set(["') OR true --"]),new Set(Array.from({ length:10001 },(_,i) =>
    `0199ea26-7d80-7000-8000-${i.toString(16).padStart(12,'0')}`))]) {
    expect(() => visitCatalogDependencyRows(reader,() => {},undefined,selected)).toThrow('gateway_catalog_contract');
  }
});

test('excluded history retains its exact SQL byte boundary even with no selected dependencies',async () => {
  await failedHistory(1);
  await owner.query(`UPDATE gateway_archive.job j SET manifest=jsonb_build_object('padding',
    repeat('x',131072-octet_length(to_jsonb(j)::text))) WHERE status='failed'`);
  await snapshot(async () => {
    const rows = []; await visitCatalogDependencyRows(reader,row => rows.push(row),undefined,new Set());
    expect(rows).toEqual([]);
  });
  await owner.query(`UPDATE gateway_archive.job SET manifest=jsonb_set(manifest,'{padding}',to_jsonb((manifest->>'padding')||'x')) WHERE status='failed'`);
  await snapshot(() => expect(visitCatalogDependencyRows(reader,() => {},undefined,new Set())).rejects.toThrow('gateway_catalog_size_limit'));
});

test('excluded history still counts toward 10000 jobs and schema checks run independently',async () => {
  await failedHistory(9999);
  await snapshot(() => expect(visitCatalogDependencyRows(reader,() => {},undefined,new Set())).resolves.toBeUndefined());
  await failedHistory(1);
  await snapshot(() => expect(visitCatalogDependencyRows(reader,() => {},undefined,new Set())).rejects.toThrow('gateway_catalog_size_limit'));
  await owner.query('ALTER TABLE gateway_archive.job ADD COLUMN unexpected text');
  await snapshot(() => expect(visitCatalogDependencyRows(reader,() => {},undefined,new Set())).rejects.toThrow('gateway_catalog_schema'));
});

test('selective cursor remains in the snapshot and closes on cancellation or consumer failure',async () => {
  await owner.query(`SELECT pg_advisory_lock(11435,4); UPDATE gateway_archive.job SET status='verified',
    manifest_sha256=repeat('a',64),manifest='{"version":4}',receipt='{}'`);
  await snapshot(async () => {
    const before = []; await visitCatalogDependencyRows(reader,row => before.push(row));
    await owner.query("UPDATE gateway_archive.job SET reason='cancelled'");
    const after = []; await visitCatalogDependencyRows(reader,row => after.push(row));
    expect(after).toEqual(before);
    const control = new AbortController();
    await expect(visitCatalogDependencyRows(reader,() => { control.abort(); },control.signal)).rejects.toThrow();
    expect((await reader.query("SELECT count(*)::int AS n FROM pg_cursors WHERE name='gateway_catalog_cursor'")).rows[0].n).toBe(0);
    await expect(visitCatalogDependencyRows(reader,() => { throw new Error('synthetic_consumer_failure'); })).rejects.toThrow('synthetic_consumer_failure');
    expect((await reader.query("SELECT count(*)::int AS n FROM pg_cursors WHERE name='gateway_catalog_cursor'")).rows[0].n).toBe(0);
  });
});
