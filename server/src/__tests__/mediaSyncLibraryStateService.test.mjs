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
import { MediaSyncLibraryStateService } from '../services/mediaSyncLibraryStateService.mjs';

const db = {
  query: jest.fn(),
};

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('MediaSyncLibraryStateService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MediaSyncLibraryStateService({ db, logger });
  });

  test('findExistingMedia returns the first matching media item', async () => {
    const mediaItem = {
      id: 1,
      tmdb_id: 12345,
      title: 'Test Movie',
      library_id: 1,
      library_name: 'Movies',
    };
    db.query.mockResolvedValue({ rows: [mediaItem] });

    await expect(service.findExistingMedia(12345, 'movie')).resolves.toEqual(mediaItem);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM media_server_items msi'),
      [12345, 'movie']
    );
  });

  test('getLibraryContext maps the existing media item into library context', async () => {
    db.query.mockResolvedValue({
      rows: [{
        id: 1,
        tmdb_id: 12345,
        title: 'Test Movie',
        year: 2020,
        library_id: 1,
        library_name: 'Movies',
        added_at: '2024-01-01',
        collections: ['Collection 1'],
        tags: ['tag1'],
      }],
    });

    await expect(service.getLibraryContext(12345, { media_type: 'movie' })).resolves.toEqual({
      exists: true,
      library_id: 1,
      library_name: 'Movies',
      title: 'Test Movie',
      year: 2020,
      added_at: '2024-01-01',
      collections: ['Collection 1'],
      tags: ['tag1'],
    });
  });

  test('reconcileAwaitingDecisions updates awaiting items and writes learned corrections', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 100,
          tmdb_id: 12345,
          media_type: 'movie',
          title: 'Test Movie',
          library_id: 1,
          library_name: 'Movies',
        }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.reconcileAwaitingDecisions(1)).resolves.toBe(1);
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("status = 'awaiting_decision'"),
      [1]
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO learned_corrections'),
      [12345, 'movie', 1, 'Test Movie', 'plex_reconciliation']
    );
  });
});
