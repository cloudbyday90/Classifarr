/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { revalidateInventoryIdentity } from '../services/inventoryIdentityRevalidation.mjs';
import { readInventoryIdentityCheck } from '../services/inventoryIdentityCheck.mjs';
import { nextInventoryProviderRecovery, readInventoryProviderRecovery } from '../services/inventoryProviderRecoveryPolicy.mjs';
import { reportInventoryProviderRecovery } from '../services/inventoryProviderRecoveryReporting.mjs';
import { getTmdbIdentityDetails, findTmdbIdentityByExternalId } from '../services/tmdbIdentitySearch.mjs';

const now = Date.parse('2026-09-27T12:00:00Z');
const source = (type = 'movie') => ({ media_type: type, title: 'Synthetic', year: 2001, imdb_id: 'tt123', tvdb_id: 99 });
const found = (type, id) => ({ [type === 'movie' ? 'movie_results' : 'tv_results']: id ? [{ id }] : [] });
const details = type => ({ id: 8, [type === 'movie' ? 'title' : 'name']: 'Synthetic',
    [type === 'movie' ? 'release_date' : 'first_air_date']: '2001-01-01' });
const provider = (type = 'movie') => ({ findIdentityByExternalId: jest.fn().mockResolvedValue(found(type, 8)),
    getIdentityDetails: jest.fn().mockResolvedValue(details(type)) });
const run = (item, api) => revalidateInventoryIdentity(item, 7, api, () => now);
const check = (outcome, candidate = null) => ({ version: 1, outcome, checked_at: new Date(now).toISOString(), candidate_tmdb_id: candidate });
const step = (overrides = {}) => nextInventoryProviderRecovery({ tmdbId: 7, mediaType: 'movie',
    failure: { category: 'not_found' }, now, random: () => 0, ...overrides });

test.each(['movie', 'tv'])('corroborates %s candidate without source mutation, search, or identity writes', async type => {
    const api = provider(type), item = source(type), original = structuredClone(item);
    expect(await run(item, api)).toEqual({ check: check('candidate_for_review', 8), retryAfterMs: 0 });
    expect(api.findIdentityByExternalId).toHaveBeenCalledTimes(type === 'tv' ? 2 : 1);
    expect(api.getIdentityDetails).toHaveBeenCalledWith(8, type);
    expect(item).toEqual(original);
    if (type === 'movie') expect(api.findIdentityByExternalId).not.toHaveBeenCalledWith(99, 'tvdb_id');
});

test.each([null, { media_type: 'music' }, { ...source(), imdb_id: 'https://untrusted/secret' },
    { ...source('tv'), tvdb_id: 'bad' }])('rejects malformed source without provider calls %j', async item => {
    const api = provider();
    expect((await run(item, api)).check.outcome).toBe('invalid_source_evidence');
    expect(api.findIdentityByExternalId).not.toHaveBeenCalled();
});

test('missing external IDs cannot fall back to a title guess', async () => {
    const api = provider();
    expect((await run({ ...source(), imdb_id: null }, api)).check.outcome).toBe('no_external_ids');
    expect(api.findIdentityByExternalId).not.toHaveBeenCalled();
    expect(api.getIdentityDetails).not.toHaveBeenCalled();
});

test.each([
    [found('movie', null), 'external_id_not_found'],
    [found('movie', 7), 'same_identity'],
    [{ movie_results: [{ id: 8 }, { id: 9 }] }, 'ambiguous_external_evidence'],
    [{ movie_results: [{ id: 8 }, { id: 8 }] }, 'invalid_provider_response'],
    [{ tv_results: [{ id: 8 }] }, 'invalid_provider_response'],
    [{ movie_results: [{ id: 8, media_type: 'tv' }] }, 'invalid_provider_response'],
])('bounded find outcome %s maps to %s', async (response, outcome) => {
    const api = provider(); api.findIdentityByExternalId.mockResolvedValue(response);
    expect((await run(source(), api)).check).toEqual(check(outcome));
    expect(api.getIdentityDetails).not.toHaveBeenCalled();
});

test.each([[9, 'external_ids_disagree'], [null, 'incomplete_external_evidence']])
('all TV external IDs must agree: %s', async (second, outcome) => {
    const api = provider('tv'); api.findIdentityByExternalId.mockResolvedValueOnce(found('tv', 8)).mockResolvedValueOnce(found('tv', second));
    expect((await run(source('tv'), api)).check.outcome).toBe(outcome);
    expect(api.getIdentityDetails).not.toHaveBeenCalled();
});

test.each([[{ title: 'Different' }, 'candidate_mismatch'], [{ release_date: '2002-01-01' }, 'candidate_mismatch'],
    [{ id: 9 }, 'invalid_provider_response'], [{ media_type: 'tv' }, 'invalid_provider_response'],
    [{ release_date: 'bad' }, 'invalid_provider_response']])('candidate details validate %j', async (change, outcome) => {
    const api = provider(); api.getIdentityDetails.mockResolvedValue({ ...details('movie'), ...change });
    expect((await run(source(), api)).check).toEqual(check(outcome));
});

test('incomplete source details do not authorize a candidate', async () => {
    const api = provider();
    expect((await run({ ...source(), year: null }, api)).check.outcome).toBe('source_details_incomplete');
    expect(api.getIdentityDetails).not.toHaveBeenCalled();
});

test.each(['findIdentityByExternalId', 'getIdentityDetails'])('sanitizes %s failure and retains Retry-After', async method => {
    const api = provider(); api[method].mockRejectedValue({ message: 'secret', response: { status: 429,
        data: 'private', headers: { 'retry-after': '172800', authorization: 'secret' } } });
    const result = await run(source(), api);
    expect(result).toEqual({ check: check('provider_rate_limited'), retryAfterMs: 172800000 });
    expect(JSON.stringify(result)).not.toMatch(/secret|private/);
    if (method === 'findIdentityByExternalId') expect(api.getIdentityDetails).not.toHaveBeenCalled();
});

test.each([[401, 'provider_authentication'], [503, 'provider_unavailable'], [404, 'provider_unavailable']])
('a failed lookup HTTP %s is not a successful empty lookup', async (status, outcome) => {
    const api = provider('tv'); api.findIdentityByExternalId.mockRejectedValue({ response: { status } });
    expect((await run(source('tv'), api)).check.outcome).toBe(outcome);
    expect(api.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test.each([null, {}, { version: 2 }, { outcome: 'secret' }, { checked_at: 'bad' },
    { checked_at: 'x'.repeat(33) }, { candidate_tmdb_id: 8 },
    { outcome: 'candidate_for_review', candidate_tmdb_id: null },
    { outcome: 'candidate_for_review', candidate_tmdb_id: 7 }])('bounded check reader rejects %j', change => {
    const value = change === null ? null : { ...check('same_identity'), ...change };
    if (change && !Object.keys(change).length) value.version = undefined;
    expect(readInventoryIdentityCheck(value, 7)).toBeNull();
});

test('diagnostic change reports once; time-only updates stay quiet and success retains safe evidence', () => {
    const initial = step({ identityCheck: check('external_id_not_found') });
    const same = step({ previous: initial.record, identityCheck: { ...check('external_id_not_found'), checked_at: new Date(now + 1000).toISOString() } });
    expect(same.transition).toBeNull();
    const changed = step({ previous: same.record, identityCheck: check('candidate_for_review', 8) });
    expect(changed.transition).toBe('updated');
    expect(changed.record.case_id).toBe(initial.record.case_id);
    const dirty = { ...changed.record, identity_check: { ...changed.record.identity_check, secret: 'private' } };
    const resolved = step({ previous: dirty, failure: null });
    expect(resolved.record.identity_check).toEqual(check('candidate_for_review', 8));
    expect(JSON.stringify(resolved)).not.toContain('private');
    expect(step({ previous: resolved.record }).record.identity_check).toBeUndefined();
    expect(readInventoryProviderRecovery({ ...initial.record, identity_check: { version: 2 } }, 7, 'movie').identity_check).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(changed.record))).toBeLessThan(2048);
});

test.each(['no_external_ids', 'invalid_source_evidence', 'external_id_not_found', 'external_ids_disagree',
    'incomplete_external_evidence', 'ambiguous_external_evidence', 'invalid_provider_response',
    'provider_unavailable', 'provider_authentication', 'provider_rate_limited', 'same_identity',
    'source_details_incomplete', 'candidate_mismatch', 'candidate_for_review'])('actionable log for %s', outcome => {
    const logger = { warn: jest.fn() };
    const value = check(outcome, outcome === 'candidate_for_review' ? 8 : null);
    reportInventoryProviderRecovery(logger, { itemId: 1, source_library_id: 2 }, { outcome: step({ identityCheck: value }) });
    expect(logger.warn).toHaveBeenCalledWith('Inventory TMDb observation needs recovery', expect.objectContaining({
        identityCheck: value, recovery: expect.any(String),
    }));
});

test('both identity endpoints keep shared rate admission, deadline and decoded response limits', async () => {
    const deps = { getApiKey: async () => 'fixture', executeRateLimited: jest.fn(fn => fn()),
        httpGet: jest.fn().mockResolvedValue({ data: {} }), baseUrl: 'https://example.invalid' };
    await getTmdbIdentityDetails(8, 'movie', deps);
    await findTmdbIdentityByExternalId('tt123', 'imdb_id', deps);
    expect(deps.executeRateLimited).toHaveBeenCalledTimes(2);
    for (const [, options] of deps.httpGet.mock.calls) expect(options).toMatchObject({ timeout: 10000, maxResponseBytes: 1048576 });
});
