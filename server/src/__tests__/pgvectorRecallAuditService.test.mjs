/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { runPgvectorRecallAudit } from '../services/pgvectorRecallAuditService.mjs';

function createMockDb({ sources = [], neighborBatches = [] } = {}) {
  const transactionClients = [];
  const dbClient = {
    query: jest.fn().mockResolvedValue({ rows: sources }),
    withTransaction: jest.fn(async (fn) => {
      const client = {
        query: jest.fn(async (sql) => {
          if (typeof sql === 'string' && sql.includes('WITH source AS MATERIALIZED')) {
            return { rows: neighborBatches.shift() || [] };
          }
          return { rows: [] };
        }),
      };
      transactionClients.push(client);
      return fn(client);
    }),
    transactionClients,
  };
  return dbClient;
}

describe('pgvectorRecallAuditService', () => {
  const source = {
    embedding_id: 10,
    classification_id: 100,
    title: 'Source Movie',
    media_type: 'movie',
    library_id: 1,
    library_name: 'Movies',
    created_at: '2026-06-06T00:00:00.000Z',
  };

  it('compares approximate results against exact nearest-neighbor baseline', async () => {
    const exactRows = [
      { embedding_id: 20, classification_id: 200, title: 'Exact A', media_type: 'movie', library_id: 1, library_name: 'Movies', similarity: 0.94, distance: 0.06 },
      { embedding_id: 30, classification_id: 300, title: 'Exact B', media_type: 'movie', library_id: 2, library_name: 'Comedy', similarity: 0.91, distance: 0.09 },
    ];
    const approximateRows = [
      exactRows[0],
      { embedding_id: 40, classification_id: 400, title: 'Approx Only', media_type: 'movie', library_id: 3, library_name: 'Family', similarity: 0.88, distance: 0.12 },
    ];
    const dbClient = createMockDb({
      sources: [source],
      neighborBatches: [approximateRows, exactRows],
    });

    const result = await runPgvectorRecallAudit({ classification_id: '100', limit: '2' }, { dbClient });

    expect(result.mode).toBe('exact_vs_approximate');
    expect(result.options).toMatchObject({ classification_id: 100, sample_size: 1, limit: 2 });
    expect(result.summary).toMatchObject({
      sample_count: 1,
      average_recall: 0.5,
      min_recall: 0.5,
      samples_with_misses: 1,
    });
    expect(result.samples[0].overlap_count).toBe(1);
    expect(result.samples[0].missed_from_approximate).toHaveLength(1);
    expect(result.samples[0].missed_from_approximate[0].embedding_id).toBe(30);
    expect(result.samples[0].approximate_only).toHaveLength(1);
    expect(result.samples[0].approximate_only[0].embedding_id).toBe(40);
    expect(result.samples[0].exact_top[0]).not.toHaveProperty('embedding');
  });

  it('applies approximate HNSW settings and disables indexscan for exact baseline', async () => {
    const dbClient = createMockDb({
      sources: [source],
      neighborBatches: [[], []],
    });

    await runPgvectorRecallAudit({ classification_id: '100' }, { dbClient });

    expect(dbClient.transactionClients).toHaveLength(2);
    expect(dbClient.transactionClients[0].query).toHaveBeenCalledWith(
      "SELECT set_config('hnsw.ef_search', $1, true)",
      ['100'],
    );
    expect(dbClient.transactionClients[1].query).toHaveBeenCalledWith(
      "SELECT set_config('enable_indexscan', $1, true)",
      ['off'],
    );
  });

  it('rejects unbounded audit requests', async () => {
    const dbClient = createMockDb({ sources: [source] });

    await expect(runPgvectorRecallAudit({ sample_size: '11' }, { dbClient }))
      .rejects.toThrow(ValidationError);
    await expect(runPgvectorRecallAudit({ limit: '26' }, { dbClient }))
      .rejects.toThrow(ValidationError);
    expect(dbClient.query).not.toHaveBeenCalled();
  });

  it.each([
    { classification_id: ['42', '42'] },
    { classificationId: ['42'] },
    { 'classificationId[0]': '42' },
    { 'classification_id[]': '42' },
    { classificationId: { value: '42' } },
    { classification_id: ' 42 ' },
    { classification_id: '042' },
    { classification_id: '42e0' },
    { classification_id: '42.0' },
    { classification_id: 0 },
    { classification_id: Number.MAX_SAFE_INTEGER + 1 },
    { classification_id: '9223372036854775808' },
    { classification_id: '42', classificationId: '43' },
    { classification_id: '', classificationId: '42' },
    { classification_id: '42', classificationId: false },
  ])('refuses an invalid or ambiguous selector before reading data (%p)', async options => {
    const dbClient = createMockDb();
    await expect(runPgvectorRecallAudit(options, { dbClient })).rejects.toThrow(ValidationError);
    expect(dbClient.query).not.toHaveBeenCalled();
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    [{ classification_id: '100', classificationId: 100 }, 100],
    [{ classification_id: null, classificationId: '100' }, 100],
    [{ classification_id: '9007199254740992' }, '9007199254740992'],
    [{ classificationId: '9007199254740993' }, '9007199254740993'],
    [{ classification_id: '9223372036854775807', classificationId: '9223372036854775807' }, '9223372036854775807'],
  ])('binds the exact selector and echoes the compatible JSON type (%p)', async (options, id) => {
    const dbClient = createMockDb({ sources: [{ ...source, classification_id: id }] });
    const result = await runPgvectorRecallAudit({ ...options, sample_size: '10' }, { dbClient });

    expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining('ce.classification_id = $1'), [id, 1]);
    expect(result.options).toEqual({ classification_id: id, sample_size: 1, limit: 10 });
    expect(result.samples[0].source.classification_id).toBe(id);
  });

  it.each([
    { classification_id: '' },
    { classificationId: null },
    { classification_id: '', classificationId: '' },
  ])('keeps sampling when the selector is empty (%p)', async options => {
    const dbClient = createMockDb();
    const result = await runPgvectorRecallAudit(options, { dbClient });

    expect(result.options).toEqual({ classification_id: null, sample_size: 3, limit: 10 });
    expect(dbClient.query).toHaveBeenCalledWith(expect.any(String), [3]);
  });

  it('returns an empty audit when no sample source is available', async () => {
    const dbClient = createMockDb({ sources: [] });

    const result = await runPgvectorRecallAudit({}, { dbClient });

    expect(result.summary.sample_count).toBe(0);
    expect(result.summary.average_recall).toBeNull();
    expect(result.samples).toEqual([]);
    expect(dbClient.withTransaction).not.toHaveBeenCalled();
  });

  it('returns 404 when an explicit classification has no embedding', async () => {
    const dbClient = createMockDb({ sources: [] });

    await expect(runPgvectorRecallAudit({ classification_id: '999' }, { dbClient }))
      .rejects.toThrow(NotFoundError);
  });
});

