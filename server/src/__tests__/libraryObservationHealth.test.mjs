/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { measureLibraryObservationRow } from '../services/libraryObservationHealthState.mjs';
import { readLibraryObservationHealth } from '../services/libraryObservationHealthService.mjs';
import { inventoryTmdbObservationDue } from '../services/inventoryTmdbObservation.mjs';
import { createLibrariesRouter } from '../routes/librariesRouteShared.mjs';
import { createLibrariesRouteTestDeps } from './setup/createLibrariesRouteTestDeps.mjs';

const now = Date.parse('2026-09-05T12:00:00Z');
const ago = hours => new Date(now - hours * 3600000).toISOString();
const observation = () => ({ version: 1, tmdb_id: 7, media_type: 'movie', keywords: ['space'], original_language: 'en' });
const item = extra => ({ library_id: 1, tmdb_id: 7, media_type: 'movie', ...extra });
const captured = extra => item({ has_observation: true, metadata: { inventory_tmdb: observation() },
    inventory_tmdb_fetched_at: ago(1), inventory_tmdb_attempted_at: ago(1), ...extra });
const snapshot = extra => ({ observed_at: ago(0), acquisition_configured: true, active_library_count: 1,
    row_count: 0, libraries: [{ id: 1, name: 'Movies' }], items: [], ...extra });
const database = value => ({ query: jest.fn().mockResolvedValue({ rows: [value] }) });

describe('observation row health', () => {
    test.each([
        [item({ media_type: 'music' }), 'unsupported_type'], [item({ tmdb_id: null }), 'missing_identity'],
        [item({ tmdb_id: '7x' }), 'missing_identity'], [item({ observation_withheld: true }), 'observation_withheld'],
        [item({}), 'never_observed'], [captured({}), 'fresh'],
        [captured({ inventory_tmdb_fetched_at: ago(720), inventory_tmdb_attempted_at: ago(720) }), 'due'],
        [captured({ inventory_tmdb_fetched_at: ago(719.999), inventory_tmdb_attempted_at: ago(720) }), 'fresh'],
        [item({ inventory_tmdb_attempted_at: ago(5.999) }), 'backoff'],
        [item({ inventory_tmdb_attempted_at: ago(6) }), 'due'],
        [item({ inventory_tmdb_attempted_at: ago(7) }), 'due'],
        [captured({ inventory_tmdb_fetched_at: null }), 'backoff'],
        [captured({ inventory_tmdb_fetched_at: null, inventory_tmdb_attempted_at: null }), 'due'],
    ])('measures state and exact boundaries: %j => %s', (row, state) => {
        expect(measureLibraryObservationRow(row, now).state).toBe(state);
        if (['fresh', 'backoff', 'never_observed', 'due'].includes(state)) {
            const due = inventoryTmdbObservationDue({ ...row, media: { media_type: row.media_type },
                inventory_tmdb: row.metadata?.inventory_tmdb }, row.tmdb_id, now);
            expect(due).toBe(['never_observed', 'due'].includes(state));
        }
    });
    test.each(['infinity', 'invalid', ago(-1), 123, true])('invalid/future clocks are not fresh or successful: %j', value => {
        const result = measureLibraryObservationRow(captured({ inventory_tmdb_fetched_at: value }), now);
        expect(result).toMatchObject({ state: 'clock_anomaly', clockAnomaly: true, successfulAt: null });
    });
    test('a future attempt flags anomalous scheduling while preserving a valid older successful observation', () => {
        expect(measureLibraryObservationRow(captured({ inventory_tmdb_attempted_at: ago(-1) }), now))
            .toMatchObject({ state: 'clock_anomaly', successfulAt: Date.parse(ago(1)), attemptWithoutRefresh: false });
    });
    test('unknown/empty provider traits remain unknown despite a fresh successful capture', () => {
        const row = captured({ metadata: { inventory_tmdb: { ...observation(), keywords: [], original_language: null } } });
        expect(measureLibraryObservationRow(row, now)).toMatchObject({ state: 'fresh', captured: true,
            keywordsKnown: false, languageKnown: false, emptyKeywords: true, unknownLanguage: true });
    });
    test.each([{ tmdb_id: 8 }, { media_type: 'tv' }, { keywords: [' bad '] }, { original_language: 'unknown' }])('rejects mismatched or malformed observations: %j', change => {
        const row = captured({ metadata: { inventory_tmdb: { ...observation(), ...change } } });
        expect(measureLibraryObservationRow(row, now)).toMatchObject({ state: 'backoff', captured: false,
            invalidObservation: true, keywordsKnown: false, languageKnown: false, successfulAt: null });
    });
    test('does not confuse generic completion, legacy language or source tags with observation success', () => {
        expect(measureLibraryObservationRow(item({ enrichment_status: 'completed', tags: ['space'],
            metadata: { tmdb: { original_language: 'en', keywords: ['space'] } } }), now))
            .toMatchObject({ state: 'never_observed', captured: false, successfulAt: null });
    });
    test('undated provenance supplies coverage but no fabricated success time', () => {
        expect(measureLibraryObservationRow(captured({ inventory_tmdb_fetched_at: null }), now))
            .toMatchObject({ undatedObservation: true, keywordsKnown: true, successfulAt: null });
    });
    test('attempts without refresh are distinct from fresh coverage and queue activity', () => {
        const result = measureLibraryObservationRow(captured({ inventory_tmdb_fetched_at: ago(3),
            has_processing_task: true, has_pending_task: true }), now);
        expect(result).toMatchObject({ state: 'fresh', attemptWithoutRefresh: true, queueState: 'processing' });
        expect(measureLibraryObservationRow(item({ has_pending_task: true }), now).queueState).toBe('pending');
    });
});

describe('aggregate observation health and authenticated route', () => {
    test('partitions rows, retains row denominators and excludes media content and credentials', async () => {
        const db = database(snapshot({ row_count: 4, items: [captured({ title: 'PRIVATE', id: 9876543 }), captured({}),
            item({ tmdb_id: null }), item({ media_type: 'music', metadata: { secret: 'PRIVATE' } })] }));
        const result = await readLibraryObservationHealth(db);
        expect(result.libraries[0]).toMatchObject({ inventoryRowCount: 4, supportedRowCount: 3, identifiedRowCount: 2,
            identityCoveragePercent: 66.7, keywordCoveragePercent: 100, languageCoveragePercent: 100,
            counts: { captured: 2 }, states: { fresh: 2, missing_identity: 1, unsupported_type: 1 }, queue: { idle: 4 },
            lastSuccessfulObservationAt: ago(1), oldestSuccessfulObservationAt: ago(1) });
        expect(Object.values(result.libraries[0].states).reduce((a, b) => a + b)).toBe(4);
        expect(JSON.stringify(result)).not.toMatch(/PRIVATE|9876543|tmdb_id|space|metadata/);
        expect(db.query).toHaveBeenCalledTimes(1);
    });
    test('reports oldest/latest valid capture times, not task times or future clocks', async () => {
        const result = await readLibraryObservationHealth(database(snapshot({ row_count: 3, items: [
            captured({ inventory_tmdb_fetched_at: ago(5) }), captured({}), captured({ inventory_tmdb_fetched_at: ago(-1) })] })));
        expect(result.libraries[0]).toMatchObject({ lastSuccessfulObservationAt: ago(1), oldestSuccessfulObservationAt: ago(5) });
    });
    test('empty libraries have no invented percentages or successful times', async () => {
        expect((await readLibraryObservationHealth(database(snapshot()))).libraries[0]).toMatchObject({
            inventoryRowCount: 0, identityCoveragePercent: null, keywordCoveragePercent: null, languageCoveragePercent: null,
            lastSuccessfulObservationAt: null, oldestSuccessfulObservationAt: null });
    });
    test('withholds all sampled counts at capacity and discloses excluded libraries', async () => {
        const result = await readLibraryObservationHealth(database(snapshot({ row_count: 20001, active_library_count: 15 })));
        expect(result).toMatchObject({ status: 'capacity_exceeded', inventoryRowCount: null,
            inventoryRowCountLowerBound: 20001, scope: { excludedLibraryCount: 14 } });
        expect(result.libraries[0]).not.toHaveProperty('states');
    });
    test('invalid snapshot clocks and database failure remain unavailable', async () => {
        await expect(readLibraryObservationHealth(database(snapshot({ observed_at: 'invalid' })))).rejects.toThrow('snapshot time');
        await expect(readLibraryObservationHealth({ query: jest.fn().mockRejectedValue(new Error('unavailable')) })).rejects.toThrow('unavailable');
    });
    function appFor(db, authenticated = true) {
        const app = express();
        app.use('/api/libraries', createLibrariesRouter({ express, db, ...createLibrariesRouteTestDeps({
            authenticateTokenOrApiKey: (req, res, next) => authenticated ? next() : res.sendStatus(401),
        }) }));
        app.use((err, req, res, _next) => res.status(err.statusCode || 500).json({ error: 'Unavailable' }));
        return app;
    }
    test('authenticates before reading and matches the named endpoint before /:id', async () => {
        const db = database(snapshot());
        await request(appFor(db, false)).get('/api/libraries/observation-health').expect(401);
        expect(db.query).not.toHaveBeenCalled();
        const response = await request(appFor(db)).get('/api/libraries/observation-health').expect(200);
        expect(response.body.version).toBe('library.observation_health.v1');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(db.query).toHaveBeenCalledTimes(1);
    });
    test.each(['limit=999999', 'libraryId=1', 'sql=DROP', 'limit[]=2'])('rejects unexpected parameters before database work: %s', async query => {
        const db = database(snapshot());
        await request(appFor(db)).get(`/api/libraries/observation-health?${query}`).expect(400);
        expect(db.query).not.toHaveBeenCalled();
    });
    test('rate limits repeated reads before further queries', async () => {
        const db = database(snapshot());
        const app = appFor(db);
        for (let i = 0; i < 30; i++) await request(app).get('/api/libraries/observation-health').expect(200);
        const result = await request(app).get('/api/libraries/observation-health').expect(429);
        expect(result.headers['retry-after']).toBeTruthy();
        expect(db.query).toHaveBeenCalledTimes(30);
    });
    test('database failure does not return a healthy empty inventory', async () => {
        await request(appFor({ query: jest.fn().mockRejectedValue(new Error('private failure')) }))
            .get('/api/libraries/observation-health').expect(500);
    });
});
