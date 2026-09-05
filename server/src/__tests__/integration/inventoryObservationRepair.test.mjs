/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { QueueRefillService } from '../../services/queueRefillService.mjs';
import { inventoryObservationValidityCases } from '../helpers/inventoryObservationValidityCases.mjs';

let db, refill;
beforeEach(async () => {
    db = await getPool().connect();
    await db.query('BEGIN');
    await db.query(`CREATE TEMP TABLE libraries (id integer PRIMARY KEY, name text, is_active boolean) ON COMMIT DROP;
        CREATE TEMP TABLE media_server_items (id integer PRIMARY KEY, library_id integer, media_type text,
            tmdb_id integer, title text, year integer, genres jsonb, tags text[], content_rating text,
            tvdb_id integer, imdb_id text, metadata jsonb, inventory_tmdb_attempted_at timestamptz,
            inventory_tmdb_fetched_at timestamptz) ON COMMIT DROP;
        CREATE TEMP TABLE task_queue (task_type text, status text, payload jsonb) ON COMMIT DROP;
        CREATE TEMP TABLE tmdb_config (is_active boolean, api_key text) ON COMMIT DROP;
        CREATE TEMP TABLE omdb_config (is_active boolean) ON COMMIT DROP;
        INSERT INTO libraries VALUES (1, 'Fixture', true);
        INSERT INTO tmdb_config VALUES (true, 'fixture');`);
    refill = new QueueRefillService({ db });
});
afterEach(async () => { await db.query('ROLLBACK'); db.release(); });

async function insert(id, record, type = 'movie') {
    await db.query(`INSERT INTO media_server_items
        (id, library_id, media_type, tmdb_id, metadata, inventory_tmdb_attempted_at, inventory_tmdb_fetched_at)
        VALUES ($1, 1, $2, 7, $3, NOW() - INTERVAL '7 hours', NOW())`,
    [id, type, JSON.stringify({ content_analysis: { source: 'metadata_enrichment' }, omdb: {}, inventory_tmdb: record })]);
}
async function selected() { return (await refill.selectRefillCandidates()).map(item => item.id); }

test('32 explicit validity cases agree with automatic repair for fresh captures', async () => {
    for (const [index, fixture] of inventoryObservationValidityCases.entries()) await insert(index + 1, fixture.record);
    expect(await selected()).toEqual(inventoryObservationValidityCases.flatMap((fixture, i) => fixture.reusable ? [] : [i + 1]));
    await db.query("UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW() - INTERVAL '5 hours'");
    expect(await selected()).toEqual([]);
    await db.query("UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW() - INTERVAL '6 hours'");
    expect(await selected()).toHaveLength(26);
});

test('stable pages reach a repair behind 5,000 fresh rows and wrap despite new insertions', async () => {
    await db.query(`INSERT INTO media_server_items
        (id, library_id, media_type, tmdb_id, metadata, inventory_tmdb_attempted_at, inventory_tmdb_fetched_at)
        SELECT id, 1, 'movie', 7, $1::jsonb, NOW() - INTERVAL '7 hours', NOW()
        FROM generate_series(1, 5000) id`,
    [JSON.stringify({ content_analysis: { source: 'metadata_enrichment' }, omdb: {}, inventory_tmdb: inventoryObservationValidityCases[1].record })]);
    await insert(5001, { ...inventoryObservationValidityCases[0].record, keywords: 'invalid' });
    expect(await selected()).toEqual([]);
    await insert(5002, null);
    await db.query("UPDATE media_server_items SET metadata = metadata - 'inventory_tmdb' WHERE id = 1");
    expect(await selected()).toEqual([5001]); // Pass ceiling excludes the newly inserted ID.
    expect(await selected()).toEqual([1]); // Wrapped page still consumes at most 5,000 rows.
    expect(await selected()).toEqual([5001, 5002]);
});

test('fresh malformed records retain operational gates and canonical task exclusion', async () => {
    for (let id = 1; id <= 5; id++) await insert(id, null, id === 5 ? 'person' : 'tv');
    await db.query(`UPDATE media_server_items SET tmdb_id = NULL WHERE id = 4;
        INSERT INTO task_queue VALUES
            ('metadata_enrichment', 'pending', '{"itemId":1}'),
            ('metadata_enrichment', 'processing', '{"itemId":"2"}'),
            ('metadata_enrichment', 'pending', '{"itemId":"3; DROP TABLE libraries"}'),
            ('metadata_enrichment', 'completed', '{"itemId":3}');`);
    expect(await selected()).toEqual([3]);
    await db.query('UPDATE libraries SET is_active = false');
    expect(await selected()).toEqual([]);
    await db.query("UPDATE libraries SET is_active = true; UPDATE tmdb_config SET api_key = '  '");
    expect(await selected()).toEqual([]);
    await db.query("UPDATE tmdb_config SET api_key = 'fixture', is_active = false");
    expect(await selected()).toEqual([]);
    await db.query('UPDATE tmdb_config SET is_active = true');
    expect(await selected()).toEqual([3]);
});

test('standard enrichment eligibility remains independent of observation gates', async () => {
    await insert(1, inventoryObservationValidityCases[1].record);
    await db.query("UPDATE media_server_items SET metadata = '{}', tmdb_id = NULL; UPDATE libraries SET is_active = false; DELETE FROM tmdb_config");
    const items = await refill.selectRefillCandidates();
    expect(items).toHaveLength(1);
    expect(refill.buildMetadataEnrichmentPayload(items[0]).inventory_tmdb_only).toBeUndefined();
});

test('future fetch clocks repair; future attempts hold backoff; expired valid captures renew', async () => {
    for (let id = 1; id <= 4; id++) await insert(id, inventoryObservationValidityCases[1].record);
    await db.query(`UPDATE media_server_items SET inventory_tmdb_fetched_at = NOW() + INTERVAL '1 day' WHERE id IN (1, 2);
        UPDATE media_server_items SET inventory_tmdb_attempted_at = NOW() + INTERVAL '1 day' WHERE id = 2;
        UPDATE media_server_items SET inventory_tmdb_fetched_at = NOW() - INTERVAL '30 days' WHERE id = 3;
        UPDATE media_server_items SET inventory_tmdb_fetched_at = NULL WHERE id = 4;`);
    expect(await selected()).toEqual([1, 3, 4]);
});
