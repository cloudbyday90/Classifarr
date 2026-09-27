/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { test, expect, beforeEach, afterEach } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { readInventoryRecoveryProgress } from '../../services/inventoryRecoveryProgressService.mjs';
import { INVENTORY_DESCRIPTION_REFRESH_STATE_SQL } from '../../services/inventoryDescriptionRefreshRepository.mjs';
const db = createIntegrationDatabaseModuleMock();
let lib, actor;
beforeEach(async () => {
    actor = (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'fixture','admin') RETURNING id", [randomUUID()])).rows[0].id;
    lib = (await db.query("INSERT INTO libraries(name,external_id,media_type,is_active) VALUES ($1,$2,'movie',true) RETURNING id", [randomUUID(), randomUUID()])).rows[0].id;
    await db.query('UPDATE ai_provider_config SET rag_enabled=true WHERE id=1');
});
afterEach(async () => {
    await db.query("DELETE FROM task_queue WHERE source='recovery-progress-test'");
    await db.query('DELETE FROM media_server_items WHERE library_id=$1', [lib]);
    await db.query('DELETE FROM media_server_sync_status WHERE library_id=$1', [lib]);
    await db.query('DELETE FROM libraries WHERE id=$1', [lib]);
    await db.query('DELETE FROM users WHERE id=$1', [actor]);
});
async function seed() {
    const at = new Date(Date.now() - 3600000).toISOString();
    const record = { version: 1, case_id: randomUUID(), tmdb_id: 7, media_type: 'movie', status: 'open',
        category: 'authentication', attempt_count: 1, first_seen: at, last_seen: at, resolved_at: null };
    return (await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,tmdb_id,inventory_tmdb_recovery)
        VALUES ($1,$2,'synthetic','movie',7,$3) RETURNING id`, [lib, randomUUID(), record])).rows[0].id;
}
const readItem = async id => (await db.query('SELECT * FROM media_server_items WHERE id=$1', [id])).rows[0];
async function release(id) {
    await db.query("UPDATE media_server_items SET inventory_tmdb_wakeup_generation=$2,inventory_tmdb_retry_after=clock_timestamp()+interval '1 second' WHERE id=$1", [id, randomUUID()]);
    return (await readItem(id)).inventory_tmdb_recovery_progress;
}
test('fresh setup waits, ingestion and pending NULL-retry work defer learning, completion resumes it', async () => {
    expect(await readInventoryBackgroundReadiness(db)).toBe('waiting_for_inventory');
    await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [lib]);
    expect(await readInventoryBackgroundReadiness(db)).toBe('waiting_for_libraries');
    await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [lib]); await seed();
    expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
    await db.query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','pending')", [lib]);
    expect(await readInventoryBackgroundReadiness(db)).toBe('ingesting');
    await db.query("UPDATE media_server_sync_status SET status='completed' WHERE library_id=$1", [lib]);
    await db.query("INSERT INTO task_queue(task_type,payload,status,next_retry_at,source) VALUES ('metadata_enrichment','{}','pending',NULL,'recovery-progress-test')");
    expect(await readInventoryBackgroundReadiness(db)).toBe('backfilling');
    expect((await db.query(INVENTORY_DESCRIPTION_REFRESH_STATE_SQL)).rows[0].busy).toBe(true);
    await db.query("UPDATE task_queue SET next_retry_at=now()+interval '1 day' WHERE source='recovery-progress-test'");
    expect(await readInventoryBackgroundReadiness(db)).toBe('ready');
    await db.query('UPDATE ai_provider_config SET rag_enabled=false WHERE id=1');
    expect(await readInventoryBackgroundReadiness(db)).toBe('disabled');
});
test('queue admission is atomic, deduplicated, case fenced and survives task removal', async () => {
    const id = await seed(), p = await release(id);
    const payload = { itemId: id, tmdb_id: 7, media: { media_type: 'movie' }, source_library_id: lib,
        inventory_recovery_case_id: p.case_id, inventory_recovery_generation: p.generation };
    const insert = (client, data) => client.query("INSERT INTO task_queue(task_type,payload,source) VALUES ('metadata_enrichment',$1,'recovery-progress-test')", [data]);
    for (const patch of [{ inventory_recovery_case_id: randomUUID() }, { inventory_recovery_generation: randomUUID() }, { tmdb_id: 99 }, { itemId: '999999999999999' }, { itemId: '1 OR 1=1' }]) await insert(db, { ...payload, ...patch });
    expect((await readItem(id)).inventory_tmdb_recovery_progress.queued_at).toBeUndefined();
    await expect(db.withTransaction(async client => { await insert(client, payload); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect((await readItem(id)).inventory_tmdb_recovery_progress.queued_at).toBeUndefined();
    await insert(db, payload); const queued = (await readItem(id)).inventory_tmdb_recovery_progress.queued_at;
    await insert(db, payload); expect((await readItem(id)).inventory_tmdb_recovery_progress.queued_at).toBe(queued);
    await db.query("DELETE FROM task_queue WHERE source='recovery-progress-test'");
    expect((await readItem(id)).inventory_tmdb_recovery_progress.queued_at).toBe(queued);
});
test('read-only bounded report excludes inactive/mismatched sources and never fabricates old milestones', async () => {
    const id = await seed();
    expect(await readInventoryRecoveryProgress(db, actor)).toMatchObject({ total: 0 });
    await release(id);
    const before = await readItem(id);
    expect(await readInventoryRecoveryProgress(db, actor)).toMatchObject({ total: 1, stages: { waiting: 1 } });
    expect(await readItem(id)).toEqual(before);
    await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [lib]);
    expect(await readInventoryRecoveryProgress(db, actor)).toMatchObject({ total: 0 });
    await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [lib]);
    await db.query("UPDATE media_server_items SET inventory_tmdb_recovery=jsonb_set(inventory_tmdb_recovery,'{case_id}',to_jsonb($2::text)) WHERE id=$1", [id, randomUUID()]);
    expect((await readItem(id)).inventory_tmdb_recovery_progress).toBeNull();
    expect(await readInventoryRecoveryProgress(db, actor)).toMatchObject({ total: 0 });
});

test('the recent cohort is capped with explicit truncation, without a full payload response', async () => {
    const id = await seed(); await release(id);
    const template = await readItem(id);
    await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,tmdb_id,
        inventory_tmdb_recovery,inventory_tmdb_recovery_progress,inventory_tmdb_retry_after)
        SELECT $1,'bounded-fixture-'||n,'not returned','movie',7,$2,$3,now()+interval '1 hour'
        FROM generate_series(1,1001) n`, [lib, template.inventory_tmdb_recovery, template.inventory_tmdb_recovery_progress]);
    const report = await readInventoryRecoveryProgress(db, actor);
    expect(report).toMatchObject({ total: 1000, truncated: true, limit: 1000 });
    expect(Object.values(report.stages).reduce((sum, n) => sum + n, 0)).toBe(1000);
    expect(JSON.stringify(report).length).toBeLessThan(1000);
    expect(JSON.stringify(report)).not.toContain('not returned');
});
