/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { auditSourceIdentityAgreement } from '../services/sourceIdentityAgreementAudit.mjs';
import { readSourceCandidates } from '../services/sourceCandidateProjection.mjs';

const source = (mediaType = 'tv') => ({ mediaType, snapshotDigest: 'a'.repeat(64),
  providerIds: { tmdb_id: [10], imdb_id: ['tt123'], tvdb_id: mediaType === 'tv' ? [20, 30] : [] } });
const matches = (mediaType, ids = [10]) => ({ movie_results: [], tv_results: [], tv_season_results: [], tv_episode_results: [], person_results: [],
  [mediaType === 'tv' ? 'tv_results' : 'movie_results']: ids.map(id => ({ id })) });
const inspect = async (s, overrides = {}) => auditSourceIdentityAgreement(await readSourceCandidates(s, {
  findIdentityByExternalId: async () => matches(s.mediaType),
  getIdentityDetails: async id => ({ id, ...(s.mediaType === 'tv' ? { name: 'Fixture' } : { title: 'Fixture' }) }),
  ...overrides,
}, new AbortController().signal));

test.each(['tv', 'movie'])('all declared IDs agree in the catalog, not a recovery permission: %s', async type => {
  expect(await inspect(source(type))).toEqual({ version: 'source_identity_agreement.v1', basis: 'tmdb_parent_lookups',
    status: 'catalog_agreement', candidateTmdbId: 10, blockers: [], completeScopeVerified: false, automaticRecoveryEligible: false });
});
test.each([
  ['no_declared_candidate', s => { s.providerIds.tmdb_id = []; }, {}],
  ['no_external_confirmation', s => { s.providerIds.imdb_id = []; s.providerIds.tvdb_id = []; }, {}],
  ['multiple_candidates', s => { s.providerIds.tmdb_id = [10, 11]; }, {}],
  ['missing_catalog_match', () => {}, { findIdentityByExternalId: async () => matches('tv', []) }],
  ['unsupported_identifier', s => { s.mediaType = 'movie'; }, {}],
  ['other_scope_match', () => {}, { findIdentityByExternalId: async () => ({ ...matches('tv'), tv_episode_results: [{ id: 99 }] }) }],
  ['ambiguous_lookup', () => {}, { findIdentityByExternalId: async () => matches('tv', [10, 11]) }],
  ['candidate_unavailable', () => {}, { getIdentityDetails: async () => { throw Object.assign(new Error('fixture'), { status: 404 }); } }],
])('retains the %s blocker and never chooses a winner', async (code, change, provider) => {
  const s = source(); change(s); const result = await inspect(s, provider);
  expect(result).toMatchObject({ status: 'review_required', candidateTmdbId: null,
    completeScopeVerified: false, automaticRecoveryEligible: false });
  expect(result.blockers).toContain(code);
});
test('one missing declaration defeats agreement by all the others', async () => {
  const result = await inspect(source(), { findIdentityByExternalId: async id => matches('tv', id === 30 ? [] : [10]) });
  expect(result.blockers).toEqual(['missing_catalog_match']);
  expect(result.status).toBe('review_required');
});
test('direct declarations cannot be outvoted by external agreement', async () => {
  const s = source(); s.providerIds.tmdb_id = [10, 11];
  expect((await inspect(s)).blockers).toEqual(['multiple_candidates']);
});
test('empty evidence is not agreement', async () => {
  const s = source(); s.providerIds = { tmdb_id: [], imdb_id: [], tvdb_id: [] };
  expect(await inspect(s)).toMatchObject({ status: 'review_required', blockers: ['no_declared_candidate', 'no_external_confirmation'] });
});
test('captures multiple blockers without duplicates or mutating its input', async () => {
  const found = await readSourceCandidates(source(), {
    findIdentityByExternalId: async id => matches('tv', id === 30 ? [] : [10, 11]),
    getIdentityDetails: async () => { throw Object.assign(new Error('fixture'), { status: 404 }); },
  }, new AbortController().signal);
  const before = structuredClone(found), result = auditSourceIdentityAgreement(found);
  expect(result.blockers).toEqual(['multiple_candidates', 'missing_catalog_match', 'ambiguous_lookup', 'candidate_unavailable']);
  expect(found).toEqual(before);
});
