/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

const contextManager = require('../services/contextManager');

describe('ContextManager', () => {
  beforeEach(() => {
    contextManager.clearCache();
  });

  test('buildSections normalizes object-shaped metadata genres', () => {
    const sections = contextManager.buildSections({
      metadata: {
        title: 'Nature Movie',
        year: 2022,
        genres: [{ id: 99, name: 'Documentary' }, { id: 10751, name: 'Family' }],
        certification: 'PG',
        original_language: 'en'
      }
    });

    const metadataSection = sections.find(section => section.name === 'metadata');
    expect(metadataSection).toBeDefined();
    expect(metadataSection.content).toContain('Genres: Documentary, Family');
  });
});
