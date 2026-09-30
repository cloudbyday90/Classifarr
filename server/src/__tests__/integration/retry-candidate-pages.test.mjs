/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installRetryBenchmarkSchema } from '../../scripts/retryQueryBenchmark/schema.mjs';
import { seedRetryBenchmark, expectedRetryIds } from '../../scripts/retryQueryBenchmark/fixture.mjs';
import { readEnrichmentRetryPage, RETRY_CANDIDATE_SQL, retryCandidateParameters } from '../../services/enrichmentRetryCandidates.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';

let db;
beforeEach(async () => {
  db = await getPool().connect(); await db.query('BEGIN');
  await installRetryBenchmarkSchema(db); await seedRetryBenchmark(db, 'mixed', 300);
});
afterEach(async () => { try { await db.query('ROLLBACK'); } finally { db.release(); } });
const claim = (type, id) => claimEnrichmentRetry({ query: (...args) => db.query(...args),
  withTransaction: () => { throw new Error('Unexpected nested transaction'); } }, type, [], id);

test.each(['omdb', 'web_search', 'tavily'])('all %s pages match independent eligibility, including restart from head', async type => {
  const ids = []; let cursor = null;
  for (let page = 0; page < 100; page++) {
    const rows = await readEnrichmentRetryPage(db, type, cursor, 3);
    if (!rows.length) break;
    ids.push(...rows.map(row => row.queue_id)); cursor = rows.at(-1);
  }
  expect(ids).toEqual(expectedRetryIds('mixed',300,type,0,300));
  expect((await readEnrichmentRetryPage(db,type,null,3)).map(row => row.queue_id)).toEqual(ids.slice(0,3));
  expect((await db.query("SELECT count(*)::integer n FROM enrichment_retry_queue WHERE status<>'pending'")).rows[0].n).toBe(0);
});

test.each([1,7,50])('cursor preserves priority, microseconds, ties, nulls and infinity at page size %s', async size => {
  await db.query(`UPDATE enrichment_retry_queue SET next_attempt_at=statement_timestamp()-interval '1 day', attempts=0,reason=NULL,
    priority=(id%4), created_at=CASE id%6
      WHEN 0 THEN NULL WHEN 1 THEN 'infinity'::timestamptz WHEN 2 THEN '-infinity'::timestamptz
      WHEN 3 THEN '2026-01-01 00:00:00.000001+00'::timestamptz
      ELSE '2026-01-01 00:00:00.000002+00'::timestamptz END`);
  const expected=(await db.query(`SELECT erq.id FROM enrichment_retry_queue erq
    JOIN media_server_items msi ON msi.id=erq.media_item_id WHERE ${RETRY_CANDIDATE_SQL}
    ORDER BY erq.priority, erq.created_at NULLS LAST, erq.id`,retryCandidateParameters('web_search'))).rows.map(row=>row.id);
  const ids=[]; let cursor=null;
  for (let page=0;page<301;page++) {
    const rows=await readEnrichmentRetryPage(db,'web_search',cursor,size);
    if (!rows.length) break;
    ids.push(...rows.map(row=>row.queue_id)); cursor=rows.at(-1);
  }
  expect(ids).toEqual(expected); expect(new Set(ids).size).toBe(ids.length);
});

test.each(['conflict','inactive','music','completed','exhausted','deadline','credentials','cooldown','metadata'])(
  'page hint cannot bypass a subsequent %s change at claim', async change => {
    const [item]=await readEnrichmentRetryPage(db,'omdb',null,1);
    const id=item.queue_id;
    if (change==='conflict') await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,identity_issue,generation)
      SELECT library_id,media_server_id,external_id,'conflicting_provider_ids',1 FROM media_server_items WHERE id=$1`,[id]);
    if (change==='inactive') await db.query('UPDATE libraries SET is_active=false WHERE id=(SELECT library_id FROM media_server_items WHERE id=$1)',[id]);
    if (change==='music') await db.query("UPDATE media_server_items SET media_type='track' WHERE id=$1",[id]);
    if (change==='completed') await db.query("UPDATE enrichment_retry_queue SET status='completed' WHERE id=$1",[id]);
    if (change==='exhausted') await db.query('UPDATE enrichment_retry_queue SET attempts=max_attempts WHERE id=$1',[id]);
    if (change==='deadline') await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=statement_timestamp()+interval '1 day' WHERE id=$1",[id]);
    if (change==='credentials') await db.query('UPDATE omdb_config SET credential_rejected_at=statement_timestamp()');
    if (change==='cooldown') await db.query("INSERT INTO enrichment_retry_cooldowns VALUES ('omdb',statement_timestamp()+interval '1 day','fixture')");
    if (change==='metadata') await db.query('UPDATE media_server_items SET metadata=$2::jsonb WHERE id=$1',[id,JSON.stringify({omdb:{}})]);
    expect(await claim('omdb',id)).toBeNull();
    expect((await readEnrichmentRetryPage(db,'omdb',null,50)).some(row=>row.queue_id===id)).toBe(false);
  });

test('conflict lookup is scoped by all source keys and ignores expired observations only', async () => {
  const [item]=await readEnrichmentRetryPage(db,'omdb',null,1); const id=item.queue_id;
  await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,identity_issue,generation)
    SELECT library_id,media_server_id+1,external_id,'conflicting_provider_ids',1 FROM media_server_items WHERE id=$1`,[id]);
  expect((await readEnrichmentRetryPage(db,'omdb',null,1))[0].queue_id).toBe(id);
  await db.query('UPDATE media_source_observations SET media_server_id=1 WHERE external_id=$1',[String(id)]);
  expect((await readEnrichmentRetryPage(db,'omdb',null,1))[0].queue_id).not.toBe(id);
  await db.query("UPDATE media_source_observations SET last_seen_at=statement_timestamp()-interval '1 year' WHERE external_id=$1",[String(id)]);
  expect((await readEnrichmentRetryPage(db,'omdb',null,1))[0].queue_id).toBe(id);
  expect(await claim('omdb',id)).toMatchObject({queue_id:id});
});

test.each(['omdb','web_search','tavily'])('due and repaired %s work is unique and retains exact-deadline provenance', async type => {
  await db.query('ROLLBACK'); await db.query('BEGIN'); await installRetryBenchmarkSchema(db);
  await seedRetryBenchmark(db,'credential_rotation',300);
  const rows=await readEnrichmentRetryPage(db,type,null,50);
  expect(rows).toHaveLength(50);
  const [first,second,third]=rows;
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=statement_timestamp()-interval '1 second',retry_wait_until=statement_timestamp()-interval '1 second' WHERE id=$1",[first.queue_id]);
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=next_attempt_at+interval '1 hour' WHERE id=$1",[second.queue_id]);
  await db.query('UPDATE enrichment_retry_queue SET retry_wait_until=NULL,retry_wait_context=NULL WHERE id=$1',[third.queue_id]);
  const ids=(await readEnrichmentRetryPage(db,type,null,50)).map(row=>row.queue_id);
  expect(ids.filter(id=>id===first.queue_id)).toHaveLength(1);
  expect(ids).not.toContain(second.queue_id); expect(ids).not.toContain(third.queue_id);
  expect(await claim(type,second.queue_id)).toBeNull(); expect(await claim(type,third.queue_id)).toBeNull();
});
