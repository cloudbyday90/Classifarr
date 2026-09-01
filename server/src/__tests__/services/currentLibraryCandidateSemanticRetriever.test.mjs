/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  createCurrentLibraryCandidateSemanticRetriever,
} from '../../services/currentLibraryCandidateSemanticRetriever.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL,
} from '../../services/currentLibraryCandidateSemanticRetrieverQuery.mjs';

const contract = {
  valid: true,
  candidates: [
    { libraryId: 7, mediaType: 'movie' },
    { libraryId: 9, mediaType: 'movie' },
  ],
};

function createTransaction(rows = []) {
  const client = { query: jest.fn().mockResolvedValue({ rows }) };
  return {
    client,
    withTransaction: jest.fn(async (work) => await work(client)),
  };
}

describe('currentLibraryCandidateSemanticRetriever', () => {
  test('uses one embedding and a fixed candidate-scoped current-inventory query', async () => {
    const transaction = createTransaction([
      { library_id: 7, title: 'Storm Chasers', year: 2025, relevance: 91 },
      { library_id: 7, title: 'Floodplain', year: 2024, relevance: 79 },
      { library_id: 9, title: 'Laugh Track', year: 2025, relevance: 38 },
      { library_id: 22, title: 'Outside Policy Scope', year: 2025, relevance: 100 },
    ]);
    const embed = jest.fn().mockResolvedValue({ embedding: [0.25, -0.5] });
    const service = createCurrentLibraryCandidateSemanticRetriever({
      embed,
      formatForEmbedding: () => 'Title: Incoming item | Synopsis: A disaster documentary',
      isEnabled: async () => true,
      withTransaction: transaction.withTransaction,
    });

    const result = await service.retrieve({ contract, metadata: { title: 'Incoming item' } });

    expect(embed).toHaveBeenCalledWith('Title: Incoming item | Synopsis: A disaster documentary');
    expect(transaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.client.query).toHaveBeenCalledWith(
      CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_SQL,
      [[7, 9], 'movie', '[0.25,-0.5]', 128, 3],
    );
    expect(result).toMatchObject({
      statusId: 'available',
      candidates: [
        {
          libraryId: 7,
          matchCount: 2,
          topRelevance: 91,
          items: [
            { title: 'Storm Chasers', year: 2025, relevance: 91 },
            { title: 'Floodplain', year: 2024, relevance: 79 },
          ],
        },
        {
          libraryId: 9,
          matchCount: 1,
          topRelevance: 38,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('Outside Policy Scope');
  });

  test('does not invoke a provider or query when RAG is disabled', async () => {
    const embed = jest.fn();
    const withTransaction = jest.fn();
    const service = createCurrentLibraryCandidateSemanticRetriever({
      embed,
      formatForEmbedding: () => 'Title: Incoming item',
      isEnabled: async () => false,
      withTransaction,
    });

    const result = await service.retrieve({ contract, metadata: { title: 'Incoming item' } });

    expect(result).toMatchObject({
      statusId: 'unavailable',
      candidates: [
        { libraryId: 7, matchCount: 0, items: [] },
        { libraryId: 9, matchCount: 0, items: [] },
      ],
    });
    expect(embed).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('fails closed when embedding or vector retrieval is unavailable', async () => {
    const logger = { warn: jest.fn() };
    const service = createCurrentLibraryCandidateSemanticRetriever({
      embed: jest.fn().mockRejectedValue(new Error('embedding unavailable')),
      formatForEmbedding: () => 'Title: Incoming item',
      isEnabled: async () => true,
      logger,
    });

    const result = await service.retrieve({ contract, metadata: { title: 'Incoming item' } });

    expect(result).toMatchObject({ statusId: 'unavailable' });
    expect(logger.warn).toHaveBeenCalledWith('Current-library candidate semantic retrieval unavailable', {
      error: 'embedding unavailable',
    });
  });

  test('does not invoke semantic retrieval for an invalid policy-owned contract', async () => {
    const embed = jest.fn();
    const service = createCurrentLibraryCandidateSemanticRetriever({ embed });

    const result = await service.retrieve({
      contract: { valid: false },
      metadata: { title: 'Incoming item' },
    });

    expect(result).toEqual(expect.objectContaining({ statusId: 'not_applicable', candidates: [] }));
    expect(embed).not.toHaveBeenCalled();
  });

  test('fails closed without invoking a provider when embedding text cannot be formatted', async () => {
    const embed = jest.fn();
    const withTransaction = jest.fn();
    const service = createCurrentLibraryCandidateSemanticRetriever({
      embed,
      formatForEmbedding: () => { throw new Error('metadata formatting failed'); },
      withTransaction,
    });

    const result = await service.retrieve({ contract, metadata: { title: 'Incoming item' } });

    expect(result).toMatchObject({
      statusId: 'unavailable',
      candidates: [
        { libraryId: 7, matchCount: 0, items: [] },
        { libraryId: 9, matchCount: 0, items: [] },
      ],
    });
    expect(embed).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
