/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import { createInventoryRecoveryReadService } from '../services/inventoryRecoveryReadService.mjs';
import { projectInventoryRecovery } from '../services/inventoryRecoveryPresentation.mjs';

const at = '2026-09-27T12:00:00.000Z', caseId = '56d6ff3b-21ee-457b-bf93-b3d2ef767b4b';
const recovery = { version: 1, case_id: caseId, tmdb_id: 7, media_type: 'movie', status: 'open',
    category: 'not_found', attempt_count: 2, first_seen: at, last_seen: at, resolved_at: null };
const row = { id: 1, title: 'Fixture', year: 2020, library_name: 'Movies', media_type: 'movie',
    tmdb_id: 7, server_type: 'plex', recovery, retry_after: at, lease_until: null, source_blocked: false };
let db, resolveLinks, service, source;
beforeEach(() => {
    source = { id: 1, type: 'plex', external_id: '123', server_id: 2, url: 'private-url', api_key: 'private-key',
        item_revision: '1', server_revision: '2', library_revision: '3' };
    db = { query: jest.fn(async sql => ({ rows: sql.includes('FROM users') ? [{ role: 'admin', is_active: true }]
        : sql.includes('WITH cases') ? [{ as_of: at, total: 1, movies: 1, tv: 0, items: [row] }] : [source] })) };
    resolveLinks = jest.fn().mockResolvedValue(['safe-test-link']);
    service = createInventoryRecoveryReadService({ db, resolveLinks });
});
test('projects only allowlisted data, counts all cases and does not call Plex for a list', async () => {
    const result = await service.list(4);
    expect(result).toMatchObject({ version: 1, afterId: 0, total: 1, pageSize: 25, movies: 1, tv: 0,
        nextCursor: null, items: [{ id: 1, caseId, diagnosis: 'TMDb record not found', retryState: 'eligible', sourceReview: true }] });
    expect(resolveLinks).not.toHaveBeenCalled();
    expect(db.query.mock.calls[1][1]).toEqual([0, 30]);
    expect(JSON.stringify(result)).not.toMatch(/private|external_id|api_key/);
    expect(db.query.mock.calls.every(([sql]) => /^(SELECT|WITH)/.test(sql))).toBe(true);
});
test('keyset page stops at 25 with next cursor without returning the lookahead row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ role: 'admin', is_active: true }] })
        .mockResolvedValueOnce({ rows: [{ as_of: at, total: 30, movies: 30, tv: 0,
            items: Array.from({ length: 26 }, (_, i) => ({ ...row, id: i + 10 })) }] });
    const result = await service.list(4, { afterId: '9' });
    expect(result.items).toHaveLength(25); expect(result.nextCursor).toBe(34);
    expect(db.query.mock.calls[1][1][0]).toBe(9);
});
test.each([{ limit: '999' }, { afterId: '0' }, { afterId: '-1' }, { afterId: ['1'] },
    { afterId: {} }, { afterId: '1 OR 1=1' }, { afterId: '2147483648' }])('rejects hostile query %j', async query => {
    await expect(service.list(4, query)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.query).toHaveBeenCalledTimes(1);
});
test.each([{ role: 'user', is_active: true }, { role: 'admin', is_active: false }, undefined])('checks current actor %j', async actor => {
    db.query.mockResolvedValue({ rows: actor ? [actor] : [] });
    await expect(service.list(4)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.plexLink(4, '1', caseId)).rejects.toMatchObject({ statusCode: 403 });
    expect(resolveLinks).not.toHaveBeenCalled();
});
test('validates link identifiers and forbids caller-supplied URLs', async () => {
    for (const args of [['-1', caseId], ['1', 'wrong'], ['1', caseId, { url: 'evil' }]]) {
        await expect(service.plexLink(4, ...args)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(resolveLinks).not.toHaveBeenCalled();
});
test('missing/stale cases and non-Plex sources never call a provider', async () => {
    source = undefined;
    await expect(service.plexLink(4, '1', caseId)).rejects.toMatchObject({ statusCode: 404 });
    source = { type: 'jellyfin' };
    expect(await service.plexLink(4, '1', caseId)).toEqual({ status: 'unsupported', url: null });
    expect(resolveLinks).not.toHaveBeenCalled();
});
test('an offline link is retried on a future read and connection errors never escape', async () => {
    resolveLinks.mockRejectedValueOnce(new Error('private-secret'));
    expect(await service.plexLink(4, '1', caseId)).toEqual({ status: 'unavailable', url: null });
    expect(await service.plexLink(4, '1', caseId)).toEqual({ status: 'available', url: 'safe-test-link' });
    expect(resolveLinks).toHaveBeenLastCalledWith({ id: 2, url: 'private-url', api_key: 'private-key' }, ['123']);
});
test.each(['item_revision', 'server_revision', 'library_revision'])('fences changed %s after network I/O', async field => {
    resolveLinks.mockImplementationOnce(async () => { source = { ...source, [field]: 'changed' }; return ['link']; });
    await expect(service.plexLink(4, '1', caseId)).rejects.toMatchObject({ statusCode: 409 });
});
test('fences deletion and actor revocation after network I/O', async () => {
    resolveLinks.mockImplementationOnce(async () => { source = undefined; return ['link']; });
    await expect(service.plexLink(4, '1', caseId)).rejects.toMatchObject({ statusCode: 409 });
    source = { type: 'plex' };
    resolveLinks.mockImplementationOnce(async () => { db.query.mockResolvedValue({ rows: [{ role: 'user' }] }); return ['link']; });
    await expect(service.plexLink(4, '1', caseId)).rejects.toMatchObject({ statusCode: 403 });
});
test.each([
    [{ retry_after: '2026-10-01' }, 'waiting'], [{ lease_until: '2026-10-01' }, 'in_progress'],
    [{ source_blocked: true }, 'source_blocked'], [{ retry_after: null }, 'not_scheduled'],
    [{ retry_after: 'bad', lease_until: 'bad' }, 'not_scheduled'],
])('projects retry eligibility honestly for %j', (patch, expected) => {
    expect(projectInventoryRecovery({ ...row, ...patch }, at).retryState).toBe(expected);
});
test('malformed optional evidence is withheld; UI values are bounded', () => {
    const value = projectInventoryRecovery({ ...row, title: '\n', library_name: null, year: -1,
        recovery: { ...recovery, version: 9, private: 'secret' } }, at);
    expect(value).toMatchObject({ title: 'Untitled item', libraryName: 'Unknown library', year: null,
        caseId: null, diagnosis: 'Recovery details unavailable', attemptCount: null, identityCheck: null });
    expect(JSON.stringify(value)).not.toContain('secret');
    expect(projectInventoryRecovery({ ...row, title: 'a'.repeat(900) }, at).title).toHaveLength(500);
});
test.each(['provider_authentication', 'provider_rate_limited', 'same_identity'])('does not recommend source repair for %s', outcome => {
    expect(projectInventoryRecovery({ ...row, recovery: { ...recovery,
        identity_check: { version: 1, outcome, checked_at: at, candidate_tmdb_id: null } } }, at).sourceReview).toBe(false);
});
