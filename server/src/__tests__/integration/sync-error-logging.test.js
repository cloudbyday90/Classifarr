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
 * Validates that MediaSyncService throws the correct error types (not generic
 * Errors) when referenced libraries are missing, and that sync status records
 * are not created prematurely when a library lookup fails.
 *
 * These tests require a real PostgreSQL instance (provided by integration/setup.js).
 */

const NONEXISTENT_LIBRARY_ID = 999999999;

let db;
let mediaSyncService;
let LibraryNotFoundError;

beforeAll(() => {
    db = require('../../config/database');
    mediaSyncService = require('../../services/mediaSync');
    ({ LibraryNotFoundError } = require('../../utils/errors'));
});

describe('MediaSyncService: library-not-found handling', () => {
    describe('syncLibrary()', () => {
        it('throws LibraryNotFoundError (not a generic Error) when library does not exist', async () => {
            await expect(
                mediaSyncService.syncLibrary(NONEXISTENT_LIBRARY_ID)
            ).rejects.toBeInstanceOf(LibraryNotFoundError);
        });

        it('does not create a sync status record when library lookup fails', async () => {
            // Capture row count before the failed sync attempt
            const before = await db.query(
                'SELECT COUNT(*) FROM media_server_sync_status WHERE library_id = $1',
                [NONEXISTENT_LIBRARY_ID]
            );
            const countBefore = parseInt(before.rows[0].count);

            await expect(
                mediaSyncService.syncLibrary(NONEXISTENT_LIBRARY_ID)
            ).rejects.toBeInstanceOf(LibraryNotFoundError);

            // No status record should have been inserted (abort is early)
            const after = await db.query(
                'SELECT COUNT(*) FROM media_server_sync_status WHERE library_id = $1',
                [NONEXISTENT_LIBRARY_ID]
            );
            expect(parseInt(after.rows[0].count)).toBe(countBefore);
        });
    });

    describe('getLibraryItems()', () => {
        it('throws LibraryNotFoundError (not a generic Error) when library does not exist', async () => {
            await expect(
                mediaSyncService.getLibraryItems(NONEXISTENT_LIBRARY_ID)
            ).rejects.toBeInstanceOf(LibraryNotFoundError);
        });

        it('reads from a real library without error when it exists', async () => {
            // Smoke test: if any library exists in the DB, getLibraryItems returns
            // a { items, total } object without throwing.
            const libResult = await db.query(
                'SELECT id FROM libraries WHERE is_active = true LIMIT 1'
            );
            if (libResult.rows.length === 0) {
                return; // No libraries — skip
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

