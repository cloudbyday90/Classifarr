/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createSourceCatalogPreview } from '../services/sourceCatalogPreview.mjs';
import { runSourceIdentityExternalEvidenceReplay } from '../scripts/runSourceIdentityExternalEvidenceReplay.mjs';

const row = { library_id: 1, media_server_id: 2, external_id: 'private-item', media_type: 'tv',
  library_external_id: 'private-library', media_server_type: 'plex', url: 'http://private', api_key: 'private-key' };
const layout = { identity: { mediaType: 'tv', providerIds: { tmdb_id: [10] } }, digest: 'a'.repeat(64),
  episodeCount: 2, seasons: [{ number: 1, episodes: [1, 2] }] };
const details = { id: 10, name: 'private-title', seasons: [{ id: 11, season_number: 1, episode_count: 2 }] };
function setup(rows = [row]) {
  const readRows = jest.fn().mockResolvedValue(rows);
  const adapter = { getLibraryItemLayout: jest.fn().mockResolvedValue(layout) };
  const getMediaServerService = jest.fn().mockReturnValue(adapter);
  const tmdbService = { getIdentityDetails: jest.fn().mockResolvedValue(details) };
  return { readRows, adapter, getMediaServerService, tmdbService,
    replay: createSourceCatalogPreview({ readRows, getMediaServerService, tmdbService }) };
}

test('only aggregate stable evidence escapes the read-only preview', async () => {
  const t = setup();
  const result = await t.replay.replay();
  expect(result).toMatchObject({ version: 'source_catalog_preview.v1', status: { id: 'complete' },
    canApply: false, verification: 'layout_only', orderVerified: false, summary: {
      selectedObservations: 1, inspectedObservations: 1, sourceSeasons: 1, sourceEpisodes: 2,
      catalogCandidates: 1, outcomes: { layout_inspected: 1 }, comparisons: { same_numbering_counts: 1 } } });
  expect(JSON.stringify(result)).not.toMatch(/private|digest|tmdb_id/u);
  expect(t.readRows).toHaveBeenCalledTimes(2);
  expect(t.adapter.getLibraryItemLayout).toHaveBeenCalledTimes(2);
  expect(t.tmdbService.getIdentityDetails).toHaveBeenCalledWith(10, 'tv', { signal: expect.any(AbortSignal) });
});

test.each([[], [{ library_id: null }]].map(rows => [rows]))('fresh/empty setups do no provider work', async rows => {
  const t = setup(rows);
  expect((await t.replay.replay()).status.id).toBe('no_current_conflicts');
  expect(t.readRows).toHaveBeenCalledTimes(1);
  expect(t.getMediaServerService).not.toHaveBeenCalled();
});

test.each([
  [row, row], [{ ...row, media_type: 'episode' }], [{ ...row, media_server_id: null }],
  [{ ...row, api_key: '' }], Array.from({ length: 5 }, (_, i) => ({ ...row, external_id: String(i) })),
  Array.from({ length: 13 }, (_, i) => ({ ...row, library_id: i + 1 })),
].map(rows => [rows]))('rejects invalid selection without HTTP', async rows => {
  const t = setup(rows);
  expect((await t.replay.replay()).status.id).toBe('failed');
  expect(t.getMediaServerService).not.toHaveBeenCalled();
});

test.each([
  [{ ...layout, identity: { mediaType: 'movie' } }, 'source_type_changed'],
  [{ ...layout, identity: { mediaType: 'tv', providerIds: { tmdb_id: [] } } }, 'no_tmdb_candidate'],
  [{ ...layout, identity: { mediaType: 'tv', providerIds: { tmdb_id: [1, 2, 3, 4, 5] } } }, 'candidate_limit'],
])('refuses changed type or unsupported candidate scope', async (source, outcome) => {
  const t = setup();
  t.adapter.getLibraryItemLayout.mockResolvedValue(source);
  expect((await t.replay.replay()).summary.outcomes).toEqual({ [outcome]: 1 });
  expect(t.tmdbService.getIdentityDetails).not.toHaveBeenCalled();
});

test.each(['source_layout_invalid', 'private secret failure'])('sanitizes source errors', async message => {
  const t = setup();
  t.adapter.getLibraryItemLayout.mockRejectedValue(new Error(message));
  const result = await t.replay.replay();
  expect(result.summary.outcomes).toEqual({ [message === 'source_layout_invalid' ? 'source_layout_invalid' : 'source_unavailable']: 1 });
  expect(JSON.stringify(result)).not.toContain('private');
});

test('rejects unavailable adapter and catalog', async () => {
  const t = setup();
  t.getMediaServerService.mockImplementation(() => { throw new Error('private'); });
  expect((await t.replay.replay()).summary.outcomes).toEqual({ source_adapter_unavailable: 1 });
  t.getMediaServerService.mockReturnValue(t.adapter);
  t.tmdbService.getIdentityDetails.mockRejectedValue(new Error('private'));
  expect((await t.replay.replay()).summary.outcomes).toEqual({ catalog_unavailable: 1 });
});

test.each(['drift', 'unavailable'])('discards comparisons after failed source recheck: %s', async mode => {
  const t = setup();
  t.adapter.getLibraryItemLayout.mockReset().mockResolvedValueOnce(layout);
  if (mode === 'drift') t.adapter.getLibraryItemLayout.mockResolvedValueOnce({ ...layout, digest: 'b'.repeat(64) });
  else t.adapter.getLibraryItemLayout.mockRejectedValueOnce(new Error('private'));
  const result = await t.replay.replay();
  expect(result.summary.outcomes).toEqual({ [mode === 'drift' ? 'source_changed' : 'source_recheck_unavailable']: 1 });
  expect(result.summary.catalogCandidates).toBe(0);
  expect(result.summary.comparisons).toEqual({});
});

test('discards summary on configuration/selection drift or database failure', async () => {
  const t = setup();
  t.readRows.mockReset().mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, api_key: 'changed' }]);
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'selection_changed' }, summary: null });
  t.readRows.mockRejectedValue(new Error('private SQL'));
  expect(await t.replay.replay()).toMatchObject({ status: { id: 'failed' }, summary: null });
});

test('cancellation during catalog read discards partial results and stops source reread', async () => {
  const t = setup(), controller = new AbortController();
  t.tmdbService.getIdentityDetails.mockImplementation(async () => { controller.abort(); return details; });
  expect(await t.replay.replay({ signal: controller.signal })).toMatchObject({ status: { id: 'cancelled' }, summary: null });
  expect(t.adapter.getLibraryItemLayout).toHaveBeenCalledTimes(1);
});

test('deadline expiration makes no calls and returns no partial summary', async () => {
  const timer = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort());
  try {
    const t = setup();
    expect(await t.replay.replay()).toMatchObject({ status: { id: 'timed_out' }, summary: null });
    expect(t.readRows).not.toHaveBeenCalled();
  } finally { timer.mockRestore(); }
});

test('independent candidate namespaces and multiple libraries are retained without deducing mappings', async () => {
  const t = setup([row, { ...row, library_id: 99, external_id: 'other' }]);
  t.adapter.getLibraryItemLayout.mockResolvedValue({ ...layout,
    identity: { ...layout.identity, providerIds: { tmdb_id: [10, 20] } } });
  t.tmdbService.getIdentityDetails.mockImplementation(async id => ({ ...details, id }));
  const result = await t.replay.replay();
  expect(result.summary.catalogCandidates).toBe(4);
  expect(result.summary.comparisons).toEqual({ same_numbering_counts: 4 });
  expect(result.canApply).toBe(false);
});

test('CLI admits only an explicit single preview flag and always closes runtime', async () => {
  const runtime = { replay: { replay: jest.fn().mockResolvedValue({ status: { id: 'complete' } }) }, close: jest.fn() };
  const loadRuntime = jest.fn().mockResolvedValue(runtime);
  await runSourceIdentityExternalEvidenceReplay({ argv: ['--scope-preview'], loadRuntime });
  expect(loadRuntime).toHaveBeenCalledWith({ scopePreview: true });
  expect(runtime.close).toHaveBeenCalledTimes(1);
  await expect(runSourceIdentityExternalEvidenceReplay({ argv: ['--scope-preview', '--apply'], loadRuntime })).rejects.toThrow();
});
