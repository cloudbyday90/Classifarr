/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { parseSourceIdentityIssueOffset, readSourceIdentityIssues } from '../services/sourceIdentityIssues.mjs';
import { registerSourceObservationRoutes } from '../routes/librariesRouteSourceObservations.mjs';

const row = () => ({ as_of: '2026-09-26T12:00:00Z', total: 1, retry_wait: 1, retry_due: 0,
    source_review: 0, not_recorded: 0, covered_libraries: 1, active_libraries: 2,
    items: [{ libraryId: 1, libraryName: 'Example', mediaServerId: 2, externalId: 'private-key',
        title: 'A\u0000title', year: 2020, mediaType: 'movie', issue: 'conflicting_provider_ids',
        recoveryState: 'retry_wait', retryAfter: '2026-09-27T12:00:00Z', lastSeenAt: '2026-09-26T12:00:00Z' }] });

test.each([{}, { offset: '0' }, { offset: '50' }])('accepts bounded page input %j', query => {
    expect(parseSourceIdentityIssueOffset(query)).toBe(Number(query.offset ?? 0));
});
test.each([{ offset: '-1' }, { offset: '1.5' }, { offset: ['0'] }, { offset: '1e3' },
    { offset: '1000000000' }, { offset: '01' }, { limit: '999' }, { offset: {} }])('rejects malformed input %j', query => {
    expect(() => parseSourceIdentityIssueOffset(query)).toThrow('Invalid source issue page');
});
test('returns a bounded, allowlisted page without credentials or source keys', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [row()] }) };
    const result = await readSourceIdentityIssues(db, 0);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1]).toEqual([50, 0]);
    expect(result).toMatchObject({ total: 1, recovery: { retry_wait: 1 }, items: [{ title: 'A title' }] });
    expect(result.items[0].key).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toMatch(/private-key|mediaServerId|externalId/);
    expect(db.query.mock.calls[0][0]).toContain('o.generation=c.generation');
    expect(db.query.mock.calls[0][0]).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
});
test('rejects invalid offsets and contradictory aggregates', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ ...row(), total: 2 }] }) };
    await expect(readSourceIdentityIssues(db, -1)).rejects.toThrow('Invalid source issue page');
    expect(db.query).not.toHaveBeenCalled();
    await expect(readSourceIdentityIssues(db)).rejects.toThrow('Inconsistent source issue counts');
    db.query.mockResolvedValue({ rows: [{ ...row(), total: -1 }] });
    await expect(readSourceIdentityIssues(db)).rejects.toThrow('Invalid source issue count');
});
test('endpoint rejects invalid parameters before SQL and sets no-store on failures', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [row()] }) };
    const app = express(); registerSourceObservationRoutes(app, { db });
    app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: 'unavailable' }));
    const bad = await request(app).get('/source-identity-issues?offset=0&limit=1');
    expect(bad.status).toBe(400);
    expect(bad.headers['cache-control']).toBe('no-store');
    expect(db.query).not.toHaveBeenCalled();
    const good = await request(app).get('/source-identity-issues');
    expect(good.status).toBe(200);
    expect(good.headers['cache-control']).toBe('no-store');
});
