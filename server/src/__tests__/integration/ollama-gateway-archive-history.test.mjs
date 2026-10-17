/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { getPool } from './setup.mjs';
import { archiveJobRepository } from '../../ollamaGateway/archiveJobRepository.mjs';

let client;
beforeEach(async () => {
  client = await getPool().connect();
  await client.query('DROP SCHEMA IF EXISTS gateway_catalog CASCADE; DROP SCHEMA IF EXISTS gateway_cleanup CASCADE; DROP SCHEMA IF EXISTS gateway_archive CASCADE');
  await client.query(await readFile(new URL('../../../../database/ollama-gateway-archive/current.sql',import.meta.url),'utf8'));
});
afterEach(async () => { try { await client.query('DROP SCHEMA gateway_archive CASCADE'); } finally { client.release(true); } });
const seed = (count, bytes, status='verified') => client.query(`INSERT INTO gateway_archive.job(ledger_id,provider_hash,policy_hash,revision,
  attempt,status,manifest,manifest_sha256,receipt,completed_at,retry_after)
  SELECT uuidv7(),repeat('a',64),repeat('a',64),repeat('a',64),1,$3,
    jsonb_build_object('nested',repeat('x',$2::int)),repeat('b',64),'{}',clock_timestamp(),clock_timestamp()+interval '5 minutes'
  FROM generate_series(1,$1::int)`,[count,bytes,status]);

test('bounded history read preserves native timestamps, complete payloads and ordering',async () => {
  await seed(2,100);
  const rows=await archiveJobRepository(client).list(); expect(rows).toHaveLength(2);
  expect(rows[0].completed_at).toBeInstanceOf(Date); expect(rows[0].retry_after).toBeInstanceOf(Date);
  expect(rows[0].manifest).toEqual({ nested:'x'.repeat(100) }); expect(rows[0].receipt).toEqual({});
  expect(rows[0].id < rows[1].id).toBe(true); expect(Object.keys(rows[0])).not.toContain('history_bytes');
});
test('aggregate nested evidence is refused without sending its payloads to Node',async () => {
  await seed(200,60000);
  let transmitted=0;
  const observed={ query:async (...args) => { const result=await client.query(...args); transmitted+=Buffer.byteLength(JSON.stringify(result.rows)); return result; } };
  let outcome='returned';
  try { await archiveJobRepository(observed).list(); } catch (error) { outcome=error.code; }
  expect(outcome).toBe('gateway_archive_history_size_limit');
  expect(transmitted).toBeLessThan(4096);
  expect((await client.query('SELECT count(*)::int AS n FROM gateway_archive.job')).rows[0].n).toBe(200);
});
test('inert failed payloads are not materialized or charged as active evidence',async () => {
  await seed(200,60000,'failed');
  const rows=await archiveJobRepository(client).list(); expect(rows).toHaveLength(200);
  expect(rows.every(row => row.manifest===null && row.receipt===null)).toBe(true);
});
test('existing row capacity still refuses excess historical jobs without dropping attempts',async () => {
  await seed(10001,0,'failed');
  await expect(archiveJobRepository(client).list()).rejects.toMatchObject({ code:'gateway_archive_job_capacity' });
  expect((await client.query('SELECT sum(attempt)::int AS n FROM gateway_archive.job')).rows[0].n).toBe(10001);
});
