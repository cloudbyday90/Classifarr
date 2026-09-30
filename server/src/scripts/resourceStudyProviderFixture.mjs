/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertUpgradeDrillEnvironment } from './publishedUpgradeFixtures.mjs';

export function assertStudyProviderEnvironment() {
  assertUpgradeDrillEnvironment();
  assert.equal(process.env.CLASSIFARR_RESOURCE_STUDY, 'isolated-synthetic-v1');
  assert.equal(process.env.CLASSIFARR_RUNTIME_MODE, 'restore');
}

/** Separate, balanced cohort; no existing retry or provider configuration is overwritten. */
export async function seedStudyProviderCohort(db) {
  assertStudyProviderEnvironment();
  return db.withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL transaction_timeout='15s'");
    assert.equal((await client.query('SELECT count(*)::integer n FROM enrichment_retry_queue')).rows[0].n, 0);
    assert.equal((await client.query('SELECT count(*)::integer n FROM omdb_config WHERE is_active')).rows[0].n, 0);
    const items = (await client.query(`SELECT id,library_id,media_type FROM (
      SELECT id,library_id,media_type,row_number() OVER (PARTITION BY library_id ORDER BY id) rank
      FROM media_server_items WHERE media_type IN ('movie','tv')
        AND metadata->'content_analysis' IS NOT NULL AND metadata->'omdb' IS NULL
    ) ranked ORDER BY rank,library_id LIMIT 8`)).rows;
    assert.equal(items.length, 8, 'study_provider_inventory_missing');
    assert.equal(new Set(items.map(item => item.library_id)).size, 4);
    assert.equal(items.filter(item => item.media_type === 'movie').length, 4);
    const { rows: [config] } = await client.query(`INSERT INTO omdb_config
      (api_key,is_active,daily_limit,requests_today,last_reset_date)
      VALUES ('synthetic-fault-before',true,1000,1000,(statement_timestamp() AT TIME ZONE 'UTC')::date) RETURNING id`);
    const ids = items.map(item => item.id);
    await client.query(`INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,reason)
      SELECT unnest($1::integer[]),'omdb','synthetic_provider_fault_study'`, [ids]);
    return { ids, configId: config.id };
  });
}

/** Simulate a quota-day boundary, not early retry eligibility or successful work. */
export async function resetStudyProviderDay(db, { configId }) {
  assertStudyProviderEnvironment();
  const result = await db.query(`UPDATE omdb_config
    SET last_reset_date=(statement_timestamp() AT TIME ZONE 'UTC')::date-1
    WHERE id=$1 AND api_key='synthetic-fault-before' AND requests_today=daily_limit`, [configId]);
  assert.equal(result.rowCount, 1, 'study_provider_reset_missing');
}

export async function repairStudyProviderCredential(db, { configId }) {
  assertStudyProviderEnvironment();
  const result = await db.query(`UPDATE omdb_config SET api_key='synthetic-fault-after'
    WHERE id=$1 AND api_key='synthetic-fault-before' AND credential_rejected_at IS NOT NULL`, [configId]);
  assert.equal(result.rowCount, 1, 'study_provider_rejection_missing');
}

export async function readStudyProviderCohort(db, { ids }) {
  return (await db.query(`SELECT q.id,q.media_item_id,q.status,q.attempts,q.claim_token,
    q.next_attempt_at::text,q.retry_wait_context,q.retry_wait_until::text,
    (m.metadata->'omdb'->'data'->>'type' = CASE WHEN m.media_type='tv' THEN 'series' ELSE 'movie' END) AS evidence
    FROM enrichment_retry_queue q JOIN media_server_items m ON m.id=q.media_item_id
    WHERE q.media_item_id=ANY($1::integer[]) ORDER BY q.id`, [ids])).rows;
}
