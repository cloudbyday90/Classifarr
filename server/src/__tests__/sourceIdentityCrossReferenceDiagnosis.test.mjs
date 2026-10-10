/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, jest } from '@jest/globals';
import { createSourceIdentityCrossReferenceDiagnosis, SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS } from '../services/sourceIdentityCrossReferenceDiagnosis.mjs';
import { copyCrossReferenceEvidence, inspectCrossReferenceResponse } from '../services/sourceIdentityCrossReferenceEvidence.mjs';
import { runSourceIdentityExternalEvidenceReplay } from '../scripts/runSourceIdentityExternalEvidenceReplay.mjs';

const row = { library_id: 1, provider_fields: ['tvdb_id'], media_type: 'tv', external_id: 'private-item',
  library_external_id: 'private-library', media_server_type: 'plex', url: 'http://private-source', api_key: 'private-secret' };
const evidence = { mediaType: 'tv', snapshotDigest: 'a'.repeat(64),
  providerIds: { tmdb_id: [10], imdb_id: ['tt00010'], tvdb_id: [20, 21] } };
const response = (...ids) => ({ tv_results: ids.map(id => ({ id })) });

function setup({ rows = [row], sourceEvidence = evidence, responses = [response(10), response(10), response()] } = {}) {
  const readRows = jest.fn().mockResolvedValue(rows);
  const source = { getLibraryItemIdentityEvidence: jest.fn().mockResolvedValue(sourceEvidence) };
  const getMediaServerService = jest.fn().mockReturnValue(source);
  const tmdbService = { findIdentityByExternalId: jest.fn() };
  for (const data of responses) tmdbService.findIdentityByExternalId.mockResolvedValueOnce(data);
  const replay = createSourceIdentityCrossReferenceDiagnosis({ readRows, getMediaServerService, tmdbService });
  return { readRows, source, getMediaServerService, tmdbService, replay };
}
afterEach(() => jest.restoreAllMocks());

test('separates missing mappings from contradictions; never outputs private evidence', async () => {
  const t = setup({ responses: [response(10), response(10), { ...response(), tv_episode_results: [{ id: 99 }] }] });
  const result = await t.replay.replay();
  expect(result).toMatchObject({ status: { id: 'complete' }, summary: { selectedObservations: 1, inspectedObservations: 1,
    outcomes: { agreement_with_missing_mappings: 1 }, stableEvidenceLookups: {
      lookups: 3, matched: 2, notFound: 1, reviewRequired: 0, lookupsWithOtherMediaResults: 1,
    } } });
  expect(result.reference).toMatch(/^[a-f0-9-]{36}$/u);
  expect(JSON.stringify(result)).not.toMatch(/private|tt00010|snapshotDigest/u);
  expect(t.readRows).toHaveBeenCalledWith(SOURCE_IDENTITY_CROSS_REFERENCE_LIMITS);
  expect(t.tmdbService.findIdentityByExternalId.mock.calls.map(args => args.slice(0, 2)))
    .toEqual([['tt00010', 'imdb_id'], [20, 'tvdb_id'], [21, 'tvdb_id']]);
  expect(t.source.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(2);
  expect(t.tmdbService.findIdentityByExternalId.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
});

test.each([
  [[response(10), response(10), response(10)], 'all_agree_current_candidate'],
  [[response(10), response(11), response()], 'conflicting_matches'],
  [[response(), response(), response()], 'no_typed_matches'],
  [[response(11), response(11), response()], 'matches_outside_source_candidates'],
  [[response(10), { tv_results: null }, response()], 'provider_review_required'],
  [[response(10), response(10, 11), response()], 'provider_review_required'],
])('classifies every lookup without silently discarding evidence', async (responses, outcome) => {
  expect((await setup({ responses }).replay.replay()).summary.outcomes).toEqual({ [outcome]: 1 });
});

test.each([
  { ...evidence, snapshotDigest: 'b'.repeat(64) },
  { ...evidence, mediaType: 'movie' },
  { ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: [20, 22] } },
  null,
])('discards all catalog findings when fresh source evidence changes', async fresh => {
  const t = setup();
  t.source.getLibraryItemIdentityEvidence.mockReset().mockResolvedValueOnce(evidence).mockResolvedValueOnce(fresh);
  const result = await t.replay.replay();
  expect(result.summary.outcomes).toEqual({ source_changed: 1 });
  expect(result.summary.stableEvidenceLookups.lookups).toBe(0);
});

test('candidate order changes do not change the meaning of a snapshot', async () => {
  const t = setup();
  t.source.getLibraryItemIdentityEvidence.mockReset().mockResolvedValueOnce(evidence)
    .mockResolvedValueOnce({ ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: [21, 20] } });
  expect((await t.replay.replay()).summary.outcomes).toEqual({ agreement_with_missing_mappings: 1 });
});

test.each([
  [{ ...evidence, snapshotDigest: undefined }, 'source_evidence_invalid'],
  [{ ...evidence, mediaType: 'movie' }, 'source_media_type_changed'],
  [{ ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: [20] } }, 'source_conflict_no_longer_present'],
  [{ ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: [20, 21, 22, 23] } }, 'lookup_budget_exceeded'],
  [{ ...evidence, providerIds: { ...evidence.providerIds, tmdb_id: [] } }, 'no_tmdb_candidate'],
])('rejects inadmissible evidence before any catalog lookup', async (sourceEvidence, outcome) => {
  const t = setup({ sourceEvidence });
  expect((await t.replay.replay()).summary.outcomes).toEqual({ [outcome]: 1 });
  expect(t.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
});

test.each([null, {}, { ...evidence, providerIds: { ...evidence.providerIds, extra: [] } },
  { ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: ['20'] } },
  { ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: [20, 20] } },
  { ...evidence, providerIds: { ...evidence.providerIds, tmdb_id: [2147483648] } },
  { ...evidence, providerIds: { ...evidence.providerIds, imdb_id: ['not-an-id'] } },
  { ...evidence, providerIds: { ...evidence.providerIds, tvdb_id: Array(21).fill(20) } },
])('does not normalize malformed evidence into a usable candidate set', value => {
  expect(copyCrossReferenceEvidence(value)).toBeNull();
});

test.each([null, 'invalid', [null], [{ id: -1 }], Array(21).fill({ id: 1 })])
('does not accept malformed or excessive unrelated buckets', bucket => {
  expect(inspectCrossReferenceResponse('tv', { ...response(10), tv_season_results: bucket }).status).toBe('review_required');
});

test('movie evidence uses the movie bucket and does not query unsupported TVDB movie IDs', async () => {
  const t = setup({ rows: [{ ...row, media_type: 'movie', provider_fields: ['tmdb_id'] }],
    sourceEvidence: { ...evidence, mediaType: 'movie', providerIds: { ...evidence.providerIds, tmdb_id: [10, 11] } },
    responses: [{ movie_results: [{ id: 10 }], tv_results: [{ id: 99 }] }] });
  expect((await t.replay.replay()).summary.outcomes).toEqual({ all_agree_current_candidate: 1 });
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test.each([[], [{ library_id: null }]].map(rows => [rows]))('an empty installation makes no provider calls', async rows => {
  const t = setup({ rows });
  expect((await t.replay.replay()).status.id).toBe('no_current_conflicts');
  expect(t.getMediaServerService).not.toHaveBeenCalled();
});

test.each([null, Array(13).fill(row), Array(5).fill(row), [{}], [{ ...row, library_id: -1 }]].map(rows => [rows]))
('fails closed on an invalid or oversized database window', async rows => {
  const t = setup({ rows });
  expect((await t.replay.replay()).status.id).toBe('failed');
  expect(t.getMediaServerService).not.toHaveBeenCalled();
});

test('sanitizes provider errors without misclassifying them as absent mappings', async () => {
  const t = setup();
  t.tmdbService.findIdentityByExternalId.mockReset().mockRejectedValue(new Error('private-secret'));
  const result = await t.replay.replay();
  expect(result.summary.outcomes).toEqual({ provider_unavailable: 1 });
  expect(JSON.stringify(result)).not.toContain('private-secret');
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test('cancellation preserves partial progress and does not start another item', async () => {
  const controller = new AbortController();
  const t = setup({ rows: [row, { ...row, external_id: 'next' }] });
  t.source.getLibraryItemIdentityEvidence.mockReset().mockResolvedValueOnce(evidence).mockResolvedValueOnce(evidence)
    .mockImplementationOnce(async () => { controller.abort(new Error('private-secret')); return evidence; });
  const result = await t.replay.replay({ signal: controller.signal });
  expect(result).toMatchObject({ status: { id: 'cancelled' }, summary: { selectedObservations: 2, inspectedObservations: 1 } });
  expect(JSON.stringify(result)).not.toContain('private-secret');
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(3);
});

test('an expired invocation deadline is distinct from operator cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  const t = setup();
  expect((await t.replay.replay()).status.id).toBe('timed_out');
  expect(t.readRows).not.toHaveBeenCalled();
});

test.each([[], ['--cross-references']].map(argv => [argv]))('CLI keeps default behavior and opts into diagnostics explicitly', async argv => {
  const runtime = { replay: { replay: jest.fn().mockResolvedValue({ status: { id: 'complete' } }) }, close: jest.fn() };
  const loadRuntime = jest.fn().mockResolvedValue(runtime);
  await runSourceIdentityExternalEvidenceReplay({ argv, loadRuntime });
  expect(loadRuntime.mock.calls).toEqual(argv.length ? [[{ crossReferences: true }]] : [[]]);
  expect(runtime.close).toHaveBeenCalledTimes(1);
});

test('CLI rejects unknown/repeated flags and always closes an opened runtime', async () => {
  const loadRuntime = jest.fn();
  for (const argv of [['--write'], ['--cross-references', '--cross-references'], null]) {
    await expect(runSourceIdentityExternalEvidenceReplay({ argv, loadRuntime })).rejects.toThrow('invalid_arguments');
  }
  expect(loadRuntime).not.toHaveBeenCalled();
  const close = jest.fn();
  loadRuntime.mockResolvedValue({ replay: { replay: async () => { throw new Error('fixture'); } }, close });
  await expect(runSourceIdentityExternalEvidenceReplay({ argv: ['--cross-references'], loadRuntime })).rejects.toThrow('fixture');
  expect(close).toHaveBeenCalledTimes(1);
});
