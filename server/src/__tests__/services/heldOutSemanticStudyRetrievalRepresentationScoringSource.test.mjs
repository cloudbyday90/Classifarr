/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createHeldOutSemanticStudyScope,
} from '../../services/heldOutSemanticStudyScope.mjs';
import {
  createHeldOutSemanticStudyRetrievalRepresentationScoringSource,
  HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS,
} from '../../services/heldOutSemanticStudyRetrievalRepresentationScoringSource.mjs';

const metadata = Object.freeze({ media_type: 'movie', title: 'Held-out title', tmdb_id: 101, year: 2020 });
const candidates = Object.freeze([
  Object.freeze({ candidateId: 'candidate_a', libraryId: 1 }),
  Object.freeze({ candidateId: 'candidate_b', libraryId: 2 }),
]);

describe('held-out retrieval-representation scoring source', () => {
  test('uses fixed parameters and keeps bounded raw history in-process', async () => {
    const query = jest.fn(async (sql) => (
      sql.includes('classification_embeddings')
        ? { rows: [{
          classification_label: 'Documentaries',
          history_metadata: { overview: 'Private nearest item synopsis' },
          library_id: 1,
          media_type: 'movie',
          title: 'Private nearest item',
          year: 2024,
        }] }
        : { rows: [] }
    ));
    const source = createHeldOutSemanticStudyRetrievalRepresentationScoringSource({
      embed: jest.fn(async () => ({ embedding: [0.1, 0.2], fallback: false })),
      formatForEmbedding: jest.fn(() => 'Title: Held-out title'),
      logger: { warn: jest.fn() },
      withTransaction: async (work) => work({ query }),
    });

    const evidence = await source.retrieve({
      candidates,
      heldOutScope: createHeldOutSemanticStudyScope([
        ...Array.from({ length: 23 }, (_, index) => ({ media_type: 'tv', tmdb_id: index + 1 })),
        metadata,
      ]),
      metadata,
    });

    expect(evidence.statusId).toBe(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.AVAILABLE);
    expect(evidence.candidates).toEqual([
      {
        candidateId: 'candidate_a',
        items: [expect.objectContaining({ classificationLabel: 'Documentaries' })],
      },
      { candidateId: 'candidate_b', items: [] },
    ]);
    const sourceQuery = query.mock.calls.find(([sql]) => sql.includes('classification_embeddings'));
    expect(sourceQuery[0]).not.toContain('Held-out title');
    expect(sourceQuery[1]).toEqual(expect.arrayContaining([[1, 2], 'movie']));
  });

  test('fails closed when the case is not inside the pinned held-out cohort', async () => {
    const logger = { warn: jest.fn() };
    const source = createHeldOutSemanticStudyRetrievalRepresentationScoringSource({
      embed: jest.fn(),
      logger,
      withTransaction: jest.fn(),
    });

    const evidence = await source.retrieve({
      candidates,
      heldOutScope: createHeldOutSemanticStudyScope(Array.from({ length: 24 }, (_, index) => ({
        media_type: 'movie', tmdb_id: index + 1,
      }))),
      metadata,
    });

    expect(evidence.statusId).toBe(HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_SOURCE_STATUS_IDS.UNAVAILABLE);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
