/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM,
  readHeldOutSemanticStudyInventoryFrame,
} from '../../services/heldOutSemanticStudyInventorySource.mjs';

test('reads a bounded, deterministic identity-verified inventory frame without serializing it', async () => {
  const query = jest.fn(async () => ({ rows: [{
    content_rating: 'PG',
    genres: ['Documentary'],
    history_metadata: { keywords: ['History'], overview: 'Private overview' },
    media_type: 'movie',
    metadata: { summary: 'Current private overview' },
    study_stratum: 'documentary',
    title: 'Private title',
    tmdb_id: 44,
    year: 2020,
  }] }));

  const frame = await readHeldOutSemanticStudyInventoryFrame({
    query,
    selectionSeed: 'a'.repeat(64),
  });

  expect(frame).toHaveLength(1);
  expect(frame[0]).toMatchObject({
    metadata: { media_type: 'movie', tmdb_id: 44, title: 'Private title', genres: ['Documentary'] },
    stratum: 'documentary',
  });
  const [statement, values] = query.mock.calls[0];
  expect(statement).toContain('media_source_observations');
  expect(statement).toContain('ORDER BY md5($1::text');
  expect(values).toEqual(['a'.repeat(64), 30, HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM, null]);
});

test('allows a bounded active-library scope and rejects malformed identifiers', async () => {
  const query = jest.fn(async () => ({ rows: [] }));
  await readHeldOutSemanticStudyInventoryFrame({ query, selectionSeed: 'a'.repeat(64), libraryIds: [1, 2] });
  expect(query.mock.calls[0][1][3]).toEqual([1, 2]);
  expect(query.mock.calls[0][0]).toContain('msi.library_id = ANY($4::integer[])');
  for (const libraryIds of [[0], [1.2], [2_147_483_648], '1', Array(65).fill(1)]) {
    await expect(readHeldOutSemanticStudyInventoryFrame({ query, selectionSeed: 'a'.repeat(64), libraryIds })).rejects.toThrow('invalid_held_out_inventory_library_scope');
  }
  expect(query).toHaveBeenCalledTimes(1);
});

test('rejects an unsafe inventory frame before callers can plan a cohort', async () => {
  await expect(readHeldOutSemanticStudyInventoryFrame({
    query: async () => ({ rows: [{ media_type: 'movie', study_stratum: 'ordinary', title: 'x', tmdb_id: 0 }] }),
    selectionSeed: 'a'.repeat(64),
  })).rejects.toThrow('invalid_held_out_inventory_frame');
});
