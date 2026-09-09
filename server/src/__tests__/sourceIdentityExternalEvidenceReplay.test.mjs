/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import {
  createSourceIdentityExternalEvidenceReplay,
  SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
} from '../services/sourceIdentityExternalEvidenceReplay.mjs';

const row = Object.freeze({
  library_id: 10,
  media_server_id: 2,
  external_id: 'source-item',
  media_type: 'tv',
  provider_fields: ['tmdb_id'],
  library_external_id: 'source-library',
  media_server_type: 'plex',
  url: 'http://private-source',
  api_key: 'private-key',
});

function response(...ids) {
  return { tv_results: ids.map((id) => ({ id })) };
}

function setup({ rows = [row], evidence, findIdentityByExternalId } = {}) {
  const query = jest.fn().mockResolvedValue({ rows });
  const source = { getLibraryItemIdentityEvidence: jest.fn().mockResolvedValue(evidence) };
  const getMediaServerService = jest.fn().mockReturnValue(source);
  const tmdbService = { findIdentityByExternalId: jest.fn(findIdentityByExternalId) };
  const replay = createSourceIdentityExternalEvidenceReplay({ query, getMediaServerService, tmdbService });
  return { query, source, getMediaServerService, tmdbService, replay };
}

describe('source identity external-evidence replay', () => {
  test('reports exact candidate agreement in aggregate without persisting or exposing source evidence', async () => {
    const { replay, query, source, tmdbService } = setup({
      evidence: { mediaType: 'tv', providerIds: { tmdb_id: [10, 11], imdb_id: ['tt0000010'], tvdb_id: [] } },
      findIdentityByExternalId: () => response(11),
    });

    const result = await replay.replay();

    expect(query).toHaveBeenCalledWith(expect.stringContaining("o.identity_issue='conflicting_provider_ids'"), [8, 32, 30]);
    expect(source.getLibraryItemIdentityEvidence).toHaveBeenCalledWith(
      'http://private-source', 'private-key', 'source-library', 'source-item',
    );
    expect(tmdbService.findIdentityByExternalId).toHaveBeenCalledWith('tt0000010', 'imdb_id');
    expect(result).toEqual({
      version: SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
      status: { id: 'complete' },
      summary: {
        selectedObservationCount: 1,
        maximumObservations: 32,
        maximumObservationsPerLibrary: 8,
        outcomes: { exact_candidate_agreement: 1 },
        resolutionReasons: { external_id_match: 1 },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(JSON.stringify(result)).not.toContain('tt0000010');
  });

  test('does not turn a source conflict into an automatic decision when TMDb resolves outside the current candidate set', async () => {
    const { replay, tmdbService } = setup({
      evidence: { mediaType: 'tv', providerIds: { tmdb_id: [10, 11], imdb_id: ['tt0000010'], tvdb_id: [] } },
      findIdentityByExternalId: () => response(12),
    });

    await expect(replay.replay()).resolves.toMatchObject({
      status: { id: 'complete' },
      summary: { outcomes: { resolved_not_current_candidate: 1 }, resolutionReasons: { external_id_match: 1 } },
    });
    expect(tmdbService.findIdentityByExternalId).toHaveBeenCalledTimes(1);
  });

  test('treats a repaired source item as a separate review condition and avoids TMDb', async () => {
    const { replay, tmdbService } = setup({
      evidence: { mediaType: 'tv', providerIds: { tmdb_id: [10], imdb_id: ['tt0000010'], tvdb_id: [] } },
    });

    await expect(replay.replay()).resolves.toMatchObject({
      summary: { outcomes: { source_conflict_no_longer_present: 1 }, resolutionReasons: {} },
    });
    expect(tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  });

  test('keeps conflicting independent evidence review-only without making a provider request', async () => {
    const { replay, tmdbService } = setup({
      evidence: { mediaType: 'tv', providerIds: { tmdb_id: [10, 11], imdb_id: ['tt0000010', 'tt0000011'], tvdb_id: [] } },
    });

    await expect(replay.replay()).resolves.toMatchObject({
      summary: { outcomes: { external_evidence_conflicting: 1 }, resolutionReasons: {} },
    });
    expect(tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  });

  test('returns a non-error empty result when no current complete capture qualifies', async () => {
    const { replay, source, tmdbService } = setup({ rows: [] });

    await expect(replay.replay()).resolves.toEqual({
      version: SOURCE_IDENTITY_EVIDENCE_REPLAY_VERSION,
      status: { id: 'no_current_conflicts' },
      summary: {
        selectedObservationCount: 0,
        maximumObservations: 32,
        maximumObservationsPerLibrary: 8,
        outcomes: {},
        resolutionReasons: {},
      },
    });
    expect(source.getLibraryItemIdentityEvidence).not.toHaveBeenCalled();
    expect(tmdbService.findIdentityByExternalId).not.toHaveBeenCalled();
  });

  test('collapses source failures to fixed aggregate outcomes', async () => {
    const { replay } = setup({ evidence: undefined });

    await expect(replay.replay()).resolves.toMatchObject({
      summary: { outcomes: { source_item_unavailable: 1 }, resolutionReasons: {} },
    });
  });
});
