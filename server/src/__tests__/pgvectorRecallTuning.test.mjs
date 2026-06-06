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
import {
  applyPgvectorRecallSettings,
  resolvePgvectorCandidateLimit,
  resolvePgvectorRecallTuning,
} from '../services/pgvectorRecallTuning.mjs';

const ENV_KEYS = [
  'PGVECTOR_EF_SEARCH',
  'PGVECTOR_EF_SEARCH_CANDIDATES',
  'PGVECTOR_CANDIDATE_LIMIT',
  'PGVECTOR_CANDIDATE_LIMIT_MIN',
  'PGVECTOR_CANDIDATE_LIMIT_MULTIPLIER',
  'PGVECTOR_HNSW_ITERATIVE_SCAN',
  'PGVECTOR_HNSW_MAX_SCAN_TUPLES',
  'PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER',
];

describe('pgvector recall tuning', () => {
  const originalEnv = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('uses conservative recall defaults for normal semantic search', () => {
    const tuning = resolvePgvectorRecallTuning();

    expect(tuning).toMatchObject({
      efSearch: 80,
      candidateSearch: false,
      candidateLimitMin: 50,
      candidateLimitMultiplier: 10,
      candidateLimitMax: 200,
      iterativeScan: 'relaxed_order',
      maxScanTuples: null,
      scanMemMultiplier: null,
    });
    expect(resolvePgvectorCandidateLimit(5, tuning)).toBe(50);
  });

  it('uses wider ef_search defaults for candidate collection', () => {
    const tuning = resolvePgvectorRecallTuning({ candidateSearch: true });

    expect(tuning.efSearch).toBe(100);
    expect(tuning.candidateSearch).toBe(true);
    expect(resolvePgvectorCandidateLimit(25, tuning)).toBe(200);
  });

  it('clamps env-driven query breadth to bounded ranges', () => {
    process.env.PGVECTOR_EF_SEARCH = '50000';
    process.env.PGVECTOR_CANDIDATE_LIMIT_MIN = '0';
    process.env.PGVECTOR_CANDIDATE_LIMIT_MULTIPLIER = '99';
    process.env.PGVECTOR_CANDIDATE_LIMIT = '999999';
    process.env.PGVECTOR_HNSW_ITERATIVE_SCAN = 'invalid';
    process.env.PGVECTOR_HNSW_MAX_SCAN_TUPLES = '999999999';
    process.env.PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER = '999';

    const tuning = resolvePgvectorRecallTuning();

    expect(tuning.efSearch).toBe(1000);
    expect(tuning.candidateLimitMin).toBe(1);
    expect(tuning.candidateLimitMultiplier).toBe(50);
    expect(tuning.candidateLimitMax).toBe(5000);
    expect(tuning.iterativeScan).toBe('relaxed_order');
    expect(tuning.maxScanTuples).toBe(1000000);
    expect(tuning.scanMemMultiplier).toBe(100);
  });

  it('applies pgvector HNSW search settings locally inside a transaction', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const tuning = {
      efSearch: 120,
      iterativeScan: 'strict_order',
      maxScanTuples: 40000,
      scanMemMultiplier: 2,
    };

    await applyPgvectorRecallSettings(client, tuning);

    expect(client.query.mock.calls).toEqual([
      ["SELECT set_config('hnsw.ef_search', $1, true)", ['120']],
      ["SELECT set_config('hnsw.iterative_scan', $1, true)", ['strict_order']],
      ["SELECT set_config('hnsw.max_scan_tuples', $1, true)", ['40000']],
      ["SELECT set_config('hnsw.scan_mem_multiplier', $1, true)", ['2']],
    ]);
  });

  it('skips optional iterative scan settings when disabled', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const tuning = {
      efSearch: 80,
      iterativeScan: 'off',
      maxScanTuples: null,
      scanMemMultiplier: null,
    };

    await applyPgvectorRecallSettings(client, tuning);

    expect(client.query.mock.calls).toEqual([
      ["SELECT set_config('hnsw.ef_search', $1, true)", ['80']],
    ]);
  });
});
