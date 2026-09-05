/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { buildOverlapCohort } from '../services/libraryOverlapCohorts.mjs';
import { compareOverlapCohorts } from '../services/libraryOverlapComparison.mjs';
import { readLibraryOverlap } from '../services/libraryOverlapService.mjs';
import { createLibrariesRouter } from '../routes/librariesRouteShared.mjs';
import { createLibrariesRouteTestDeps } from './setup/createLibrariesRouteTestDeps.mjs';

const item = (id, extra = {}) => ({ tmdb_id: id, media_type: 'movie', library_id: 1, ...extra });
const cohort = rows => buildOverlapCohort(rows, 'movie');
const snapshot = extra => ({ observed_at: '2026-09-05T00:00:00Z', active_library_count: 2, row_count: 0,
    libraries: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }], items: [], ...extra });
const database = value => ({ query: jest.fn().mockResolvedValue({ rows: [value] }) });

describe('library overlap identity and trait measurements', () => {
    test('deduplicates placements, keeps media types separate and reports asymmetric denominators', () => {
        const left = cohort([item(7), item(7), item(8), item(9, { media_type: 'tv' }), item(null)]);
        const right = cohort([item(7)]);
        expect(left.summary).toMatchObject({ rowCount: 4, identifiedRowCount: 3, distinctIdentityCount: 2,
            duplicateRowCount: 1, unidentifiedRowCount: 1, identityCoveragePercent: 75 });
        expect(compareOverlapCohorts(left, right, 5)).toMatchObject({ sharedIdentityCount: 1,
            leftIdentityCount: 2, rightIdentityCount: 1, leftOverlapPercent: 50, rightOverlapPercent: 100,
            identityStatus: 'partial_coverage' });
    });
    test.each([null, 0, -1, 1.5, '7', 2147483648, NaN])('missing or invalid identity %s cannot become negative evidence', id => {
        const result = compareOverlapCohorts(cohort([item(id)]), cohort([item(7)]), 5);
        expect(result).toMatchObject({ identityStatus: 'insufficient_coverage', leftOverlapPercent: null });
        expect(result.traits.every(trait => trait.status === 'insufficient_coverage')).toBe(true);
    });
    test('fully identified disjoint cohorts have measured zero overlap', () => {
        expect(compareOverlapCohorts(cohort([item(1)]), cohort([item(2)]), 5)).toMatchObject({
            identityStatus: 'complete_coverage', sharedIdentityCount: 0, leftOverlapPercent: 0, rightOverlapPercent: 0 });
    });
    test('uses consensus across nonempty duplicate observations and retains conflicts regardless of row order', () => {
        const rows = [item(1, { genres: ['Action', 'Drama', 'Action'] }), item(1, { genres: ['Drama', 'Action'] }),
            item(1), item(2, { genres: ['Drama'] }), item(2, { genres: ['Comedy'] }), item(2, { genres: ['Drama'] }), item(3)];
        const left = cohort(rows);
        expect(left.summary.traits.find(trait => trait.field === 'genres')).toEqual({ field: 'genres', observedIdentityCount: 1,
            conflictingIdentityCount: 1, unknownIdentityCount: 2, coveragePercent: 33.3 });
        expect(cohort([...rows].reverse()).summary).toEqual(left.summary);
        const pair = compareOverlapCohorts(left, cohort([item(4, { genres: ['Action', 'Drama'] })]), 5);
        expect(pair.traits.find(trait => trait.field === 'genres')).toMatchObject({ status: 'partial_coverage',
            entries: [{ value: 'Action', leftCount: 1, rightCount: 1, leftPercentOfIdentities: 33.3, rightPercentOfIdentities: 100 },
                { value: 'Drama', leftCount: 1, rightCount: 1, leftPercentOfIdentities: 33.3, rightPercentOfIdentities: 100 }] });
    });
    test('compares whole cohorts, retains all common-value counts and bounds displayed values deterministically', () => {
        const left = cohort([item(1, { genres: ['Z', 'A', 'B', 'C', 'D', 'E', 'Only left'] }), item(2, { genres: ['Z'] })]);
        const right = cohort([item(3, { genres: ['A', 'Z', 'B', 'C', 'D', 'E'] }), item(4, { genres: ['Z'] })]);
        const trait = compareOverlapCohorts(left, right, 5).traits.find(value => value.field === 'genres');
        expect(trait).toMatchObject({ status: 'complete_coverage', commonValueCount: 6, truncated: true });
        expect(trait.entries.map(value => value.value)).toEqual(['Z', 'A', 'B', 'C', 'D']);
    });
    test('requires typed provenance for keywords and original language; legacy fields remain unknown', () => {
        const valid = { version: 1, tmdb_id: 1, media_type: 'movie', keywords: ['space'], original_language: 'en' };
        const result = cohort([item(1, { metadata: { inventory_tmdb: valid } }),
            item(2, { metadata: { inventory_tmdb: valid, tmdb: { keywords: ['space'], original_language: 'en' } } })]);
        expect(result.summary.traits.filter(trait => ['keywords', 'language'].includes(trait.field)))
            .toEqual(['keywords', 'language'].map(field => ({ field, observedIdentityCount: 1,
                conflictingIdentityCount: 0, unknownIdentityCount: 1, coveragePercent: 50 })));
    });
    test('empty cohorts have unknown coverage rather than invented percentages', () => {
        expect(cohort([]).summary).toMatchObject({ rowCount: 0, identityCoveragePercent: null });
        expect(cohort([]).summary.traits.every(trait => trait.coveragePercent === null)).toBe(true);
    });
});

describe('aggregate overlap service and route', () => {
    test('excludes raw item data, counts unsupported rows and forms only same-type pairs', async () => {
        const db = database(snapshot({ row_count: 5, active_library_count: 3,
            items: [item(1234567, { title: 'PRIVATE TITLE', metadata: { password: 'PRIVATE SECRET' }, omitted_traits: true }),
                item(1234567, { media_type: 'tv' }), item(1234567, { library_id: 2 }),
                item(1234567, { library_id: 2, media_type: 'tv' }), item(2, { library_id: 2, media_type: 'music' })] }));
        const result = await readLibraryOverlap(db);
        expect(result.scope).toMatchObject({ selectedLibraryCount: 2, excludedLibraryCount: 1 });
        expect(result.libraries[0]).toMatchObject({ omittedTraitRowCount: 1 });
        expect(result.libraries[1]).toMatchObject({ unsupportedTypeRowCount: 1 });
        expect(result.pairs.map(pair => [pair.mediaType, pair.sharedIdentityCount])).toEqual([['movie', 1], ['tv', 1]]);
        expect(JSON.stringify(result)).not.toMatch(/PRIVATE|1234567|tmdb_id|password/);
        expect(db.query).toHaveBeenCalledTimes(1);
    });
    test('withholds every comparison on inventory overflow', async () => {
        const result = await readLibraryOverlap(database(snapshot({ row_count: 20001 })));
        expect(result).toMatchObject({ status: 'capacity_exceeded', inventoryRowCount: null,
            inventoryRowCountLowerBound: 20001, pairs: [] });
        expect(result.libraries[0]).not.toHaveProperty('cohorts');
    });
    test('retains empty libraries and propagates database failure', async () => {
        expect((await readLibraryOverlap(database(snapshot()))).libraries[0]).toMatchObject({ inventoryRowCount: 0 });
        await expect(readLibraryOverlap({ query: jest.fn().mockRejectedValue(new Error('unavailable')) })).rejects.toThrow('unavailable');
    });
    function appFor(db, authenticated = true) {
        const app = express();
        app.use('/api/libraries', createLibrariesRouter({ express, db, ...createLibrariesRouteTestDeps({
            authenticateTokenOrApiKey: (req, res, next) => authenticated ? next() : res.sendStatus(401),
        }) }));
        app.use((err, req, res, _next) => res.status(err.statusCode || 500).json({ error: 'Unavailable' }));
        return app;
    }
    test('authenticates before any query and matches overlap ahead of /:id', async () => {
        const db = database(snapshot());
        expect((await request(appFor(db, false)).get('/api/libraries/overlap')).status).toBe(401);
        expect(db.query).not.toHaveBeenCalled();
        const result = await request(appFor(db)).get('/api/libraries/overlap');
        expect(result.status).toBe(200);
        expect(result.headers['cache-control']).toBe('no-store');
        expect(result.body.version).toBe('library.overlap.v1');
        expect(db.query).toHaveBeenCalledTimes(1);
    });
    test.each(['limit=999999', 'libraryId=1', 'limit[]=1', 'sql=DROP'])('rejects unexpected inputs without querying: %s', query => {
        const db = database(snapshot());
        return request(appFor(db)).get(`/api/libraries/overlap?${query}`).expect(400).then(() => expect(db.query).not.toHaveBeenCalled());
    });
    test('database failure returns an error, not a success-shaped empty report', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('unavailable')) };
        expect((await request(appFor(db)).get('/api/libraries/overlap')).status).toBe(500);
    });
    test('rate limits repeated authenticated reads before further database work', async () => {
        const db = database(snapshot());
        const app = appFor(db);
        for (let i = 0; i < 30; i++) await request(app).get('/api/libraries/overlap').expect(200);
        const result = await request(app).get('/api/libraries/overlap');
        expect(result.status).toBe(429);
        expect(result.headers['cache-control']).toBe('no-store');
        expect(result.headers['retry-after']).toBeTruthy();
        expect(db.query).toHaveBeenCalledTimes(30);
    });
});
