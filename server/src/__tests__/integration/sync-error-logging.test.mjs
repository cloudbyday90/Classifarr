/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Integration tests for sync service error handling behavior.
 *
 * Validates that MediaSyncService throws the correct error types when referenced
 * libraries are missing, and that sync status records are not created
 * prematurely when a library lookup fails.
 */

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

const NONEXISTENT_LIBRARY_ID = 999999999;

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function createLogger() {
  return logger;
}

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: { createLogger },
  createLogger,
}));

const { default: db } = await import('../../config/database.mjs');
const { mediaSyncService } = await import('../../services/mediaSync.mjs');
const { LibraryNotFoundError } = await import('../../utils/errors.mjs');

describe('MediaSyncService: library-not-found handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncLibrary()', () => {
    it('throws LibraryNotFoundError when library does not exist', async () => {
      await expect(
        mediaSyncService.syncLibrary(NONEXISTENT_LIBRARY_ID)
      ).rejects.toBeInstanceOf(LibraryNotFoundError);

      expect(logger.warn).toHaveBeenCalledWith('Library not found during sync', {
        libraryId: NONEXISTENT_LIBRARY_ID,
      });
    });

    it('does not create a sync status record when library lookup fails', async () => {
      const before = await db.query(
        'SELECT COUNT(*) FROM media_server_sync_status WHERE library_id = $1',
        [NONEXISTENT_LIBRARY_ID]
      );
      const countBefore = Number.parseInt(before.rows[0].count, 10);

      await expect(
        mediaSyncService.syncLibrary(NONEXISTENT_LIBRARY_ID)
      ).rejects.toBeInstanceOf(LibraryNotFoundError);

      expect(logger.warn).toHaveBeenCalledWith('Library not found during sync', {
        libraryId: NONEXISTENT_LIBRARY_ID,
      });

      const after = await db.query(
        'SELECT COUNT(*) FROM media_server_sync_status WHERE library_id = $1',
        [NONEXISTENT_LIBRARY_ID]
      );
      expect(Number.parseInt(after.rows[0].count, 10)).toBe(countBefore);
    });
  });

  describe('getLibraryItems()', () => {
    it('throws LibraryNotFoundError when library does not exist', async () => {
      await expect(
        mediaSyncService.getLibraryItems(NONEXISTENT_LIBRARY_ID)
      ).rejects.toBeInstanceOf(LibraryNotFoundError);

      expect(logger.warn).toHaveBeenCalledWith('Library not found when getting items', {
        libraryId: NONEXISTENT_LIBRARY_ID,
      });
    });

    it('reads from a real library without error when it exists', async () => {
      const libResult = await db.query(
        'SELECT id FROM libraries WHERE is_active = true LIMIT 1'
      );
      if (libResult.rows.length === 0) {
        return;
      }

      const libraryId = libResult.rows[0].id;
      const result = await mediaSyncService.getLibraryItems(libraryId, { limit: 1 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe('number');
    });
  });
});