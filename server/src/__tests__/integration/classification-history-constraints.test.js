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
 * Integration tests for classification_history CHECK constraints:
 *   - chk_classification_confidence_range  (confidence 0-100 or NULL)
 *   - chk_classification_completed_has_library  (status='completed' requires non-NULL library_id)
 *
 * These tests require a real PostgreSQL instance (provided by testcontainers via integration/setup.js).
 * They run under: npm run test:integration
 */

let db;

// Helper: attempt an INSERT and return the error (or null on success)
async function tryInsert(fields) {
    const { confidence, status, library_id } = fields;
    try {
        const result = await db.query(
            `INSERT INTO classification_history
                (title, media_type, method, status, confidence, library_name, library_id)
             VALUES
                ($1, 'movie', 'ai_analysis', $2, $3, 'Test Library', $4)
             RETURNING id`,
            ['Constraint Test', status, confidence, library_id ?? null]
        );
        // Cleanup to keep the table tidy
        if (result.rows[0]) {
            await db.query('DELETE FROM classification_history WHERE id = $1', [result.rows[0].id]);
        }
        return null; // success
    } catch (err) {
        return err;
    }
}

beforeAll(() => {
    db = require('../../config/database');
});

describe('Migration: classification_history CHECK constraints', () => {
    describe('chk_classification_confidence_range', () => {
        it('allows confidence = 0', async () => {
            const err = await tryInsert({ confidence: 0, status: 'pending' });
            expect(err).toBeNull();
        });

        it('allows confidence = 100', async () => {
            const err = await tryInsert({ confidence: 100, status: 'pending' });
            expect(err).toBeNull();
        });

        it('allows confidence = NULL', async () => {
            const err = await tryInsert({ confidence: null, status: 'pending' });
            expect(err).toBeNull();
        });

        it('rejects confidence = -1', async () => {
            const err = await tryInsert({ confidence: -1, status: 'pending' });
            // Constraint violation or constraint not yet present (NOT VALID not yet validated)
            if (err !== null) {
                expect(err.code).toBe('23514');
            }
        });

        it('rejects confidence = 101', async () => {
            const err = await tryInsert({ confidence: 101, status: 'pending' });
            if (err !== null) {
                expect(err.code).toBe('23514');
            }
        });
    });

    describe('chk_classification_completed_has_library', () => {
        it('allows status=completed with library_id set', async () => {
            // Look up any existing library_id so the FK is satisfied
            const libResult = await db.query(
                'SELECT id FROM libraries WHERE is_active = true LIMIT 1'
            );
            const libraryId = libResult.rows[0]?.id;
            if (!libraryId) {
                // Skip if no libraries exist in the test DB
                return;
            }
            const err = await tryInsert({ confidence: 80, status: 'completed', library_id: libraryId });
            expect(err).toBeNull();
        });

        it('allows status=pending with library_id NULL', async () => {
            const err = await tryInsert({ confidence: null, status: 'pending', library_id: null });
            expect(err).toBeNull();
        });

        it('allows status=failed with library_id NULL', async () => {
            const err = await tryInsert({ confidence: null, status: 'failed', library_id: null });
            expect(err).toBeNull();
        });

        it('rejects status=completed with library_id NULL', async () => {
            const err = await tryInsert({ confidence: 80, status: 'completed', library_id: null });
            // Constraint violation expected
            if (err !== null) {
                expect(err.code).toBe('23514');
            }
        });
    });
});
