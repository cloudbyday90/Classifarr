/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { prepareQueueEnrichmentPayload } from '../../services/queueEnrichmentPayload.mjs';
import { persistEnrichmentMetadata } from '../../services/queueEnrichmentPersistence.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../../services/queueInventoryTmdbEnrichmentService.mjs';
import { reportInventoryProviderRecovery } from '../../services/inventoryProviderRecoveryReporting.mjs';

let pool, query, libraryId, itemId, provider, logger;
const response = (type = 'movie', id = 7) => ({ id, production_companies: [], original_language: 'en',
    keywords: { [type === 'movie' ? 'keywords' : 'results']: [] } });
const missing = () => Object.assign(new Error('private response/token'), { response: { status: 404, data: 'private' } });
beforeEach(async () => {
    pool = getPool(); query = (sql, values) => pool.query(sql, values);
    libraryId = (await query(`INSERT INTO libraries (name, external_id, media_type, is_active)
        VALUES ($1, $2, 'movie', true) RETURNING id`, [randomUUID(), randomUUID()])).rows[0].id;
    itemId = (await query(`INSERT INTO media_server_items (external_id, title, library_id, media_type, tmdb_id, metadata)
        VALUES ($1, 'Synthetic only', $2, 'movie', 7, '{}') RETURNING id`, [randomUUID(), libraryId])).rows[0].id;
    logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    provider = { getApiKey: async () => 'fixture', getMovieDetails: jest.fn().mockResolvedValue(response()),
        getTVDetails: jest.fn().mockResolvedValue(response('tv')) };
});
afterEach(async () => {
    await query('DELETE FROM media_server_items WHERE id=$1', [itemId]);
    await query('DELETE FROM libraries WHERE id=$1', [libraryId]);
});
const stored = async () => (await query('SELECT * FROM media_server_items WHERE id=$1', [itemId])).rows[0];
const due = () => query(`UPDATE media_server_items SET inventory_tmdb_attempted_at=NOW()-interval '8 days',
    inventory_tmdb_retry_after=NOW()-interval '1 second' WHERE id=$1`, [itemId]);
async function attempt(type = 'movie') {
    const payload = await prepareQueueEnrichmentPayload({ itemId, media: { media_type: type } }, query);
    const metadata = {}, receipt = {};
    const service = new QueueInventoryTmdbEnrichmentService({ tmdbService: provider, logger });
    const attempted = await service.enrich(payload, metadata, payload.tmdb_id, { query, receipt });
    return { payload, metadata, receipt, attempted };
}
async function save(result, usingQuery = query) {
    const written = await persistEnrichmentMetadata(usingQuery, result.payload, result.payload.tmdb_id,
        result.metadata, result.attempted, result.receipt);
    if (written.rowCount === 1) reportInventoryProviderRecovery(logger, result.payload, result.receipt);
    return written;
}

test.each(['movie', 'tv'])('durable %s 404 recovers with a new service instance, without changing identity', async type => {
    await query('UPDATE media_server_items SET media_type=$2 WHERE id=$1', [itemId, type]);
    provider[type === 'movie' ? 'getMovieDetails' : 'getTVDetails'].mockRejectedValueOnce(missing());
    const first = await attempt(type);
    expect(logger.warn).not.toHaveBeenCalled(); // No warning before durable acceptance.
    await save(first);
    const failed = await stored();
    expect(failed.inventory_tmdb_recovery).toMatchObject({ status: 'open', category: 'not_found', attempt_count: 1 });
    expect(failed.inventory_tmdb_retry_after.getTime() - Date.now()).toBeGreaterThan(23 * 3600000);
    expect(failed.inventory_tmdb_fetched_at).toBeNull();
    expect((await attempt(type)).attempted).toBe(false);
    await due();
    await save(await attempt(type));
    const recovered = await stored();
    expect(recovered.inventory_tmdb_recovery).toMatchObject({ case_id: failed.inventory_tmdb_recovery.case_id,
        status: 'resolved', attempt_count: 2 });
    expect(recovered.inventory_tmdb_retry_after).toBeNull();
    expect(recovered.inventory_tmdb_lease_id).toBeNull();
    expect(recovered.metadata.inventory_tmdb).toMatchObject({ tmdb_id: 7, media_type: type });
    expect(recovered.tmdb_id).toBe(7);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(recovered.inventory_tmdb_recovery)).not.toContain('private');
});

test('unchanged failures update one case without repeating warnings', async () => {
    provider.getMovieDetails.mockRejectedValue(missing());
    await save(await attempt());
    const id = (await stored()).inventory_tmdb_recovery.case_id;
    for (let i = 0; i < 3; i++) { await due(); await save(await attempt()); }
    expect((await stored()).inventory_tmdb_recovery).toMatchObject({ case_id: id, attempt_count: 4 });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private');
});

test('concurrent claimants issue one provider request', async () => {
    let release, started;
    const entered = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    provider.getMovieDetails.mockImplementationOnce(async () => { started(); await gate; return response(); });
    const first = attempt();
    try {
        await entered;
        const second = await attempt();
        expect(second.attempted).toBe(false);
        expect(provider.getMovieDetails).toHaveBeenCalledTimes(1);
    } finally { release(); }
    expect((await save(await first)).rowCount).toBe(1);
    expect((await stored()).inventory_tmdb_recovery).toBeNull();
});

test('lease expiry reclaims interrupted work and rejects the old completion', async () => {
    provider.getMovieDetails.mockRejectedValueOnce(missing());
    const abandoned = await attempt();
    await query("UPDATE media_server_items SET inventory_tmdb_lease_until=NOW()-interval '1 second' WHERE id=$1", [itemId]);
    const replacement = await attempt();
    expect(replacement.receipt.token).not.toBe(abandoned.receipt.token);
    expect((await save(replacement)).rowCount).toBe(1);
    expect((await save(abandoned)).rowCount).toBe(0);
    expect((await stored()).metadata.inventory_tmdb.tmdb_id).toBe(7);
    expect((await stored()).inventory_tmdb_recovery).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
});

test('expired completion is rejected even before another worker reclaims it', async () => {
    const first = await attempt();
    await query("UPDATE media_server_items SET inventory_tmdb_lease_until=NOW()-interval '1 second' WHERE id=$1", [itemId]);
    expect((await save(first)).rowCount).toBe(0);
    expect((await stored()).inventory_tmdb_fetched_at).toBeNull();
});

test('a failed commit preserves the lease and never reports a recovered case', async () => {
    provider.getMovieDetails.mockRejectedValueOnce(missing());
    await save(await attempt());
    await due();
    const recovery = await attempt();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await persistEnrichmentMetadata((sql, values) => client.query(sql, values), recovery.payload, 7,
            recovery.metadata, true, recovery.receipt);
        await client.query('ROLLBACK');
    } finally { client.release(); }
    expect((await stored()).inventory_tmdb_recovery.status).toBe('open');
    expect((await stored()).inventory_tmdb_lease_id).toBe(recovery.receipt.token);
    expect(logger.info).not.toHaveBeenCalled();
    expect((await save(recovery)).rowCount).toBe(1);
    expect((await stored()).inventory_tmdb_recovery.status).toBe('resolved');
});

test('source changes away and back still fence the previous attempt', async () => {
    const first = await attempt();
    await query('UPDATE media_server_items SET tmdb_id=8 WHERE id=$1', [itemId]);
    await query('UPDATE media_server_items SET tmdb_id=7 WHERE id=$1', [itemId]);
    expect((await save(first)).rowCount).toBe(0);
    expect((await stored()).inventory_tmdb_attempted_at).toBeNull();
    expect((await save(await attempt())).rowCount).toBe(1);
});

test.each(['title', 'year', 'imdb_id', 'tvdb_id', 'external_id', 'media_type', 'library_id'])
('source %s change clears recovery, cooldown and lease', async field => {
    provider.getMovieDetails.mockRejectedValueOnce(missing());
    await save(await attempt());
    const updates = { title: "title='Changed'", year: 'year=2001', imdb_id: "imdb_id='tt123'", tvdb_id: 'tvdb_id=4',
        external_id: "external_id='changed'", media_type: "media_type='tv'", library_id: 'library_id=NULL' };
    await query(`UPDATE media_server_items SET ${updates[field]} WHERE id=$1`, [itemId]);
    expect(await stored()).toMatchObject({ inventory_tmdb_recovery: null, inventory_tmdb_retry_after: null,
        inventory_tmdb_lease_id: null, inventory_tmdb_attempted_at: null, inventory_tmdb_fetched_at: null });
});

test('library deactivation during I/O prevents observation and recovery persistence', async () => {
    const first = await attempt();
    await query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
    expect((await save(first)).rowCount).toBe(0);
    expect((await stored()).inventory_tmdb_fetched_at).toBeNull();
});
