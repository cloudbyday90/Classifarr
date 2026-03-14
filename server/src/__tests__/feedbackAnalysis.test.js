/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const feedbackAnalysis = require('../services/feedbackAnalysis');

describe('FeedbackAnalysis', () => {
  test('groupByMetadataField normalizes object-shaped genres and keywords', () => {
    const feedback = [
      {
        id: 1,
        item_metadata: {
          genres: [{ id: 99, name: 'Documentary' }, { id: 10751, name: 'Family' }],
          keywords: [{ id: 1, name: 'nature' }, { id: 2, name: 'wildlife' }]
        }
      }
    ];

    const groupedGenres = feedbackAnalysis.groupByMetadataField(feedback, 'genres');
    const groupedKeywords = feedbackAnalysis.groupByMetadataField(feedback, 'keywords');

    expect(groupedGenres.Documentary.count).toBe(1);
    expect(groupedGenres.Family.count).toBe(1);
    expect(groupedKeywords.nature.count).toBe(1);
    expect(groupedKeywords.wildlife.count).toBe(1);
  });

  test('groupByMetadataField normalizes belongs_to_collection objects and JSON strings', () => {
    const feedback = [
      {
        id: 1,
        item_metadata: {
          belongs_to_collection: { id: 10, name: 'Planet Earth Collection' }
        }
      },
      {
        id: 2,
        item_metadata: {
          belongs_to_collection: '{"id":11,"name":"Blue Planet Collection"}'
        }
      }
    ];

    const groupedCollections = feedbackAnalysis.groupByMetadataField(feedback, 'belongs_to_collection');

    expect(groupedCollections['Planet Earth Collection'].count).toBe(1);
    expect(groupedCollections['Blue Planet Collection'].count).toBe(1);
  });
});
