/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest, beforeEach, afterEach, expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { QueueRefillService } from '../../services/queueRefillService.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../../services/queueInventoryTmdbEnrichmentService.mjs';
import { processMetadataEnrichmentTask } from '../../services/queueTaskProcessorEnrichment.mjs';
import { readLibraryProfileObservation } from '../../services/libraryProfileQueries.mjs';
import { inventoryObservationValidityCases } from '../helpers/inventoryObservationValidityCases.mjs';

let db, libraryId, refill, provider, deps;
const response = type => ({ id: 7, original_language: type === 'movie' ? 'ja' : 'fr',
    keywords: { [type === 'movie' ? 'keywords' : 'results']: [{ name: 'space' }, { name: 'space' }] } });
beforeEach(async () => {
    db = await getPool().connect();
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE tmdb_config (is_active boolean, api_key text) ON COMMIT DROP;
        INSERT INTO tmdb_config VALUES (true, 'fixture');
        CREATE TEMP TABLE omdb_config (is_active boolean, api_key text) ON COMMIT DROP;`);
    libraryId = (await db.query("INSERT INTO libraries (name, external_id, media_type, is_active) VALUES ($1, $2, 'movie', true) RETURNING id", [randomUUID(), randomUUID()])).rows[0].id;
    const logger = { info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    refill = new QueueRefillService({ db, logger });
    provider = { getApiKey: jest.fn().mockResolvedValue('fixture'),
        getMovieDetails: jest.fn().mockResolvedValue(response('movie')), getTVDetails: jest.fn().mockResolvedValue(response('tv')) };
    deps = { db, logger, metadataEnrichment: { hasWebSearchEnrichmentMetadata: () => false },
        enrichmentItemStateService: { markProcessing: jest.fn(), syncItemState: jest.fn() },
        resolveSourceLibraryName: async (_id, name) => name,
        queueOmdbEnrichmentService: { enrich: jest.fn() }, queueWebSearchEnrichmentService: { enrich: jest.fn() },
        queueTmdbResolutionService: { resolveAndBackfill: jest.fn().mockResolvedValue(7) },
        queueInventoryTmdbEnrichmentService: new QueueInventoryTmdbEnrichmentService({ tmdbService: provider, logger }),
        queueClassificationHistoryService: { persist: jest.fn() }, queryWithTimeout: (sql, values) => db.query(sql, values), completeTask: jest.fn() };
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });
async function add(type = 'movie', id = 7) {
    return (await db.query(`INSERT INTO media_server_items (external_id, title, library_id, media_type, tmdb_id, tags, metadata)
        VALUES ($1, 'Fixture only', $2, $3, $4, ARRAY['local label'], '{"content_analysis":{"source":"metadata_enrichment"},"omdb":{}}') RETURNING *`,
    [randomUUID(), libraryId, type, id])).rows[0];
}
async function pending() { return (await refill.selectRefillCandidates()).filter(row => row.library_id === libraryId); }
async function run(item) { await processMetadataEnrichmentTask({ id: 1, payload: refill.buildMetadataEnrichmentPayload(item) }, deps); }
async function stored(id) { return (await db.query('SELECT * FROM media_server_items WHERE id = $1', [id])).rows[0]; }
async function revision() { return (await db.query('SELECT revision::text FROM library_profile_inventory_state WHERE library_id = $1', [libraryId])).rows[0].revision; }

test('automatically backfills typed movie and TV observations and refreshes aggregate coverage', async () => {
    await add(); await add('tv');
    const candidates = await pending();
    expect(candidates).toHaveLength(2);
    expect(candidates.every(row => row.needs_standard_enrichment === false)).toBe(true);
    for (const item of candidates) await run(item);
    expect(provider.getMovieDetails).toHaveBeenCalledWith(7);
    expect(provider.getTVDetails).toHaveBeenCalledWith(7);
    expect(deps.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
    expect(deps.queueWebSearchEnrichmentService.enrich).not.toHaveBeenCalled();
    expect(deps.queueTmdbResolutionService.resolveAndBackfill).not.toHaveBeenCalled();
    expect(deps.queueClassificationHistoryService.persist).not.toHaveBeenCalled();
    expect(await pending()).toEqual([]);
    const { observation } = await readLibraryProfileObservation(db, libraryId);
    expect(observation.traits.keywords).toMatchObject({ observedCount: 2, entries: [{ value: 'space', count: 2 }] });
    expect(observation.traits.language.entries.map(row => row.value)).toEqual(['fr', 'ja']);
    expect(await revision()).toBe('4');
    expect((await stored(candidates[0].id)).tags).toEqual(['local label']);
    await run(candidates[0]);
    expect(provider.getMovieDetails).toHaveBeenCalledTimes(1);
    expect(await revision()).toBe('4');
});
test('normal enrichment adds the observation after existing identity resolution', async () => {
    const item = await add();
    await run({ ...item, needs_standard_enrichment: true });
    expect(deps.queueTmdbResolutionService.resolveAndBackfill).toHaveBeenCalled();
    expect(deps.queueClassificationHistoryService.persist).toHaveBeenCalled();
    expect((await stored(item.id)).metadata.inventory_tmdb.original_language).toBe('ja');
});
test('failed requests cool down without fabricated traits and later recover', async () => {
    const item = await add();
    provider.getMovieDetails.mockRejectedValueOnce(new Error('private diagnostic'));
    await run((await pending())[0]);
    expect((await stored(item.id)).metadata.inventory_tmdb).toBeUndefined();
    expect(deps.completeTask).toHaveBeenCalledWith(1, expect.objectContaining({ enriched: false, inventoryObservationStatus: 'unavailable' }));
    expect(await pending()).toEqual([]);
    expect(await revision()).toBe('1');
    await db.query("UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW() - INTERVAL '6 hours' WHERE id = $1", [item.id]);
    await run((await pending())[0]);
    expect((await stored(item.id)).metadata.inventory_tmdb.keywords).toEqual(['space']);
    expect(provider.getMovieDetails).toHaveBeenCalledTimes(2);
});
test('expiry retries retain the last successful observation and do not extend its acquisition time on failure', async () => {
    const item = await add(); await run((await pending())[0]);
    await db.query("UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW() - INTERVAL '31 days', inventory_tmdb_fetched_at = NOW() - INTERVAL '31 days' WHERE id = $1", [item.id]);
    const before = await stored(item.id);
    provider.getMovieDetails.mockRejectedValueOnce(new Error('offline'));
    await run((await pending())[0]);
    const after = await stored(item.id);
    expect(after.metadata.inventory_tmdb).toEqual(before.metadata.inventory_tmdb);
    expect(after.inventory_tmdb_fetched_at).toEqual(before.inventory_tmdb_fetched_at);
    expect(await pending()).toEqual([]);
});
test.each(['tmdb_id', 'media_type', 'library_id'])('source %s drift during provider request prevents persistence and successful completion', async field => {
    const item = await add();
    provider.getMovieDetails.mockImplementationOnce(async () => {
        if (field === 'tmdb_id') await db.query('UPDATE media_server_items SET tmdb_id = 8 WHERE id = $1', [item.id]);
        if (field === 'media_type') await db.query("UPDATE media_server_items SET media_type = 'tv' WHERE id = $1", [item.id]);
        if (field === 'library_id') await db.query('UPDATE media_server_items SET library_id = NULL WHERE id = $1', [item.id]);
        return response('movie');
    });
    await run((await pending())[0]);
    expect((await stored(item.id)).metadata.inventory_tmdb).toBeUndefined();
    expect((await stored(item.id)).inventory_tmdb_attempted_at).toBeNull();
    expect(deps.completeTask).toHaveBeenCalledWith(1, expect.objectContaining({ enriched: false, reason: 'source_identity_changed' }));
});
test('identity correction hides old traits and bookkeeping alone does not dirty the profile', async () => {
    const item = await add(); await run((await pending())[0]);
    const before = await revision();
    await db.query(`UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW(),
        metadata = jsonb_set(metadata, '{inventory_tmdb,fetched_at}', '"changed"') WHERE id = $1`, [item.id]);
    expect(await revision()).toBe(before);
    await db.query('UPDATE media_server_items SET tmdb_id = 8 WHERE id = $1', [item.id]);
    expect((await stored(item.id)).inventory_tmdb_attempted_at).toBeNull();
    expect((await stored(item.id)).inventory_tmdb_fetched_at).toBeNull();
    expect(await pending()).toHaveLength(1);
    const { observation } = await readLibraryProfileObservation(db, libraryId);
    expect(observation.traits.language.observedCount).toBe(0);
    expect(observation.traits.keywords.observedCount).toBe(0);
});
test('valid empty records stop automatic retries until expiry', async () => {
    const item = await add();
    provider.getMovieDetails.mockResolvedValueOnce({ id: 7, keywords: { keywords: [] } });
    await run((await pending())[0]);
    expect((await stored(item.id)).metadata.inventory_tmdb).toMatchObject({ keywords: [], original_language: null });
    expect(await pending()).toEqual([]);
});

test('refill repairs 26 malformed fresh captures through guarded observation-only workers', async () => {
    for (const fixture of inventoryObservationValidityCases) {
        const item = await add();
        await db.query(`UPDATE media_server_items SET metadata = metadata || $2::jsonb,
            inventory_tmdb_fetched_at = NOW(), inventory_tmdb_attempted_at = NOW() - INTERVAL '7 hours' WHERE id = $1`,
        [item.id, JSON.stringify({ inventory_tmdb: fixture.record })]);
    }
    const candidates = await pending();
    expect(candidates).toHaveLength(26);
    for (const item of candidates) await run(item);
    expect(provider.getMovieDetails).toHaveBeenCalledTimes(26);
    expect(await pending()).toEqual([]);
    expect(deps.queueOmdbEnrichmentService.enrich).not.toHaveBeenCalled();
    expect(deps.queueClassificationHistoryService.persist).not.toHaveBeenCalled();
});
test('background observations respect active libraries, configured providers, supported types, and pending work', async () => {
    const item = await add(); await add('movie', null); await add('person');
    await db.query("INSERT INTO task_queue (task_type, status, payload) VALUES ('metadata_enrichment', 'pending', $1), ('metadata_enrichment', 'pending', $2)",
        [JSON.stringify({ itemId: 'invalid' }), JSON.stringify({ itemId: '9'.repeat(100) })]);
    expect(await pending()).toHaveLength(1);
    await db.query('UPDATE libraries SET is_active = false WHERE id = $1', [libraryId]);
    expect(await pending()).toEqual([]);
    await db.query('UPDATE libraries SET is_active = true WHERE id = $1', [libraryId]);
    await db.query('UPDATE tmdb_config SET is_active = false');
    expect(await pending()).toEqual([]);
    await db.query('UPDATE tmdb_config SET is_active = true');
    await db.query("INSERT INTO task_queue (task_type, status, payload) VALUES ('metadata_enrichment', 'pending', $1)", [JSON.stringify({ itemId: item.id })]);
    expect(await pending()).toEqual([]);
});
