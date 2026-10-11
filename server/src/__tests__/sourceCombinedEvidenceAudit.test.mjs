/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { readCombinedEvidenceAudit } from '../services/sourceCombinedEvidenceAudit.mjs';

function fixture() {
  return { source: { identity: { mediaType: 'tv', snapshotDigest: 'a'.repeat(64),
    providerIds: { tmdb_id: [10], imdb_id: [], tvdb_id: [20, 30] } } },
  scope: { kind: 'whole_work', tmdbId: 10 }, plan: { works: [10] },
  comparison: { total: 2, matched: 2, exclusions: [] }, signal: new AbortController().signal,
  provider: { findIdentityByExternalId: jest.fn(async () => ({ movie_results: [], tv_results: [{ id: 10 }],
    tv_season_results: [], tv_episode_results: [], person_results: [] })),
  getIdentityDetails: jest.fn(async () => ({ id: 10, name: 'Fixture', title: 'Fixture' })) } };
}
test('agreement plus full membership remains diagnostics, not independent proof or permission', async () => {
  const result = await readCombinedEvidenceAudit(fixture());
  expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(result.report).toEqual({ version: 'source_combined_evidence.v1', status: 'catalog_and_scope_agreement',
    parentBlockers: [], candidateTmdbId: 10, scopeComplete: true, proposalMatchesIdentity: true,
    crossProviderVerified: false, automaticRecoveryEligible: false });
});
test.each(['empty', 'excluded', 'partial', 'grouped', 'wrong-work', 'no-match', 'unsupported', 'missing-declaration'])('abstains for %s', async mode => {
  const f = fixture();
  if (mode === 'empty') f.comparison = { total: 0, matched: 0, exclusions: [] };
  if (mode === 'excluded') f.comparison = { total: 2, matched: 1, exclusions: [{ reason: 'missing_tmdb_episode_id' }] };
  if (mode === 'partial') f.scope = { kind: 'seasons', coverage: 'partial' };
  if (mode === 'grouped') f.plan.works = [10, 11];
  if (mode === 'wrong-work') f.plan.works = [11];
  if (mode === 'no-match') f.provider.findIdentityByExternalId.mockResolvedValue({ movie_results: [], tv_results: [], tv_season_results: [], tv_episode_results: [], person_results: [] });
  if (mode === 'unsupported') f.source.identity.mediaType = 'movie';
  if (mode === 'missing-declaration') f.source.identity.providerIds.tmdb_id = [];
  expect((await readCombinedEvidenceAudit(f)).report).toMatchObject({ status: 'review_required', automaticRecoveryEligible: false });
});
test('complete season proposal can agree without changing grouping', async () => {
  const f = fixture(); f.scope = { kind: 'seasons', coverage: 'complete' };
  expect((await readCombinedEvidenceAudit(f)).report.status).toBe('catalog_and_scope_agreement');
});
