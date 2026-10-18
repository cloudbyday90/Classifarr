/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { getPool } from './setup.mjs';
import { archiveJobRepository } from '../../ollamaGateway/archiveJobRepository.mjs';
import { readArchiveHistory } from '../../ollamaGateway/archiveHistoryReader.mjs';
import { HISTORY_REFERENCE_SQL, HISTORY_REFERENCE_VALUES } from '../../../../scripts/fixtures/ollamaGatewayRehearsal/historyQueryReference.mjs';
import { studyPadding } from '../../../../scripts/fixtures/ollamaGatewayRehearsal/studyHistory.mjs';

let client;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query("SET timezone='UTC'; SET datestyle='ISO, YMD'");
  await client.query('DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE');
  await client.query(await readFile(new URL('../../../../database/ollama-gateway-archive/current.sql',import.meta.url),'utf8'));
});
afterEach(async () => { try { await client.query('DROP SCHEMA gateway_archive CASCADE'); } finally { client.release(true); } });
const seed = (count, bytes, status='verified') => client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,
  attempt,status,manifest,manifest_sha256,receipt,completed_at,retry_after)
  SELECT uuidv7(),repeat('a',64),repeat('a',64),repeat('a',64),1,$3,
    jsonb_build_object('nested',repeat('x',$2::int)),repeat('b',64),'{}',clock_timestamp(),clock_timestamp()+interval '5 minutes'
  FROM generate_series(1,$1::int)`,[count,bytes,status]);

test('compact history preserves native timestamps and ordered identity; details are explicit',async () => {
  await seed(2,100);
  await client.query("UPDATE gateway_archive.job SET created_at='2026-10-18T00:00:00Z'");
  const rows=await archiveJobRepository(client).list(); expect(rows).toHaveLength(2);
  expect(rows[0].completed_at).toBeInstanceOf(Date); expect(rows[0].retry_after).toBeInstanceOf(Date);
  expect(rows[0]).not.toHaveProperty('manifest'); expect(rows[0]).not.toHaveProperty('receipt');
  const evidence=await archiveJobRepository(client).evidence(rows[0]);
  expect(evidence.manifest).toEqual({ nested:'x'.repeat(100) }); expect(evidence.receipt).toEqual({});
  expect(rows[0].id < rows[1].id).toBe(true); expect(Object.keys(rows[0])).not.toContain('history_bytes');
});
test('aggregate nested evidence above 8 MiB is consumed individually, never as a full list',async () => {
  await seed(200,60000);
  let largestTransfer=0, bytes=0;
  const observed={ query:async (...args) => { const result=await client.query(...args); largestTransfer=Math.max(largestTransfer,Buffer.byteLength(JSON.stringify(result.rows))); return result; } };
  const repository=archiveJobRepository(observed), jobs=await repository.list();
  for (const job of jobs) bytes+=Buffer.byteLength((await repository.evidence(job)).manifest.nested);
  expect(bytes).toBe(12000000); expect(largestTransfer).toBeLessThan(262144);
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_archive.job')).rows[0].n).toBe(200);
});
test('inert failed payloads are not materialized or charged as active evidence',async () => {
  await seed(200,60000,'failed');
  const rows=await archiveJobRepository(client).list(); expect(rows).toHaveLength(200);
  expect(rows.every(row => !('manifest' in row) && !('receipt' in row))).toBe(true);
});

test('one oversized active record is refused before its payload reaches Node',async () => {
  await seed(1,131073);
  const [job]=await archiveJobRepository(client).list(); let transferred=0;
  const observed={ query:async (...args) => { const result=await client.query(...args); transferred+=Buffer.byteLength(JSON.stringify(result.rows)); return result; } };
  await expect(archiveJobRepository(observed).evidence(job)).rejects.toMatchObject({ code:'gateway_archive_history_size_limit' });
  expect(transferred).toBeLessThan(4096);
});

test('changed payload with the same stored manifest hash cannot reuse captured metadata',async () => {
  await seed(1,10); const repository=archiveJobRepository(client), [job]=await repository.list();
  await client.query("UPDATE gateway_archive.job SET receipt='{\"changed\":true}' WHERE id=$1",[job.id]);
  await expect(repository.evidence(job)).rejects.toMatchObject({ code:'gateway_archive_job_fence' });
});

test('sub-millisecond timestamp changes cannot hide behind native Date rounding',async () => {
  await seed(1,10);
  await client.query("UPDATE gateway_archive.job SET completed_at='2026-10-18T00:00:00.000001Z'");
  const repository=archiveJobRepository(client),[job]=await repository.list();
  await client.query("UPDATE gateway_archive.job SET completed_at='2026-10-18T00:00:00.000002Z'");
  const [changed]=await repository.list(); expect(changed.completed_at).toEqual(job.completed_at);
  await expect(repository.evidence(job)).rejects.toMatchObject({ code:'gateway_archive_job_fence' });
});

test.each(['status','revision','provider_hash','policy_hash','completed_at'])('changed %s invalidates a selected record',async field => {
  await seed(1,10); const repository=archiveJobRepository(client),[job]=await repository.list();
  const updates={ status:"status='retiring'",revision:"revision=repeat('c',64)",provider_hash:"provider_hash=repeat('c',64)",
    policy_hash:"policy_hash=repeat('c',64)",completed_at:"completed_at=completed_at+interval '1 second'" };
  await client.query(`UPDATE gateway_archive.job SET ${updates[field]} WHERE id=$1`,[job.id]);
  await expect(repository.evidence(job)).rejects.toMatchObject({ code:'gateway_archive_job_fence' });
});

test('exact 128 KiB detail boundary permits the bound and rejects the next byte',async () => {
  await seed(1,10); const repository=archiveJobRepository(client); let bytes;
  const measured={ query:async (...args) => { const result=await client.query(...args); bytes=result.rows[0].evidence_bytes; return result; } };
  let [job]=await repository.list(); await archiveJobRepository(measured).evidence(job);
  const padding=10+131072-bytes;
  await client.query("UPDATE gateway_archive.job SET manifest=jsonb_build_object('nested',repeat('x',$1::int))",[padding]);
  [job]=await repository.list(); await archiveJobRepository(measured).evidence(job); expect(bytes).toBe(131072);
  await client.query("UPDATE gateway_archive.job SET manifest=jsonb_build_object('nested',repeat('x',$1::int))",[padding+1]);
  [job]=await repository.list();
  await expect(repository.evidence(job)).rejects.toMatchObject({ code:'gateway_archive_history_size_limit' });
});

test('deleted identity and cancelled detail reads refuse without writes',async () => {
  await seed(1,10); const repository=archiveJobRepository(client), [job]=await repository.list();
  const controller=new AbortController(); controller.abort();
  await expect(repository.evidence(job,controller.signal)).rejects.toMatchObject({ name:'AbortError' });
  await client.query('DELETE FROM gateway_archive.job WHERE id=$1',[job.id]);
  await expect(repository.evidence(job)).rejects.toMatchObject({ code:'gateway_archive_job_fence' });
});
test('existing row capacity still refuses excess historical jobs without dropping attempts',async () => {
  await seed(10001,0,'failed');
  await expect(archiveJobRepository(client).list()).rejects.toMatchObject({ code:'gateway_archive_job_capacity' });
  expect((await client.query('SELECT sum(attempt)::int AS n FROM gateway_archive.job')).rows[0].n).toBe(10001);
});

// Keep microsecond precision in the raw comparison, before the production native Date boundary.
const rawTypes = { getTypeParser(oid, format) { return [1114,1184].includes(oid) ? value => value : pg.types.getTypeParser(oid, format); } };
async function compareRawHistory() {
  const expected = await client.query({ text: HISTORY_REFERENCE_SQL, values: HISTORY_REFERENCE_VALUES, types: rawTypes });
  let observed;
  const rows = await readArchiveHistory({ query: async (text, values) => {
    observed = await client.query({ text, values, types: rawTypes }); return observed;
  } });
  expect(observed.rows).toEqual(expected.rows);
  expect(observed.fields.map(field => [field.name, field.dataTypeID])).toEqual(expected.fields.map(field => [field.name, field.dataTypeID]));
  expect(rows).toHaveLength(expected.rows[0].history_count);
  return observed.rows;
}

test.each(['exporting','awaiting_verification','verified','failed','interrupted','retiring','retired'])
('raw SQL history, budgets and fingerprints equal the fixed reference for %s',async status => {
  await seed(1,123,status); await seed(2,0,'failed');
  const failed = (await client.query("SELECT id FROM gateway_archive.job WHERE status='failed' ORDER BY id")).rows;
  for (const [index, row] of failed.entries()) await client.query(
    'UPDATE gateway_archive.job SET manifest=jsonb_build_object(\'nested\',$2::text) WHERE id=$1',
    [row.id, studyPadding(index).slice(0, 1000 + index * 31000)]);
  await client.query("UPDATE gateway_archive.job SET created_at='2026-10-18T00:00:00.000001Z',completed_at='2026-10-18T00:00:00.000002Z'");
  if (['exporting','failed','interrupted'].includes(status)) await client.query(
    'UPDATE gateway_archive.job SET manifest=NULL,manifest_sha256=NULL,receipt=NULL,completed_at=NULL,retry_after=NULL WHERE status=$1',[status]);
  const rows = await compareRawHistory();
  expect(rows).toHaveLength(3);
  expect(rows.every(row => row.created_at.endsWith('000001+00'))).toBe(true);
  expect(rows.every(row => row.protection === null)).toBe(true);
  expect(rows.filter(row => row.evidence_sha256 !== null)).toHaveLength(['verified','awaiting_verification','retiring'].includes(status) ? 1 : 0);
});

test('full protection metadata stays equivalent and a legitimate ready-at change invalidates old evidence',async () => {
  await seed(2,10);
  const ids = (await client.query('SELECT id FROM gateway_archive.job ORDER BY id')).rows.map(row => row.id);
  await client.query(`UPDATE gateway_archive.job SET ledger_id=$1,revision=encode(sha256(convert_to(id::text,'UTF8')),'hex'),
    manifest='{"version":4,"retention":{"entries":[{}]}}',
    receipt=jsonb_build_object('version',2,'verified',true,'manifestSha256',repeat('b',64))`,[ids[0]]);
  await client.query(`INSERT INTO gateway_archive.protection(ledger_id,provider_hash,candidates_sha256,first_archive_id,second_archive_id,
    first_manifest_sha256,second_manifest_sha256) VALUES($1,repeat('a',64),repeat('c',64),$2,$3,repeat('b',64),repeat('b',64))`,[ids[0],...ids]);
  const before = await compareRawHistory();
  const complete = (await client.query('SELECT to_jsonb(p) AS body FROM gateway_archive.protection p')).rows[0].body;
  expect(before.every(row => JSON.stringify(row.protection) === JSON.stringify(complete))).toBe(true);
  const repository = archiveJobRepository(client), [selected] = await repository.list();
  await client.query('UPDATE gateway_archive.protection SET ready_at=clock_timestamp()');
  const after = await compareRawHistory(); expect(after[0].protection.ready_at).not.toBeNull();
  await expect(repository.evidence(selected)).rejects.toMatchObject({ code: 'gateway_archive_job_fence' });
});
