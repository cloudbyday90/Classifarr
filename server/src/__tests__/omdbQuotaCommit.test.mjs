/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
const httpGet = jest.fn();
const db = { query: jest.fn(), withTransaction: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => db);
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGet }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ createLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}) }));
const { omdbService } = await import('../services/omdb.mjs');
beforeEach(() => {
    jest.resetAllMocks();
    omdbService._resetRateLimiter();
    db.query.mockResolvedValue({ rows: [{ id: 1, api_key: 'private-fixture-key', daily_limit: 10,
        requests_today: 0, last_reset_date: '2026-09-07', quota_day: '2026-09-07' }] });
    httpGet.mockResolvedValue({ data: { Response: 'False', Error: 'Movie not found!' } });
});

test('does not dispatch until the transaction helper has committed', async () => {
    let releaseCommit;
    let reachedCommit;
    const commitGate = new Promise(resolve => { releaseCommit = resolve; });
    const atCommit = new Promise(resolve => { reachedCommit = resolve; });
    db.withTransaction.mockImplementation(async work => {
        const result = await work(db);
        reachedCommit();
        await commitGate;
        return result;
    });
    const lookup = omdbService.getByIMDBId('tt0000001');
    try {
        await atCommit;
        expect(httpGet).not.toHaveBeenCalled();
    } finally { releaseCommit(); }
    await lookup;
    expect(httpGet).toHaveBeenCalledTimes(1);
});

test.each(['connection', 'commit'])('%s failure never dispatches and does not expose database error text', async stage => {
    db.withTransaction.mockImplementation(async work => {
        if (stage === 'commit') await work(db);
        throw new Error('private-fixture-key SQL detail');
    });
    await expect(omdbService.getByIMDBId('tt0000001')).rejects.toThrow('OMDb quota is unavailable');
    expect(httpGet).not.toHaveBeenCalled();
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
});

test('availability read sanitizes database failures and cannot write or start a transaction', async () => {
    db.query.mockRejectedValue(new Error('private-fixture-key SQL detail'));
    expect(await omdbService.hasRemainingQuota()).toEqual({ available: false, used: 0, limit: 0, reason: 'OMDb quota is unavailable' });
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/^SELECT /);
});
