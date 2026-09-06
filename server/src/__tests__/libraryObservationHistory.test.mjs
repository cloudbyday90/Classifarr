/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { captureLibraryObservationSample } from '../services/libraryObservationSample.mjs';
import { readLibraryObservationHistory } from '../services/libraryObservationHistory.mjs';
import { registerLibraryObservationHistorySchedule } from '../services/libraryObservationHistorySchedule.mjs';
import { createLibrariesRouter } from '../routes/librariesRouteShared.mjs';
import { createLibrariesRouteTestDeps } from './setup/createLibrariesRouteTestDeps.mjs';

const snapshot = { observed_at: '2026-09-05T12:00:00Z', acquisition_configured: true,
    active_library_count: 1, row_count: 0, libraries: [{ id: 7, name: 'PRIVATE' }], items: [], population_fingerprints: { 7: 'a'.repeat(64) },
    due: true, next_ceiling: 7, expected_last_sample_at: null, continuity_since: '2026-09-05T12:00:00Z',
    has_more: false, next_after_id: 0, scan_context: { scan_started_at: '2026-09-05T12:00:00Z', inventory_revision: '1', clock_revision: '0' } };
const history = { observed_at: snapshot.observed_at, activity: [], samples: [] };

test('automatically captures one library and skips an already sampled five-minute slot', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [snapshot] }).mockResolvedValueOnce({ rows: [{ captured: true }] })
        .mockResolvedValueOnce({ rows: [{ ...snapshot, due: false }] });
    expect(await captureLibraryObservationSample({ query })).toEqual({ captured: true });
    expect(JSON.parse(query.mock.calls[1][1][0])).toMatchObject({ library_id: 7, status: 'available',
        inventory_rows: 0, scanned_rows: 0, inventory_revision: '1' });
    expect(JSON.stringify(query.mock.calls[1][1])).not.toContain('PRIVATE');
    expect(await captureLibraryObservationSample({ query })).toEqual({ captured: false });
    expect(query).toHaveBeenCalledTimes(3);
});

test('incomplete scans persist partial state without returning it as complete coverage', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ ...snapshot, has_more: true, active_library_count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ captured: false }] });
    expect(await captureLibraryObservationSample({ query })).toEqual({ captured: false });
    expect(JSON.parse(query.mock.calls[1][1][0])).toMatchObject({ library_id: 7, status: 'in_progress',
        active_count: 3, inventory_lower_bound: 1 });
});

test('history exposes distinct populations and performs one read', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [history] });
    expect(await readLibraryObservationHistory({ query })).toMatchObject({ retentionHours: 168,
        activityPopulation: 'all_guarded_inventory_acquisition_attempts', samples: [], activity: [] });
    expect(query).toHaveBeenCalledTimes(1);
});

test('schedules automatic startup/five-minute sampling and hides internal errors', async () => {
    const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
    const capture = jest.fn().mockResolvedValueOnce({ captured: true }).mockRejectedValueOnce(new Error('PRIVATE'));
    const log = { warn: jest.fn() };
    registerLibraryObservationHistorySchedule(scheduler, { capture, log });
    expect(scheduler.schedule).toHaveBeenCalledWith('library-observation-history', '*/5 * * * *', expect.any(Function));
    expect(scheduler.scheduleInitial).toHaveBeenCalledWith('library-observation-history', 150000, expect.any(Function));
    expect(await scheduler.schedule.mock.calls[0][2]()).toEqual({ captured: true });
    await scheduler.scheduleInitial.mock.calls[0][2]();
    expect(log.warn).toHaveBeenCalledWith('Automatic observation history sample unavailable');
});

function appFor(db, authenticated = true) {
    const app = express();
    app.use('/api/libraries', createLibrariesRouter({ express, db, ...createLibrariesRouteTestDeps({
        authenticateTokenOrApiKey: (req, res, next) => authenticated ? next() : res.sendStatus(401),
    }) }));
    app.use((err, req, res, _next) => res.status(err.statusCode || 500).json({ error: 'Unavailable' }));
    return app;
}
test('history route authenticates before reading and is read-only/no-store', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [history] }) };
    await request(appFor(db, false)).get('/api/libraries/observation-history').expect(401);
    expect(db.query).not.toHaveBeenCalled();
    const response = await request(appFor(db)).get('/api/libraries/observation-history').expect(200);
    expect(response.body.version).toBe('library.observation_history.v1');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(db.query).toHaveBeenCalledTimes(1);
});
test.each(['limit=999999', 'libraryId=1', 'limit[]=2'])('rejects unbounded query input: %s', async query => {
    const db = { query: jest.fn() };
    await request(appFor(db)).get(`/api/libraries/observation-history?${query}`).expect(400);
    expect(db.query).not.toHaveBeenCalled();
});
test('limits repeated requests and does not manufacture zero activity on database failure', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [history] }) };
    const app = appFor(db);
    for (let i = 0; i < 30; i++) await request(app).get('/api/libraries/observation-history').expect(200);
    await request(app).get('/api/libraries/observation-history').expect(429);
    expect(db.query).toHaveBeenCalledTimes(30);
    await request(appFor({ query: jest.fn().mockRejectedValue(new Error('PRIVATE')) }))
        .get('/api/libraries/observation-history').expect(500, { error: 'Unavailable' });
});
