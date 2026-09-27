/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createInventoryCredentialWakeupRepository } from '../../services/inventoryCredentialWakeupRepository.mjs';
import { createInventoryCredentialWakeupService } from '../../services/inventoryCredentialWakeupService.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { persistEnrichmentMetadata } from '../../services/queueEnrichmentPersistence.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../../services/queueInventoryTmdbEnrichmentService.mjs';

const db = createIntegrationDatabaseModuleMock();
let config, library, server, repository, itemIds, verify, service;
const at = () => new Date(Date.now() - 3600000).toISOString();
const recovery = (type = 'movie', category = 'authentication') => ({ version: 1, case_id: randomUUID(), tmdb_id: 7,
    media_type: type, status: 'open', category, attempt_count: 2, first_seen: at(), last_seen: at(), resolved_at: null });
beforeEach(async () => {
    await db.query('UPDATE tmdb_config SET is_active=false');
    config = (await db.query("INSERT INTO tmdb_config(api_key,is_active) VALUES ('fixture-key',true) RETURNING id")).rows[0].id;
    server = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
    library = (await db.query("INSERT INTO libraries(name,external_id,media_type,is_active,media_server_id) VALUES ($1,$2,'movie',true,$3) RETURNING id", [randomUUID(), randomUUID(), server])).rows[0].id;
    itemIds = []; repository = createInventoryCredentialWakeupRepository(db);
    verify = jest.fn().mockResolvedValue({ verified: true });
    service = createInventoryCredentialWakeupService({ db, verify });
});
afterEach(async () => {
    await db.query('DELETE FROM media_source_observations WHERE library_id=$1', [library]);
    await db.query('DELETE FROM media_server_items WHERE library_id=$1', [library]);
    await db.query('DELETE FROM libraries WHERE id=$1', [library]);
    await db.query('DELETE FROM media_server WHERE id=$1', [server]);
    await db.query('DELETE FROM tmdb_config WHERE id=$1', [config]);
});
async function seed(count = 1, category = 'authentication', type = 'movie') {
    for (let i = 0; i < count; i++) {
        const row = (await db.query(`INSERT INTO media_server_items(library_id,external_id,title,media_type,tmdb_id,media_server_id,
            inventory_tmdb_recovery,inventory_tmdb_attempted_at,inventory_tmdb_retry_after,metadata)
            VALUES ($1,$2,'Synthetic only',$3,7,$5,$4,now()-interval '1 hour',now()+interval '7 days','{"preserved":true}') RETURNING id`,
        [library, randomUUID(), type, recovery(type, category), server])).rows[0];
        itemIds.push(row.id);
    }
}
const state = async () => (await db.query('SELECT * FROM inventory_credential_wakeups WHERE config_id=$1', [config])).rows[0];
const item = async (id = itemIds[0]) => (await db.query('SELECT * FROM media_server_items WHERE id=$1', [id])).rows[0];
const batchDue = () => db.query("UPDATE inventory_credential_wakeups SET batch_after=now()-interval '1 second' WHERE config_id=$1", [config]);

test.each(['movie', 'tv'])('verified %s recovery releases once and ordinary worker backfills without changing identity', async type => {
    await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [library, type]);
    await seed(1, 'authentication', type);
    const before = await item();
    expect(await service.run()).toEqual({ released: 1 });
    const released = await item();
    expect(released.inventory_tmdb_attempted_at).toBeNull();
    expect(released.inventory_tmdb_retry_after.getTime() - Date.now()).toBeLessThanOrEqual(60000);
    expect(released.inventory_tmdb_retry_after.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(released.inventory_tmdb_recovery).toEqual(before.inventory_tmdb_recovery);
    expect(released.metadata).toEqual(before.metadata);
    await batchDue();
    expect(await createInventoryCredentialWakeupService({ db, verify }).run()).toEqual({ released: 0 });
    expect(verify).toHaveBeenCalledTimes(1);
    await db.query("UPDATE media_server_items SET inventory_tmdb_retry_after=now()-interval '1 second' WHERE id=$1", [itemIds[0]]);
    const payload = await prepareQueueEnrichmentPayload({ itemId: itemIds[0], media: { media_type: type } }, db.query);
    const details = async () => ({ id: 7, production_companies: [], original_language: 'en', keywords: { [type === 'movie' ? 'keywords' : 'results']: [] } });
    const worker = new QueueInventoryTmdbEnrichmentService({ tmdbService: { getApiKey: async () => 'fixture-key', getMovieDetails: details, getTVDetails: details } });
    const metadata = {}, receipt = {};
    expect(await worker.enrich(payload, metadata, 7, { query: db.query, receipt })).toBe(true);
    expect((await persistEnrichmentMetadata(db.query, payload, 7, metadata, true, receipt)).rowCount).toBe(1);
    expect(await item()).toMatchObject({ tmdb_id: 7, inventory_tmdb_recovery: { status: 'resolved' }, metadata: { preserved: true, inventory_tmdb: { tmdb_id: 7 } } });
});
test('failed verification persists backoff across restart without touching any item', async () => {
    await seed(); const before = await item();
    verify.mockResolvedValue({ verified: false, category: 'rate_limited', retryAfterMs: 3600000 });
    expect(await service.run()).toEqual({ released: 0 });
    expect(await item()).toEqual(before);
    expect((await state()).probe_after.getTime() - Date.now()).toBeGreaterThan(3590000);
    await createInventoryCredentialWakeupService({ db, verify }).run(); expect(verify).toHaveBeenCalledTimes(1);
    await db.query("UPDATE inventory_credential_wakeups SET probe_after=now()-interval '1 second' WHERE config_id=$1", [config]);
    verify.mockResolvedValue({ verified: true }); expect(await service.run()).toEqual({ released: 1 });
});
test('credential A-B-A changes invalidate in-flight success; language/no-op edits do not', async () => {
    await seed(); const first = await repository.claim();
    await db.query("UPDATE tmdb_config SET api_key='changed' WHERE id=$1", [config]);
    await db.query("UPDATE tmdb_config SET api_key='fixture-key' WHERE id=$1", [config]);
    expect(await repository.finish(first, { verified: true }, 0)).toBe(false);
    const current = await state(); expect(current.generation).not.toBe(first.generation);
    await db.query("UPDATE tmdb_config SET api_key=api_key,language='fr-FR' WHERE id=$1", [config]);
    expect((await state()).generation).toBe(current.generation);
    expect(await service.run()).toEqual({ released: 1 });
});
test('deactivation and expired/replaced probe leases reject late results', async () => {
    await seed(); const first = await repository.claim();
    expect(await repository.claim()).toBeNull();
    await db.query("UPDATE inventory_credential_wakeups SET probe_lease_until=now()-interval '1 second' WHERE config_id=$1", [config]);
    expect(await repository.finish(first, { verified: true }, 0)).toBe(false);
    const second = await repository.claim(); expect(second.token).not.toBe(first.token);
    expect(await repository.finish(first, { verified: true }, 0)).toBe(false);
    await db.query('UPDATE tmdb_config SET is_active=false WHERE id=$1', [config]);
    expect(await repository.finish(second, { verified: true }, 0)).toBeNull();
    expect(await repository.release()).toBeNull();
});
test('concurrent instances probe once, and batches are limited and resume durably', async () => {
    await seed(105);
    const results = await Promise.all([service.run(), createInventoryCredentialWakeupService({ db, verify }).run()]);
    expect(results.reduce((n, result) => n + result.released, 0)).toBe(100);
    expect(verify).toHaveBeenCalledTimes(1); expect(Number((await state()).released_count)).toBe(100);
    await batchDue();
    expect(await createInventoryCredentialWakeupService({ db, verify }).run()).toEqual({ released: 5 });
    expect(Number((await state()).released_count)).toBe(105);
});
test('404, throttling, invalid records, mismatched IDs, music, fresh failures and active leases remain unchanged', async () => {
    await seed(); await seed(1, 'not_found'); await seed(1, 'rate_limited'); await seed(1, 'authentication', 'music');
    await seed(4);
    await db.query('UPDATE media_server_items SET inventory_tmdb_recovery=$2 WHERE id=$1', [itemIds[4], { ...recovery(), tmdb_id: 99 }]);
    await db.query('UPDATE media_server_items SET inventory_tmdb_recovery=$2 WHERE id=$1', [itemIds[5], { version: 1, category: 'authentication', status: 'open' }]);
    await db.query("UPDATE media_server_items SET inventory_tmdb_lease_id=$2,inventory_tmdb_lease_until=now()+interval '5 minutes' WHERE id=$1", [itemIds[6], randomUUID()]);
    const claim = await repository.claim(); await repository.finish(claim, { verified: true }, 0);
    await db.query('UPDATE media_server_items SET inventory_tmdb_recovery=$2,inventory_tmdb_attempted_at=now()+interval \'1 minute\' WHERE id=$1',
        [itemIds[7], { ...recovery(), last_seen: new Date(Date.now() + 60000).toISOString() }]);
    const before = await Promise.all(itemIds.slice(1).map(id => item(id)));
    expect(await repository.release()).toEqual({ released: 1 });
    expect(await Promise.all(itemIds.slice(1).map(id => item(id)))).toEqual(before);
});
test('source conflicts and inactive libraries block release, then recover on a later pass', async () => {
    await seed();
    await db.query("INSERT INTO media_source_capture_state(library_id,media_server_id,generation,mode,phase,source) VALUES ($1,$2,1,'full','collecting','media_sync')", [library, server]);
    await db.query(`INSERT INTO media_source_observations(library_id,media_server_id,external_id,media_type,identity_issue,generation)
        SELECT library_id,media_server_id,external_id,media_type,'conflicting_provider_ids',1 FROM media_server_items WHERE id=$1`, [itemIds[0]]);
    expect(await service.run()).toEqual({ released: 0 });
    await db.query('DELETE FROM media_source_observations WHERE library_id=$1', [library]);
    await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [library]); await batchDue();
    expect(await service.run()).toEqual({ released: 0 });
    await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [library]); await batchDue();
    await db.query('UPDATE media_server SET is_active=false WHERE id=$1', [server]);
    expect(await service.run()).toEqual({ released: 0 });
    await db.query('UPDATE media_server SET is_active=true WHERE id=$1', [server]); await batchDue();
    expect(await service.run()).toEqual({ released: 1 });
});
test('a rollback cannot consume a wakeup receipt or lose retry eligibility', async () => {
    await seed(); const claim = await repository.claim(); await repository.finish(claim, { verified: true }, 0);
    const before = await item();
    const failing = createInventoryCredentialWakeupRepository({ withTransaction: callback => db.withTransaction(async client => {
        await callback(client); throw new Error('rollback fixture');
    }) });
    await expect(failing.release()).rejects.toThrow('rollback fixture');
    expect(await item()).toEqual(before); expect(Number((await state()).released_count)).toBe(0);
    expect(await repository.release()).toEqual({ released: 1 });
});
test('credential edits cannot bypass a provider Retry-After deadline', async () => {
    await seed(); verify.mockResolvedValue({ verified: false, category: 'rate_limited', retryAfterMs: 86400000 });
    await service.run(); const deadline = (await state()).provider_retry_after;
    for (const key of ['replacement', 'another-replacement']) {
        await db.query('UPDATE tmdb_config SET api_key=$2 WHERE id=$1', [config, key]);
        expect((await state()).probe_after).toEqual(deadline);
        expect(await service.run()).toEqual({ released: 0 });
    }
    expect(verify).toHaveBeenCalledTimes(1);
});
test('locked source rows are revisited without blocking or duplicate release', async () => {
    await seed(2); const claim = await repository.claim(); await repository.finish(claim, { verified: true }, 0);
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM media_server_items WHERE id=$1 FOR UPDATE', [itemIds[0]]);
        expect(await repository.release()).toEqual({ released: 1 });
        expect((await item()).inventory_tmdb_wakeup_generation).toBeNull();
        await client.query('ROLLBACK');
    } finally { client.release(); }
    await batchDue(); expect(await repository.release()).toEqual({ released: 1 });
    await batchDue(); expect(await repository.release()).toEqual({ released: 0 });
});
test('verification does not hold config locks during I/O and never runs without recovery cases', async () => {
    expect(await service.run()).toEqual({ released: 0 }); expect(verify).not.toHaveBeenCalled();
    await seed();
    verify.mockImplementation(async () => {
        await db.query("UPDATE tmdb_config SET api_key='new-fixture-key' WHERE id=$1", [config]);
        return { verified: true };
    });
    expect(await service.run()).toEqual({ released: 0 });
    expect((await state()).verified_at).toBeNull();
    expect((await item()).inventory_tmdb_wakeup_generation).toBeNull();
});
test('malformed rows cannot starve later valid cases and same-generation failures are not repeatedly reset', async () => {
    await seed(101);
    await db.query("UPDATE media_server_items SET inventory_tmdb_recovery=inventory_tmdb_recovery-'case_id' WHERE id=ANY($1::int[])", [itemIds.slice(0, 100)]);
    expect(await service.run()).toEqual({ released: 0 });
    expect((await state()).after_item_id).toBe(itemIds[99]); await batchDue();
    expect(await service.run()).toEqual({ released: 1 });
    const last = itemIds.at(-1);
    await db.query("UPDATE media_server_items SET inventory_tmdb_attempted_at=now(),inventory_tmdb_retry_after=now()+interval '7 days' WHERE id=$1", [last]);
    await batchDue(); expect(await service.run()).toEqual({ released: 0 });
    await batchDue(); expect(await service.run()).toEqual({ released: 0 });
    expect((await item(last)).inventory_tmdb_retry_after.getTime() - Date.now()).toBeGreaterThan(6 * 86400000);
});
