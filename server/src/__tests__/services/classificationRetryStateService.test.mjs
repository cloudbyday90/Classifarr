import { jest } from '@jest/globals';

import { ClassificationRetryStateService } from '../../services/classificationRetryStateService.mjs';

describe('ClassificationRetryStateService', () => {
  let client;
  let service;

  beforeEach(() => {
    client = {
      query: jest.fn()
    };
    service = new ClassificationRetryStateService();
  });

  test('cleanupEnrichmentState reports skipped cleanup when no media item is linked', async () => {
    await expect(service.cleanupEnrichmentState(client, null)).resolves.toEqual({
      enrichmentQueueRowsRemoved: 0,
      metadataEnrichmentTasksRemoved: 0,
      enrichmentMetadataReset: false,
      enrichmentCleanupSkipped: 'no_media_item_link',
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  test('cleanupEnrichmentState deletes retry rows, metadata tasks, and resets enrichment metadata', async () => {
    client.query
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await service.cleanupEnrichmentState(client, 7001);

    expect(result).toEqual({
      enrichmentQueueRowsRemoved: 2,
      metadataEnrichmentTasksRemoved: 1,
      enrichmentMetadataReset: true,
      enrichmentCleanupSkipped: null,
    });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM enrichment_retry_queue'),
      [7001]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("task_type = 'metadata_enrichment'"),
      [7001]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("enrichment_status = 'pending'"),
      [7001]
    );
  });

  test('cleanupEnrichmentState honors injected metadata enrichment helpers', async () => {
    const metadataEnrichment = {
      ENRICHMENT_METADATA_KEYS: ['omdb'],
      buildJsonbDeleteChain: jest.fn().mockReturnValue("COALESCE(metadata, '{}'::jsonb) - 'omdb'"),
    };
    service = new ClassificationRetryStateService({ metadataEnrichment });
    client.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 });

    await service.cleanupEnrichmentState(client, 7002);

    expect(metadataEnrichment.buildJsonbDeleteChain).toHaveBeenCalledWith(
      "COALESCE(metadata, '{}'::jsonb)",
      ['omdb']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("COALESCE(metadata, '{}'::jsonb) - 'omdb'"),
      [7002]
    );
  });

  test('hasPendingClassificationTask falls back to title/year matching when tmdb lookup misses', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8802, status: 'pending' }] });

    const result = await service.hasPendingClassificationTask(client, {
      tmdbId: 444,
      mediaType: 'movie',
      title: 'duplicate item',
      year: '2026'
    });

    expect(result).toEqual({ id: 8802, status: 'pending' });
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("(payload->>'tmdb_id')"),
      [444, 'movie']
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("LOWER(TRIM(COALESCE(payload->>'title'"),
      ['duplicate item', '2026', 'movie']
    );
  });

  test('resolveMediaItemId uses source_library_id when title/year fallback is needed', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 8102 }] });

    const result = await service.resolveMediaItemId(
      client,
      { source_library_id: 44 },
      { tmdbId: 1234, mediaType: 'movie', title: 'duplicated title', year: '2025' }
    );

    expect(result).toBe(8102);
    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND library_id = $3'),
      [1234, 'movie', 44]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND library_id = $4'),
      ['duplicated title', 'movie', '2025', 44]
    );
  });
});
