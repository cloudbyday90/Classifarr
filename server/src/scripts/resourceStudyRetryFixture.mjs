/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';

export const STUDY_RETRY_TYPES = Object.freeze(['omdb', 'web_search', 'tavily']);

/** Fixed synthetic cohort in the guarded disposable application database only. */
export async function seedResourceStudyRetries(db) {
  assertUpgradeDrillEnvironment();
  assert.equal(process.env.CLASSIFARR_RESOURCE_STUDY, 'isolated-synthetic-v1');
  assert.equal(process.env.CLASSIFARR_RUNTIME_MODE, 'restore');
  return db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL transaction_timeout='15s'");
    assert.equal((await client.query('SELECT count(*)::integer n FROM enrichment_retry_queue')).rows[0].n, 0);
    const items = (await client.query(`SELECT id,library_id,media_type FROM (
      SELECT id,library_id,media_type,row_number() OVER (PARTITION BY library_id ORDER BY id) rank
      FROM media_server_items WHERE media_type IN ('movie','tv')
    ) ranked ORDER BY rank,library_id LIMIT 60`)).rows;
    assert.equal(items.length, 60, 'study_retry_inventory_missing');
    assert.equal(new Set(items.map(item => item.library_id)).size, 4, 'study_retry_library_coverage');
    assert.deepEqual([...new Set(items.map(item => item.media_type))].sort(), ['movie', 'tv']);
    await client.query("INSERT INTO omdb_config(api_key,is_active) VALUES ('synthetic-retry-before',true)");
    await client.query(`INSERT INTO web_search_provider_config(provider_key,display_name,is_enabled,api_key)
      VALUES ('tavily','Synthetic retry study',true,'synthetic-retry-before')
      ON CONFLICT(provider_key) DO UPDATE SET is_enabled=true,api_key=EXCLUDED.api_key`);
    const contexts = (await client.query('SELECT * FROM enrichment_retry_provider_contexts')).rows;
    assert.equal(contexts.length, 2, 'study_retry_provider_coverage');
    const cohort = [];
    for (let index = 0; index < items.length; index++) {
      const type = STUDY_RETRY_TYPES[index % 3], category = index % 4;
      const context = contexts.find(row => row.dependency === (type === 'omdb' ? 'omdb' : 'web_search'));
      assert.ok(context && !context.credentials_rejected);
      const prior = [1, 2].includes(category) ? JSON.stringify([{ providerKey: context.provider_key,
        source: context.source, id: context.config_id, generation: context.generation }]) : null;
      const { rows: [row] } = await client.query(`INSERT INTO enrichment_retry_queue
        (media_item_id,enrichment_type,reason,next_attempt_at,retry_wait_context,retry_wait_until)
        VALUES ($1,$2,'synthetic_resource_study',now()+CASE WHEN $3=0 THEN interval '-1 day' ELSE interval '1 day' END,
          $4::jsonb,CASE WHEN $3=1 THEN now()+interval '1 day' WHEN $3=2 THEN now()+interval '2 days' END)
        RETURNING id`, [items[index].id, type, category, prior]);
      cohort.push({ id: row.id, type, category });
    }
    return cohort;
  });
}

export async function rotateResourceStudyRetryCredentials(db) {
  // Exact synthetic values, not a blanket configuration rewrite. DB triggers rotate generations.
  await db.withTransaction(async client => {
    const omdb = await client.query("UPDATE omdb_config SET api_key='synthetic-retry-after' WHERE api_key='synthetic-retry-before'");
    const web = await client.query("UPDATE web_search_provider_config SET api_key='synthetic-retry-after' WHERE api_key='synthetic-retry-before' AND provider_key='tavily'");
    assert.equal(omdb.rowCount, 1); assert.equal(web.rowCount, 1);
  });
}

export async function readResourceStudyRetryState(db) {
  return (await db.query(`SELECT id,status,attempts,claim_token,claim_until::text,last_attempt_at::text,
    next_attempt_at::text,retry_wait_context,retry_wait_until::text FROM enrichment_retry_queue ORDER BY id`)).rows;
}

/** End only the study's synthetic provider demand before measuring settled idle. */
export async function quiesceResourceStudyRetryProviders(db) {
  assertUpgradeDrillEnvironment();
  assert.equal(process.env.CLASSIFARR_RESOURCE_STUDY, 'isolated-synthetic-v1');
  assert.equal(process.env.CLASSIFARR_RUNTIME_MODE, 'restore');
  await db.withTransaction(async client => {
    const omdb = await client.query("UPDATE omdb_config SET is_active=false WHERE api_key='synthetic-retry-after'");
    const web = await client.query("UPDATE web_search_provider_config SET is_enabled=false WHERE api_key='synthetic-retry-after' AND provider_key='tavily'");
    assert.equal(omdb.rowCount, 1); assert.equal(web.rowCount, 1);
  });
}
