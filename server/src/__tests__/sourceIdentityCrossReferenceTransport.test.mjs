/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { httpGet } from '../utils/httpClient.mjs';
import { findTmdbIdentityByExternalId } from '../services/tmdbIdentitySearch.mjs';
import { createSourceIdentityCrossReferenceDiagnosis } from '../services/sourceIdentityCrossReferenceDiagnosis.mjs';
import { createIdentityHttpFixture, withinIdentityTestDeadline } from './helpers/identityHttpFixture.mjs';

const row = { library_id: 1, media_type: 'tv', provider_fields: ['tmdb_id'], external_id: 'fixture',
  library_external_id: 'fixture-library', media_server_type: 'plex', url: 'http://fixture.invalid', api_key: 'synthetic' };
const evidence = { mediaType: 'tv', snapshotDigest: 'a'.repeat(64),
  providerIds: { tmdb_id: [8, 9], imdb_id: ['tt8'], tvdb_id: [] } };

function setup(fixture) {
  const deps = { baseUrl: fixture.url, httpGet, getApiKey: async () => 'synthetic', executeRateLimited: fn => fn() };
  const source = { getLibraryItemIdentityEvidence: jest.fn().mockResolvedValue(evidence) };
  const replay = createSourceIdentityCrossReferenceDiagnosis({ readRows: async () => [row],
    getMediaServerService: () => source,
    tmdbService: { findIdentityByExternalId: (id, type, options) => findTmdbIdentityByExternalId(id, type, deps, options) } });
  return { replay, source };
}

test.each([
  [{ tv_results: [{ id: 8 }] }, 'all_agree_current_candidate'],
  [{ tv_results: [], tv_episode_results: [{ id: 99 }] }, 'no_typed_matches'],
  [{ private: 'secret'.repeat(200000) }, 'provider_unavailable'],
  [{ tv_results: 'invalid' }, 'provider_review_required'],
])('real compressed HTTP stays bounded and typed', async (body, outcome) => {
  const fixture = await createIdentityHttpFixture(body);
  try {
    const { replay } = setup(fixture);
    const result = await withinIdentityTestDeadline(replay.replay());
    expect(result.summary.outcomes).toEqual({ [outcome]: 1 });
    expect(fixture.requests).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|synthetic|tt8/u);
  } finally { await fixture.close(); }
});

test('cancellation aborts a real in-flight response and prevents fresh-source reads', async () => {
  const fixture = await createIdentityHttpFixture();
  try {
    const { replay, source } = setup(fixture);
    const controller = new AbortController();
    const pending = replay.replay({ signal: controller.signal });
    await withinIdentityTestDeadline(fixture.received);
    controller.abort(new Error('synthetic private cancellation'));
    const result = await withinIdentityTestDeadline(pending);
    await withinIdentityTestDeadline(fixture.disconnected);
    expect(result.status.id).toBe('cancelled');
    expect(result.summary.inspectedObservations).toBe(0);
    expect(source.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(1);
    expect(fixture.requests).toBe(1);
  } finally { await fixture.close(); }
});
