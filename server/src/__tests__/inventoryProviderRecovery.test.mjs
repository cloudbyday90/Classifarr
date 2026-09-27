/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { nextInventoryProviderRecovery, readInventoryProviderRecovery } from '../services/inventoryProviderRecoveryPolicy.mjs';
import { reportInventoryProviderRecovery } from '../services/inventoryProviderRecoveryReporting.mjs';
import { readTmdbRetryAfter } from '../services/tmdbRetryAfter.mjs';
import { wrapTmdbDetailsFailure, tmdbObservationFailure } from '../services/tmdbObservationFailure.mjs';
import { inventoryTmdbObservationDue } from '../services/inventoryTmdbObservation.mjs';
import { claimInventoryProviderRecovery } from '../services/inventoryProviderRecoveryPersistence.mjs';
import { QueueInventoryTmdbEnrichmentService } from '../services/queueInventoryTmdbEnrichmentService.mjs';
import { persistEnrichmentMetadata } from '../services/queueEnrichmentPersistence.mjs';

const now = Date.parse('2026-09-27T12:00:00Z');
const HOUR = 3600000;
const step = (overrides = {}) => nextInventoryProviderRecovery({ tmdbId: 7, mediaType: 'movie',
    failure: { category: 'not_found' }, now, random: () => 0, ...overrides });

test.each(['not_found', 'authentication', 'tls', 'invalid_response', 'response_too_large', 'request_rejected'])
('slow recheck for %s, not a transient retry loop', category => {
    const result = step({ failure: { category, private: 'secret' } });
    expect(Date.parse(result.retryAfter) - now).toBe(24 * HOUR);
    expect(result.record).toMatchObject({ status: 'open', category, attempt_count: 1 });
    expect(JSON.stringify(result)).not.toContain('secret');
});

test.each(['network', 'timeout', 'cancelled', 'upstream_error', 'rate_limited', 'unknown'])
('backoff for %s is durable, capped, and jittered', category => {
    let result = step({ failure: { category }, random: () => 1 });
    expect(Date.parse(result.retryAfter) - now).toBe(7.2 * HOUR);
    const id = result.record.case_id;
    for (let attempt = 0; attempt < 20; attempt++) result = step({ previous: result.record, failure: { category } });
    expect(result.record.case_id).toBe(id);
    expect(result.transition).toBeNull();
    expect(result.record.attempt_count).toBe(21);
    expect(Date.parse(result.retryAfter) - now).toBe(20 * HOUR);
});

test('successful backfill resolves once; a later failure opens a new case', () => {
    const open = step().record;
    const resolved = step({ previous: open, failure: null, now: now + HOUR });
    expect(resolved).toMatchObject({ transition: 'resolved', retryAfter: null,
        record: { case_id: open.case_id, status: 'resolved', attempt_count: 2, resolved_at: new Date(now + HOUR).toISOString() } });
    expect(step({ previous: resolved.record, failure: null }).transition).toBeNull();
    expect(step({ previous: resolved.record }).record.case_id).not.toBe(open.case_id);
    expect(step({ failure: null })).toEqual({ record: null, retryAfter: null, transition: null });
});

test('changed cause retains case identity but reports the new reason', () => {
    const prior = step().record;
    expect(step({ previous: prior, failure: { category: 'network' } })).toMatchObject({ transition: 'opened',
        record: { case_id: prior.case_id, category: 'network', first_seen: prior.first_seen } });
});

test.each([null, {}, { version: 2 }, { tmdb_id: 8 }, { media_type: 'tv' }, { case_id: 'secret' },
    { status: 'unknown' }, { category: 'secret' }, { attempt_count: -1 }, { attempt_count: 1000001 },
    { first_seen: 'bad' }, { last_seen: 'bad' }, { status: 'resolved', resolved_at: 'bad' }, { resolved_at: { secret: true } }])
('rejects malformed/cross-identity recovery state %j', change => {
    const prior = step().record;
    const value = change == null ? change : { ...prior, ...change };
    if (change && Object.keys(change).length === 0) value.version = undefined;
    expect(readInventoryProviderRecovery(value, 7, 'movie')).toBeNull();
});

test('bounded counts and delays; no untrusted fields copied to resolved records', () => {
    const prior = { ...step().record, attempt_count: 1000000, secret: 'private' };
    const result = step({ previous: prior, random: () => -1 });
    expect(result.record.attempt_count).toBe(1000000);
    expect(Date.parse(result.retryAfter) - now).toBe(140 * HOUR);
    expect(JSON.stringify(step({ previous: prior, failure: null }))).not.toContain('private');
    expect(step({ failure: { category: 'secret' } }).record.category).toBe('unknown');
});

test.each([['120', 120000], ['0', 0], ['9999999999', 30 * 86400000], ['Sun, 27 Sep 2026 13:00:00 GMT', HOUR],
    ['Sun, 27 Sep 2026 11:00:00 GMT', 0], ['-1', null], ['1.5', null], ['secret', null], [[], null], ['x'.repeat(65), null]])
('sanitizes Retry-After %j', (value, expected) => {
    expect(readTmdbRetryAfter({ response: { status: 429, headers: { 'retry-after': value } } }, now)).toBe(expected);
});

test('only 429/503 timing crosses the sanitized error boundary', () => {
    const error = wrapTmdbDetailsFailure({ response: { status: 503, data: 'secret', headers: { 'retry-after': '7200', token: 'secret' } } });
    expect(tmdbObservationFailure(error).retryAfterMs).toBe(2 * HOUR);
    expect(JSON.stringify(error)).not.toContain('secret');
    expect(readTmdbRetryAfter({ response: { status: 404 }, retryAfterMs: 1000 })).toBeNull();
    const result = step({ failure: { category: 'rate_limited', retryAfterMs: 3 * 86400000 } });
    expect(Date.parse(result.retryAfter) - now).toBe(3 * 86400000);
});

test.each(['inventory_tmdb_retry_after', 'inventory_tmdb_lease_until'])('due reader respects persisted %s', field => {
    const payload = { media: { media_type: 'movie' }, [field]: new Date(now + HOUR) };
    expect(inventoryTmdbObservationDue(payload, 7, now)).toBe(false);
    payload[field] = new Date(now - 1);
    expect(inventoryTmdbObservationDue(payload, 7, now)).toBe(true);
});

test('reports transitions with actionable bounded fields, not every retry', () => {
    const logger = { warn: jest.fn(), info: jest.fn() };
    const payload = { itemId: 1, source_library_id: 2, title: 'private' };
    const outcome = step();
    reportInventoryProviderRecovery(logger, payload, { outcome });
    reportInventoryProviderRecovery(logger, payload, { outcome: step({ previous: outcome.record }) });
    reportInventoryProviderRecovery(logger, payload, { outcome: step({ previous: outcome.record, failure: null }) });
    reportInventoryProviderRecovery(logger, payload, {});
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1]).toMatchObject({ itemId: 1, caseId: outcome.record.case_id,
        recovery: expect.stringContaining('no replacement is guessed') });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private');
});

test('an item-bound call cannot bypass durable ownership', async () => {
    const getMovieDetails = jest.fn();
    const service = new QueueInventoryTmdbEnrichmentService({ tmdbService: { getApiKey: async () => 'fixture', getMovieDetails } });
    expect(await service.enrich({ itemId: 1, media: { media_type: 'movie' } }, {}, 7)).toBe(false);
    expect(getMovieDetails).not.toHaveBeenCalled();
    const query = jest.fn();
    expect(await claimInventoryProviderRecovery(query, { media: { media_type: 'movie' } }, 7)).toBeNull();
    expect(query).not.toHaveBeenCalled();
});

const boundPayload = () => ({ itemId: 1, source_library_id: 2, media: { media_type: 'movie' },
    source_identity_snapshot: { media_server_id: 1, external_id: 'fixture', library_id: 2,
        media_type: 'movie', title: 'Synthetic', year: 2001, imdb_id: null, tvdb_id: null } });

test.each(['success', 'missing', 'invalid'])('bound %s observation retains a receipt without premature reporting', async kind => {
    const receipt = {}, data = {}, logger = { warn: jest.fn() };
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ inventory_tmdb_recovery: null }] });
    const service = new QueueInventoryTmdbEnrichmentService({ logger, now: () => now, tmdbService: {
        getApiKey: async () => 'fixture', getMovieDetails: async () => {
            if (kind === 'missing') throw { response: { status: 404 } };
            return kind === 'invalid' ? {} : { id: 7, keywords: { keywords: [] }, production_companies: [] };
        },
    } });
    expect(await service.enrich(boundPayload(), data, 7, { query, receipt })).toBe(true);
    expect(receipt.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(receipt.outcome.record?.category ?? null).toBe(kind === 'success' ? null : kind === 'missing' ? 'not_found' : 'invalid_response');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(query.mock.calls[0][0]).toContain('IS NOT DISTINCT FROM $8::timestamptz');
    expect(query.mock.calls[0][1].slice(1, 5)).toEqual([1, 7, 'movie', 2]);
});

test('a lost claim does not call the provider or manufacture an outcome', async () => {
    const getMovieDetails = jest.fn(), receipt = {};
    const service = new QueueInventoryTmdbEnrichmentService({ tmdbService: { getApiKey: async () => 'fixture', getMovieDetails } });
    expect(await service.enrich(boundPayload(), {}, 7,
        { query: async () => ({ rowCount: 0 }), receipt })).toBe(false);
    expect(getMovieDetails).not.toHaveBeenCalled();
    expect(receipt).toEqual({});
});

test.each([[true, {}, {}], [true, {}, { token: 'token' }],
    [false, {}, { token: 'token', outcome: {} }], [false, { inventory_tmdb: {} }, {}]])
('persistence rejects incomplete or inconsistent ownership receipts', async (attempted, metadata, receipt) => {
    const query = jest.fn();
    expect(await persistEnrichmentMetadata(query, boundPayload(), 7, metadata, attempted, receipt)).toEqual({ rowCount: 0 });
    expect(query).not.toHaveBeenCalled();
});
