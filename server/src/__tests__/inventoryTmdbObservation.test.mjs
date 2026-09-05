/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, expect, test } from '@jest/globals';
import { normalizeOriginalLanguage, buildInventoryTmdbObservation, readInventoryTmdbObservation, inventoryTmdbObservationDue } from '../services/inventoryTmdbObservation.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../services/queueInventoryTmdbEnrichmentService.mjs';
import { QueueRefillService } from '../services/queueRefillService.mjs';
import { buildLibraryProfileObservation } from '../services/libraryProfileObservation.mjs';

const now = Date.parse('2026-09-05T12:00:00Z');
const details = (type = 'movie') => ({ id: 7, original_language: 'JA', keywords: { [type === 'movie' ? 'keywords' : 'results']: [{ name: ' space ' }, { name: 'space' }] } });
const record = () => buildInventoryTmdbObservation(details(), 7, 'movie', new Date(now).toISOString());
const payload = () => ({ tmdb_id: 7, media: { media_type: 'movie' } });

test.each([[null, null], [undefined, null], ['', null], ['unknown', null], ['en_US', null], ['en--US', null],
    ['und', null], ['zxx', null], ['mul', null], [' English ', null], [false, null], ['x'.repeat(200), null],
    ['EN-us', 'en-us'], ['zh-Hant', 'zh-hant'], ['ast', 'ast'], ['ja', 'ja']])('normalizes supplied language %j without guessing', (input, expected) => {
    expect(normalizeOriginalLanguage(input)).toBe(expected);
});
test.each(['movie', 'tv'])('accepts only the %s keyword envelope and records provenance', type => {
    expect(buildInventoryTmdbObservation(details(type), 7, type, 'time')).toEqual({ version: 1, tmdb_id: 7, media_type: type,
        keywords: ['space'], original_language: 'ja', fetched_at: 'time' });
});
test.each([null, {}, { ...details(), id: 8 }, { ...details(), id: '7' }, { ...details(), media_type: 'tv' },
    { ...details(), keywords: { results: [] } }, { ...details(), keywords: { id: 8, keywords: [] } },
    { ...details(), keywords: { keywords: ['space'] } }, { ...details(), keywords: { keywords: [{ name: 'x'.repeat(161) }] } },
    { ...details(), keywords: { keywords: Array(501).fill({ name: 'space' }) } }])('rejects mismatched or malformed provider observation', value => {
    expect(buildInventoryTmdbObservation(value, 7, 'movie', 'time')).toBeNull();
});
test('valid empty keywords and unknown original language are cached without inventing coverage', () => {
    const observation = buildInventoryTmdbObservation({ id: 7, keywords: { keywords: [] } }, 7, 'movie', 'time');
    expect(observation).toMatchObject({ keywords: [], original_language: null });
    const item = { tmdb_id: 7, media_type: 'movie', metadata: { inventory_tmdb: observation } };
    expect(buildLibraryProfileObservation([item]).traits.language.observedCount).toBe(0);
    expect(inventoryTmdbObservationDue({ ...payload(), inventory_tmdb: observation, inventory_tmdb_fetched_at: new Date(now) }, 7, now)).toBe(false);
});
test.each([{ tmdb_id: 8 }, { media_type: 'tv' }, { tmdb_id: null }])('identity changes invalidate previously stored traits', changes => {
    expect(readInventoryTmdbObservation({ tmdb_id: 7, media_type: 'movie', metadata: { inventory_tmdb: record() }, ...changes })).toBeNull();
});
test.each([{ keywords: [null] }, { keywords: [42] }, { keywords: [' space '] }, { keywords: 'space' },
    { original_language: undefined }, { original_language: 'unknown' }, { version: 2 }, { tmdb_id: '7' }])('rejects malformed stored records', changes => {
    expect(readInventoryTmdbObservation({ tmdb_id: 7, media_type: 'movie', metadata: { inventory_tmdb: { ...record(), ...changes } } })).toBeNull();
});
test('source tags and legacy default language never masquerade as attributable traits', () => {
    const item = { tmdb_id: 7, media_type: 'movie', tags: ['local tag'], metadata: { original_language: 'en', tmdb: { keywords: ['legacy'], original_language: 'en' } } };
    const result = buildLibraryProfileObservation([item]);
    expect(result.traits.keywords.observedCount).toBe(0);
    expect(result.traits.language.observedCount).toBe(0);
    expect(new QueueRefillService().buildMetadataEnrichmentPayload(item)).toMatchObject({ tags: ['local tag'], keywords: [], original_language: null });
});
test('refill carries provider traits and marks observation-only backfill', () => {
    expect(new QueueRefillService().buildMetadataEnrichmentPayload({ tmdb_id: 7, media_type: 'movie',
        needs_standard_enrichment: false, tags: ['local'], metadata: { inventory_tmdb: record() } })).toMatchObject({
        inventory_tmdb_only: true, keywords: ['space'], tags: ['local'], original_language: 'ja',
    });
});
test('cache freshness and retry cooldown are independent', () => {
    const stale = { ...payload(), inventory_tmdb: record(), inventory_tmdb_fetched_at: new Date(now - 31 * 86400000) };
    expect(inventoryTmdbObservationDue(stale, 7, now)).toBe(true);
    expect(inventoryTmdbObservationDue({ ...stale, inventory_tmdb_attempted_at: new Date(now - 3600000) }, 7, now)).toBe(false);
    expect(inventoryTmdbObservationDue({ ...stale, inventory_tmdb_attempted_at: new Date(now - 6 * 3600000) }, 7, now)).toBe(true);
});
test.each(['movie', 'tv'])('fetches the existing typed %s detail method with no additional keyword request', async type => {
    const provider = { getApiKey: jest.fn().mockResolvedValue('fixture'), getMovieDetails: jest.fn().mockResolvedValue(details()), getTVDetails: jest.fn().mockResolvedValue(details('tv')) };
    const data = {};
    expect(await new QueueInventoryTmdbEnrichmentService({ tmdbService: provider, now: () => now }).enrich({ media: { media_type: type } }, data, 7)).toBe(true);
    expect(data.inventory_tmdb.media_type).toBe(type);
    expect(provider[type === 'movie' ? 'getMovieDetails' : 'getTVDetails']).toHaveBeenCalledWith(7);
    expect(provider[type === 'movie' ? 'getTVDetails' : 'getMovieDetails']).not.toHaveBeenCalled();
});
test('fresh stored observation avoids provider calls', async () => {
    const provider = { getApiKey: jest.fn() };
    expect(await new QueueInventoryTmdbEnrichmentService({ tmdbService: provider, now: () => now }).enrich({ ...payload(),
        inventory_tmdb: record(), inventory_tmdb_fetched_at: new Date(now) }, {}, 7)).toBe(false);
    expect(provider.getApiKey).not.toHaveBeenCalled();
});
test('unconfigured provider does not claim an attempt', async () => {
    expect(await new QueueInventoryTmdbEnrichmentService({ tmdbService: { getApiKey: async () => null } }).enrich(payload(), {}, 7)).toBe(false);
});
test.each([new Error('private credential'), null])('provider failure or invalid response preserves prior data and logs only a reason', async failure => {
    const logger = { warn: jest.fn() };
    const service = new QueueInventoryTmdbEnrichmentService({ logger, tmdbService: { getApiKey: async () => 'fixture',
        getMovieDetails: async () => { if (failure) throw failure; return null; } } });
    const data = { other: true };
    expect(await service.enrich(payload(), data, 7)).toBe(true);
    expect(data).toEqual({ other: true });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private');
});
