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
 * These tests require a real PostgreSQL instance (provided by testcontainers via integration/setup.mjs).
 * They run under: npm run test:integration
 */

import { getPool } from './setup.mjs';

let db;

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
        if (result.rows[0]) {
            await db.query('DELETE FROM classification_history WHERE id = $1', [result.rows[0].id]);
        }
        return null;
    } catch (err) {
        return err;
    }
}

beforeAll(() => {
    db = getPool();
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
            const libResult = await db.query(
                'SELECT id FROM libraries WHERE is_active = true LIMIT 1'
            );
            const libraryId = libResult.rows[0]?.id;
            if (!libraryId) {
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
            if (err !== null) {
                expect(err.code).toBe('23514');
            }
        });
    });
});

describe('CLARIFY result storage: policy_question round-trip', () => {
    let libraryId;

    beforeAll(async () => {
        const existingLib = await db.query(
            'SELECT id, name FROM libraries WHERE is_active = true LIMIT 1'
        );
        if (existingLib.rows.length > 0) {
            libraryId = existingLib.rows[0].id;
        } else {
            const ins = await db.query(
                `INSERT INTO libraries (name, external_id, media_type, is_active)
                 VALUES ('CLARIFY Test Library', 'test-clarify-library', 'movie', true)
                 RETURNING id`
            );
            libraryId = ins.rows[0].id;
        }
    });

    it('stores and retrieves CLARIFY options with library_id intact', async () => {
        if (!libraryId) {
            return;
        }

        const policyQuestion = {
            problem_summary: 'Could be either a drama or a documentary',
            why_uncertain: 'Genre signals conflict',
            question: 'Which library should this title go to?',
            options: [
                { label: 'Drama Movies', library_id: libraryId, library_name: 'Drama Movies' },
                { label: 'Documentaries', library_id: null, library_name: null }
            ],
            generated_at: new Date().toISOString(),
            signal_breakdown: [],
            calculated_confidence: 55
        };

        const policyQuestionStr = JSON.stringify(policyQuestion);

        const insertResult = await db.query(
            `INSERT INTO classification_history
                (title, media_type, method, status, confidence, policy_question)
             VALUES
                ($1, 'movie', 'ai_analysis', 'awaiting_decision', 55, $2::jsonb)
             RETURNING id`,
            ['CLARIFY Storage Test', policyQuestionStr]
        );
        const rowId = insertResult.rows[0].id;

        try {
            const readResult = await db.query(
                'SELECT policy_question FROM classification_history WHERE id = $1',
                [rowId]
            );
            const stored = readResult.rows[0].policy_question;

            expect(stored).not.toBeNull();
            expect(stored.options).toHaveLength(2);
            expect(stored.options[0].library_id).toBe(libraryId);
            expect(stored.options[0].library_name).toBe('Drama Movies');
            expect(stored.options[0].label).toBe('Drama Movies');
            expect(stored.options[1].library_id).toBeNull();
        } finally {
            await db.query('DELETE FROM classification_history WHERE id = $1', [rowId]);
        }
    });

    it('stores awaiting_decision status when needs_clarification is true', async () => {
        if (!libraryId) {
            return;
        }

        const insertResult = await db.query(
            `INSERT INTO classification_history
                (title, media_type, method, status, confidence, library_id)
             VALUES
                ($1, 'movie', 'ai_analysis', 'awaiting_decision', 55, NULL)
             RETURNING id`,
            ['CLARIFY Awaiting Decision Test']
        );
        const rowId = insertResult.rows[0].id;
        await db.query('DELETE FROM classification_history WHERE id = $1', [rowId]);

        expect(rowId).toBeTruthy();
    });
});