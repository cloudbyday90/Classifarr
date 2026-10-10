/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMediaSyncIdentityRecovery } from '../services/mediaSyncIdentityRecovery.mjs';
import { sourceIdentityRecoveryEvidence } from '../services/sourceIdentityRecoveryEvidence.mjs';

function fixture(patch = {}, candidates = { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [33] }) {
  const item = { external_id: 'source-1', title: 'Fixture', year: 2001, media_type: 'movie',
    provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids',
    provider_identity_field: 'tmdb_id', ...patch };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library-1', candidates);
  return item;
}
function setup(item = fixture(), options = {}) {
  const tmdbService = { findIdentityByExternalId: jest.fn().mockResolvedValue({ movie_results: [{ id: 22 }], tv_results: [{ id: 22 }] }),
    getIdentityAlternativeTitles: jest.fn().mockResolvedValue({ id: 22, titles: [], results: [] }),
    getIdentityDetails: jest.fn().mockResolvedValue({ id: 22, title: 'Fixture', name: 'Fixture', release_date: '2001-01-01', first_air_date: '2001-01-01' }) };
  const service = { getLibraryItemIdentityEvidence: jest.fn().mockResolvedValue(item.source_identity_evidence) };
  const claimAttempt = jest.fn().mockResolvedValue(true);
  const recovery = createMediaSyncIdentityRecovery({ tmdbService, ...options });
  return { tmdbService, service, claimAttempt, recovery,
    run: (extra = {}) => recovery.recover(item, { service, url: 'http://fixture.invalid', apiKey: 'secret', libraryKey: 'library-1', claimAttempt, ...extra }) };
}

test('recovers only the independently proven current candidate and keeps input immutable', async () => {
  const item = fixture(); const before = structuredClone(item); const test = setup(item);
  const result = await test.run();
  expect(result.item).toMatchObject({ tmdb_id: 22, imdb_id: 'tt123', tvdb_id: 33 });
  expect(result.item.provider_identity_invalid).toBeUndefined();
  expect(result.item.source_identity_evidence).toBeUndefined();
  expect(result.receipt).toMatchObject({ source_digest: item.source_identity_evidence.snapshotDigest,
    method: 'external_candidate_agreement', tmdb_id: 22, unresolved_providers: [] });
  expect(JSON.stringify(result.receipt)).not.toMatch(/secret|Fixture|tt123|fixture.invalid/);
  expect(item).toEqual(before);
  expect(test.claimAttempt.mock.invocationCallOrder[0]).toBeLessThan(test.tmdbService.findIdentityByExternalId.mock.invocationCallOrder[0]);
  expect(test.tmdbService.getIdentityDetails.mock.invocationCallOrder[0]).toBeLessThan(test.service.getLibraryItemIdentityEvidence.mock.invocationCallOrder[0]);
});

test('a movie can recover its IMDb-proven TMDb ID without choosing a disputed TVDB ID', async () => {
  const test = setup(fixture({}, { tmdb_id: [22], imdb_id: ['tt123'], tvdb_id: [33, 44] }));
  expect(await test.run()).toMatchObject({ item: { tmdb_id: 22, tvdb_id: null }, receipt: { unresolved_providers: ['tvdb_id'] } });
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledWith('tt123', 'imdb_id');
});

test('retains existing numeric-string normalization for matching provider detail IDs', async () => {
  const test = setup();
  test.tmdbService.getIdentityDetails.mockResolvedValue({ id: '22', title: 'Fixture', release_date: '2001-01-01' });
  expect(await test.run()).toMatchObject({ item: { tmdb_id: 22 } });
});

test('recent persisted proof avoids repeated catalog work but still verifies the current source', async () => {
  const test = setup(); const first = await test.run();
  test.tmdbService.findIdentityByExternalId.mockClear();
  const readReceipt = jest.fn().mockResolvedValue(first.receipt);
  expect(await test.run({ readReceipt })).toEqual({ item: first.item, receipt: first.receipt });
  expect(test.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  expect(test.service.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(2);
  test.service.getLibraryItemIdentityEvidence.mockResolvedValue(null);
  expect(await test.run({ readReceipt })).toBeNull();
});

test.each([
  { verified_at: new Date(Date.now() - 86400001).toISOString() },
  { verified_at: new Date(Date.now() + 86400000).toISOString() },
  { verified_at: 'invalid' }, { source_digest: '0'.repeat(64) }, { tmdb_id: 99 }, { version: 2 },
])('does not trust stale or mismatched receipts: %j', async patch => {
  const test = setup(); const first = await test.run();
  test.tmdbService.findIdentityByExternalId.mockClear();
  expect(await test.run({ readReceipt: async () => ({ ...first.receipt, ...patch }) })).not.toBeNull();
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test('cached recoveries do not consume the budget needed to repair additional items', async () => {
  const test = setup(undefined, { maximumAttempts: 1 }); const first = await test.run();
  expect(await test.run({ readReceipt: async () => first.receipt })).toEqual({ item: first.item, receipt: first.receipt });
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
});

test('TV recovery requires its supplied TVDB and IMDb IDs to agree', async () => {
  const test = setup(fixture({ media_type: 'tv' }));
  expect(await test.run()).toMatchObject({ item: { tmdb_id: 22, media_type: 'tv' } });
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(2);
  test.tmdbService.findIdentityByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 11 }] });
  expect(await test.run()).toBeNull();
});

test('exact catalog alias recovers a TV candidate and reuses only source-checked recent proof', async () => {
  const t = setup(fixture({ media_type: 'tv', title: 'Fixture (US)' }));
  t.tmdbService.getIdentityAlternativeTitles.mockResolvedValue({ id: 22, results: [{ title: 'Fixture (US)' }] });
  const first = await t.run();
  expect(first).toMatchObject({ item: { tmdb_id: 22, title: 'Fixture (US)' } });
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(2);
  expect(t.tmdbService.getIdentityAlternativeTitles.mock.invocationCallOrder[0])
    .toBeLessThan(t.service.getLibraryItemIdentityEvidence.mock.invocationCallOrder[0]);
  expect(await t.run({ readReceipt: async () => first.receipt })).toEqual({ item: first.item, receipt: first.receipt });
  expect(t.tmdbService.getIdentityAlternativeTitles).toHaveBeenCalledTimes(1);
  expect(t.service.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(2);
});

test.each(['source_changed', 'cancelled', 'outage', 'malformed', 'wrong_year', 'cooldown', 'disagreement'])
('alternative-title recovery remains fenced: %s', async scenario => {
  const t = setup(fixture({ media_type: 'tv', title: 'Fixture (US)' }));
  const controller = new AbortController(); const recordOutcome = jest.fn();
  t.tmdbService.getIdentityAlternativeTitles.mockResolvedValue({ id: 22, results: [{ title: 'Fixture (US)' }] });
  if (scenario === 'source_changed') t.service.getLibraryItemIdentityEvidence.mockResolvedValue({ snapshotDigest: 'changed' });
  if (scenario === 'cancelled') t.tmdbService.getIdentityAlternativeTitles.mockImplementation(async () => { controller.abort(); });
  if (scenario === 'outage') t.tmdbService.getIdentityAlternativeTitles.mockRejectedValue(new Error('private provider body'));
  if (scenario === 'malformed') t.tmdbService.getIdentityAlternativeTitles.mockResolvedValue({ id: 99, results: [{ title: 'Fixture (US)' }] });
  if (scenario === 'wrong_year') t.tmdbService.getIdentityDetails.mockResolvedValue({ id: 22, name: 'Fixture', first_air_date: '2002-01-01' });
  if (scenario === 'cooldown') t.claimAttempt.mockResolvedValue(false);
  if (scenario === 'disagreement') t.tmdbService.findIdentityByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 11 }] });
  const pending = t.run({ signal: controller.signal, recordOutcome });
  if (scenario === 'cancelled') {
    await expect(pending).rejects.toThrow(); expect(recordOutcome).not.toHaveBeenCalled();
  } else expect(await pending).toBeNull();
  if (scenario !== 'source_changed') expect(t.service.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
  if (['wrong_year', 'cooldown', 'disagreement'].includes(scenario)) expect(t.tmdbService.getIdentityAlternativeTitles).not.toHaveBeenCalled();
  if (scenario === 'outage') expect(recordOutcome.mock.calls[0][1].reason).toBe('provider_unavailable');
  if (scenario === 'malformed') expect(recordOutcome.mock.calls[0][1].reason).toBe('provider_response_invalid');
  expect(JSON.stringify(recordOutcome.mock.calls)).not.toContain('private provider body');
});

test.each([
  { tmdb_id: [11, 22], imdb_id: ['tt123', 'tt456'], tvdb_id: [33] },
  { tmdb_id: [11, 22], imdb_id: [], tvdb_id: [33] },
  { tmdb_id: [], imdb_id: ['tt123'], tvdb_id: [33] },
])('does not query providers for structurally unprovable candidates: %j', candidates => {
  const test = setup(fixture({}, candidates));
  return test.run().then(result => { expect(result).toBeNull(); expect(test.claimAttempt).not.toHaveBeenCalled(); });
});

test('does not reinterpret disputed TVDB IDs as TV authority', async () => {
  const test = setup(fixture({ media_type: 'tv' }, { tmdb_id: [22], imdb_id: ['tt123'], tvdb_id: [33, 44] }));
  expect(await test.run()).toBeNull(); expect(test.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
});

test.each([{ title: 'Other', name: 'Other' }, { release_date: '2002-01-01' }, { id: 99 },
  { release_date: '2001-99-01' }])('rejects mismatched or malformed catalog details: %j', async patch => {
  const test = setup(); test.tmdbService.getIdentityDetails.mockResolvedValue({ id: 22, title: 'Fixture', release_date: '2001-01-01', ...patch });
  expect(await test.run()).toBeNull(); expect(test.service.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
});

test.each(['provider_failure', 'not_a_candidate', 'source_changed', 'wrong_type', 'cooldown'])('defers safely: %s', async failure => {
  const test = setup();
  if (failure === 'provider_failure') test.tmdbService.findIdentityByExternalId.mockRejectedValue(new Error('private'));
  if (failure === 'not_a_candidate') test.tmdbService.findIdentityByExternalId.mockResolvedValue({ movie_results: [{ id: 99 }] });
  if (failure === 'source_changed') test.service.getLibraryItemIdentityEvidence.mockResolvedValue({ mediaType: 'movie', snapshotDigest: '0'.repeat(64) });
  if (failure === 'wrong_type') test.service.getLibraryItemIdentityEvidence.mockResolvedValue({ ...fixture().source_identity_evidence, mediaType: 'tv' });
  if (failure === 'cooldown') test.claimAttempt.mockResolvedValue(false);
  expect(await test.run()).toBeNull();
});

test('bounds attempts, preserves a captured item during awaits, and rejects invalid budgets', async () => {
  const item = fixture(); const test = setup(item, { maximumAttempts: 1 });
  test.tmdbService.getIdentityDetails.mockImplementation(async () => {
    item.title = 'Changed by caller'; return { id: 22, title: 'Fixture', release_date: '2001-01-01' };
  });
  expect((await test.run()).item.title).toBe('Fixture');
  expect(await test.run()).toBeNull();
  expect(test.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
  for (const maximumAttempts of [0, -1, 33, NaN, '8']) expect(() => createMediaSyncIdentityRecovery({ maximumAttempts })).toThrow();
});

test('digest binds source/library/type/title/year/candidates, is order independent, and rejects malformed arrays', () => {
  const item = fixture(); const ids = item.source_identity_evidence.providerIds;
  const before = item.source_identity_evidence.snapshotDigest;
  expect(sourceIdentityRecoveryEvidence(item, 'library-1', { ...ids, tmdb_id: [22, 11] }).snapshotDigest).toBe(before);
  for (const patch of [{ external_id: 'other' }, { title: 'Other' }, { year: 2002 }, { media_type: 'tv' }]) {
    expect(sourceIdentityRecoveryEvidence({ ...item, ...patch }, 'library-1', ids).snapshotDigest).not.toBe(before);
  }
  expect(sourceIdentityRecoveryEvidence(item, 'other', ids).snapshotDigest).not.toBe(before);
  for (const values of [[22, 22], [0], [NaN], ['22'], [2147483648], new Array(1), new Array(21).fill(22)]) {
    expect(sourceIdentityRecoveryEvidence(item, 'library-1', { ...ids, tmdb_id: values })).toBeNull();
  }
  expect(sourceIdentityRecoveryEvidence({ ...item, year: null }, 'library-1', ids)).toBeNull();
  expect(sourceIdentityRecoveryEvidence(item, '', ids)).toBeNull();
  expect(sourceIdentityRecoveryEvidence(item, 'library-1', { ...ids, url: 'private' })).toBeNull();
});

test.each([
  ['provider_unavailable', test => test.tmdbService.findIdentityByExternalId.mockRejectedValue(new Error('secret URL/token'))],
  ['provider_response_invalid', test => test.tmdbService.findIdentityByExternalId.mockResolvedValue({})],
  ['external_evidence_inconclusive', test => test.tmdbService.findIdentityByExternalId.mockResolvedValue({ movie_results: [] })],
  ['candidate_not_supported', test => test.tmdbService.findIdentityByExternalId.mockResolvedValue({ movie_results: [{ id: 99 }] })],
  ['provider_unavailable', test => test.tmdbService.getIdentityDetails.mockRejectedValue(new Error('secret'))],
  ['provider_response_invalid', test => test.tmdbService.getIdentityDetails.mockResolvedValue(null)],
  ['provider_response_invalid', test => test.tmdbService.getIdentityDetails.mockResolvedValue({ id: 99, title: 'Fixture', release_date: '2001-01-01' })],
  ['provider_response_invalid', test => test.tmdbService.getIdentityDetails.mockResolvedValue({ id: 99, title: 'Other', release_date: '2001-01-01' })],
  ['title_year_mismatch', test => test.tmdbService.getIdentityDetails.mockResolvedValue({ id: 22, title: 'Other', release_date: '2001-01-01' })],
  ['source_unavailable', test => test.service.getLibraryItemIdentityEvidence.mockRejectedValue(new Error('secret'))],
  ['source_unavailable', test => test.service.getLibraryItemIdentityEvidence.mockResolvedValue(null)],
  ['source_changed', test => test.service.getLibraryItemIdentityEvidence.mockResolvedValue({ snapshotDigest: 'changed' })],
])('records bounded %s evidence after a claimed attempt', async (reason, configure) => {
  const test = setup(); const recordOutcome = jest.fn(); configure(test);
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(recordOutcome).toHaveBeenCalledTimes(1);
  expect(recordOutcome.mock.calls[0][1]).toEqual({ reason, attemptId: test.claimAttempt.mock.calls[0][1] });
  expect(recordOutcome.mock.calls[0][1].attemptId).toMatch(/^[a-f0-9-]{36}$/);
  expect(JSON.stringify(recordOutcome.mock.calls[0][1])).not.toMatch(/secret|URL|token/);
});

test('records TV identity disagreement without choosing either ID', async () => {
  const test = setup(fixture({ media_type: 'tv' })); const recordOutcome = jest.fn();
  test.tmdbService.findIdentityByExternalId.mockResolvedValueOnce({ tv_results: [{ id: 11 }] });
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(recordOutcome.mock.calls[0][1].reason).toBe('external_ids_disagree');
});

test('preflight outcomes do not claim provider attempts', async () => {
  const test = setup(fixture({}, { tmdb_id: [11, 22], imdb_id: [], tvdb_id: [] }));
  const recordOutcome = jest.fn();
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(recordOutcome.mock.calls[0][1]).toEqual({ reason: 'insufficient_evidence', attemptId: null });
  expect(test.claimAttempt).not.toHaveBeenCalled();
  await test.run({ recordOutcome, service: {} });
  expect(recordOutcome.mock.calls[1][1]).toEqual({ reason: 'adapter_unsupported', attemptId: null });
});

test('cooldown and budget skips preserve earlier outcomes; observers cannot break sync', async () => {
  const test = setup(undefined, { maximumAttempts: 1 }); const recordOutcome = jest.fn();
  test.claimAttempt.mockResolvedValueOnce(false);
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(recordOutcome).not.toHaveBeenCalled();
  test.tmdbService.getIdentityDetails.mockRejectedValue(new Error('private'));
  recordOutcome.mockRejectedValue(new Error('diagnostic failure'));
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(await test.run({ recordOutcome })).toBeNull();
  expect(recordOutcome).toHaveBeenCalledTimes(1);
});

test('local receipt failures are not diagnosed as provider outages', async () => {
  const test = setup(); const recordOutcome = jest.fn();
  expect(await test.run({ recordOutcome, readReceipt: async () => { throw new Error('db secret'); } })).toBeNull();
  expect(recordOutcome.mock.calls[0][1]).toEqual({ reason: 'internal_error', attemptId: null });
});

test.each(['before', 'receipt', 'claim', 'find', 'details', 'source'])
('owner cancellation at %s propagates without recording a provider failure', async stage => {
  const t = setup(); const controller = new AbortController();
  const failure = new Error('synthetic owner lost'); const recordOutcome = jest.fn();
  const cancel = () => controller.abort(failure);
  const readReceipt = jest.fn(async () => { if (stage === 'receipt') cancel(); return null; });
  if (stage === 'before') cancel();
  if (stage === 'claim') t.claimAttempt.mockImplementation(async () => { cancel(); return true; });
  if (stage === 'find') t.tmdbService.findIdentityByExternalId.mockImplementation(async () => {
    cancel(); return { movie_results: [{ id: 22 }] };
  });
  if (stage === 'details') t.tmdbService.getIdentityDetails.mockImplementation(async () => {
    cancel(); return { id: 22, title: 'Fixture', release_date: '2001-01-01' };
  });
  if (stage === 'source') t.service.getLibraryItemIdentityEvidence.mockImplementation(async () => {
    cancel(); return fixture().source_identity_evidence;
  });
  await expect(t.run({ signal: controller.signal, readReceipt, recordOutcome })).rejects.toBe(failure);
  expect(recordOutcome).not.toHaveBeenCalled();
  if (stage === 'before') expect(readReceipt).not.toHaveBeenCalled();
  if (['before', 'receipt'].includes(stage)) expect(t.claimAttempt).not.toHaveBeenCalled();
  if (['before', 'receipt', 'claim'].includes(stage)) expect(t.tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  if (stage !== 'source') expect(t.service.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
});

test('cached source verification cancellation is not converted to a recovery outcome', async () => {
  const t = setup(); const first = await t.run(); const recordOutcome = jest.fn();
  const controller = new AbortController(); const failure = new Error('owner lost');
  t.service.getLibraryItemIdentityEvidence.mockImplementation(async (_u, _k, _l, _i, { signal }) => {
    expect(signal).toBe(controller.signal); controller.abort(failure); throw new Error('transport cancelled');
  });
  await expect(t.run({ signal: controller.signal, readReceipt: async () => first.receipt, recordOutcome })).rejects.toBe(failure);
  expect(recordOutcome).not.toHaveBeenCalled();
});

test('TV cancellation between external-ID reads prevents the second provider request', async () => {
  const t = setup(fixture({ media_type: 'tv' })); const controller = new AbortController();
  t.tmdbService.findIdentityByExternalId.mockImplementation(async (_id, _type, { signal }) => {
    expect(signal).toBe(controller.signal); controller.abort(); return { tv_results: [{ id: 22 }] };
  });
  await expect(t.run({ signal: controller.signal })).rejects.toThrow();
  expect(t.tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
  expect(t.tmdbService.getIdentityDetails).not.toHaveBeenCalled();
});
