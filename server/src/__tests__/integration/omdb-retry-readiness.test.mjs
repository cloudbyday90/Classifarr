/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createRetryReadinessService } from '../../services/retryReadinessService.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
const db = createIntegrationDatabaseModuleMock();
let serverId, libraryId;
const read = () => createRetryReadinessService({ database: db, scope: 'omdb' }).getReport();
const configRows = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id')).rows;
const queueRows = async () => (await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows;
async function configure() {
  await db.query(`INSERT INTO omdb_config(api_key,is_active,daily_limit,requests_today,last_reset_date)
    VALUES ('private-fixture',true,10,0,(clock_timestamp() AT TIME ZONE 'UTC')::date)`);
}
beforeEach(async () => {
  await db.query('TRUNCATE omdb_config,enrichment_retry_cooldowns');
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('jellyfin',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ('Fixture','fixture','movie',$1,true) RETURNING id", [serverId])).rows[0].id;
});
afterEach(async () => {
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
async function items(count = 1) {
  await db.query(`WITH items AS (INSERT INTO media_server_items
    (media_server_id,external_id,library_id,media_type,title,imdb_id)
    SELECT $1,'item-'||n,$2,'movie','Fixture '||n,'tt'||lpad(n::text,7,'0') FROM generate_series(1,$3::integer) n RETURNING id)
    INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,next_attempt_at)
    SELECT id,'omdb',clock_timestamp() FROM items`, [serverId, libraryId, count]);
}

test('fresh, disabled, rejected and repaired setups are read-only and project no secrets', async () => {
  expect(await read()).toMatchObject({ inspected: 0, quota: { status: 'not_configured', used: null } });
  await items(); expect((await read()).counts.settings_blocked).toBe(1);
  await configure(); await db.query('UPDATE omdb_config SET is_active=false');
  expect((await read()).counts.settings_blocked).toBe(1);
  await db.query('UPDATE omdb_config SET is_active=true');
  await db.query('UPDATE omdb_config SET credential_rejected_at=clock_timestamp()');
  expect((await read()).quota.status).toBe('credentials_rejected');
  await db.query('UPDATE omdb_config SET credential_rejected_at=NULL');
  const beforeConfig = await configRows(), beforeQueue = await queueRows();
  const report = await read();
  expect(report.counts.provider_ready).toBe(1);
  expect(JSON.stringify(report)).not.toMatch(/private-fixture|api_key|Fixture|imdb_id|generation/);
  expect(await configRows()).toEqual(beforeConfig); expect(await queueRows()).toEqual(beforeQueue);
});

test('only the OMDb cooldown affects its preview; due-time and quota bounds remain distinct', async () => {
  await items(); await configure();
  await db.query("INSERT INTO enrichment_retry_cooldowns VALUES ('web_search',clock_timestamp()+interval '1 hour','fixture')");
  expect((await read()).counts.provider_ready).toBe(1);
  await db.query("INSERT INTO enrichment_retry_cooldowns VALUES ('omdb',clock_timestamp()+interval '1 hour','fixture')");
  expect((await read()).counts.provider_wait).toBe(1);
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()+interval '2 days'");
  await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  const report = await read();
  expect(report.counts.scheduled).toBe(1);
  expect(Date.parse(report.earliestRetryAt)).toBeGreaterThan(Date.parse(report.quota.resetAt));
});

test('dated counts reset logically without writes, while exhausted undated counts have no timer promise', async () => {
  await items(); await configure();
  await db.query("UPDATE omdb_config SET requests_today=daily_limit,last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date-1");
  const before = await configRows();
  expect(await read()).toMatchObject({ counts: { provider_ready: 1 }, quota: { used: 0 } });
  expect(await configRows()).toEqual(before);
  await db.query('UPDATE omdb_config SET last_reset_date=NULL');
  expect(await read()).toMatchObject({ earliestRetryAt: null, counts: { provider_wait: 1 }, quota: { resetAt: null, used: 10 } });
  await db.query("UPDATE omdb_config SET last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date+1");
  expect((await read()).quota.status).toBe('invalid_configuration');
});

test('partial pages retain source/library/content/attempt guards', async () => {
  await items(51); await configure();
  expect(await read()).toMatchObject({ inspected: 50, hasMore: true, counts: { provider_ready: 50, cached_ready: 0 } });
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect((await read()).counts.held).toBe(50);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  await db.query(`INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source)
    VALUES ($1,$2,1,'full','complete','media_sync')`, [libraryId, serverId]);
  await db.query(`INSERT INTO media_source_observations
    (library_id,media_server_id,external_id,title,media_type,identity_issue,generation)
    VALUES ($1,$2,'item-1','Fixture','movie','conflicting_provider_ids',1)`, [libraryId, serverId]);
  expect((await read()).counts).toMatchObject({ held: 1, provider_ready: 49 });
  await db.query("UPDATE media_server_items SET media_type='track' WHERE library_id=$1", [libraryId]);
  expect((await read()).counts.held).toBe(50);
  await db.query("UPDATE media_server_items SET media_type='movie',metadata='{\"omdb\":{}}'::jsonb WHERE library_id=$1", [libraryId]);
  expect((await read()).counts.held).toBe(50);
  await db.query("UPDATE media_server_items SET metadata='{}'::jsonb WHERE library_id=$1", [libraryId]);
  await db.query('UPDATE enrichment_retry_queue SET attempts=max_attempts');
  expect((await read()).counts.held).toBe(50);
});

test('preview does not reserve the last credit or bypass subsequent admission', async () => {
  await items(2); await configure(); await db.query('UPDATE omdb_config SET requests_today=9');
  expect(await read()).toMatchObject({ counts: { provider_ready: 2 }, quota: { used: 9, limit: 10 } });
  expect((await reserveOmdbQuota(db)).status).toBe('reserved');
  expect((await reserveOmdbQuota(db)).status).toBe('limit_reached');
  const before = await queueRows();
  expect((await read()).counts.provider_wait).toBe(2);
  expect(await queueRows()).toEqual(before);
});
