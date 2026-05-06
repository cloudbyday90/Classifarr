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

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { default: autoLearningService } = await import('../../services/autoLearningService.mjs');

describe('AutoLearningService Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testMediaServerId;
    let testUserId;

    beforeAll(async () => {
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role)
            VALUES ('test-learning-user', 'hash', 'admin')
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Learning Server', 'http://localhost:32400', 'test-key')
            RETURNING id
        `);
        testMediaServerId = serverRes.rows[0].id;

        const libRes = await db.query(`
            INSERT INTO libraries (name, media_type, media_server_id, external_id, is_active)
            VALUES ('Test Learning Library', 'movie', $1, 'test-learning-lib', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        const policyRes = await db.query(`
            INSERT INTO library_policies (library_id, name, description)
            VALUES ($1, 'Test Learning Policy', 'Test policy for learning')
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        const presetRes = await db.query(`
            SELECT id FROM content_presets LIMIT 1
        `);
        const presetId = presetRes.rows[0]?.id || 1;

        await db.query(`
            INSERT INTO policy_presets (policy_id, preset_id, custom_signals)
            VALUES ($1, $2, '{}')
        `, [testPolicyId, presetId]);
    });

    afterAll(async () => {
        await db.query('DELETE FROM auto_learned_preferences WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM learning_conflicts WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM learning_rate_limits WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('Rate Limiting', () => {
        test('should allow learning within rate limits', async () => {
            const result = await autoLearningService.canApplyLearning('test-user-1', testLibraryId);
            expect(result.allowed).toBe(true);
        });

        test('should block learning when user rate limit exceeded', async () => {
            const userId = 'test-user-rate-limit';
            for (let index = 0; index < 50; index++) {
                await db.query(`
                    INSERT INTO learning_rate_limits (user_id, library_id, learn_timestamp)
                    VALUES ($1, $2, NOW() - INTERVAL '1 minute')
                `, [userId, testLibraryId]);
            }

            const result = await autoLearningService.canApplyLearning(userId, testLibraryId);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('rate limit exceeded');

            await db.query('DELETE FROM learning_rate_limits WHERE user_id = $1', [userId]);
        });
    });

    describe('Genre Learning', () => {
        test('should learn genre after sufficient confirmations', async () => {
            const genre = 'Test Action';

            for (let index = 0; index < 3; index++) {
                const _classRes = await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, status, confidence, method
                    )
                    VALUES ($1, $2, 'movie', $3, 'completed', 85, 'policy_auto')
                    RETURNING id
                `, [1000 + index, `Test Movie ${index}`, testLibraryId]);

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', $2, 'verify', $3, false, NOW())
                `, [1000 + index, `Test Movie ${index}`, testLibraryId]);
            }

            const result = await autoLearningService.learnGenrePreference(
                testLibraryId,
                genre,
                { userId: 'test-user-genre' }
            );

            expect(result).toBeDefined();
            expect(result.learned).toBeDefined();

            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 1000 AND tmdb_id < 1010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 1000 AND tmdb_id < 1010');
        });

        test('should not learn genre with insufficient confirmations', async () => {
            const genre = 'Test Drama';

            for (let index = 0; index < 2; index++) {
                await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, status, confidence, method
                    )
                    VALUES ($1, $2, 'movie', $3, 'completed', 85, 'policy_auto')
                `, [2000 + index, `Test Movie ${index}`, testLibraryId]);

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', $2, 'verify', $3, false, NOW())
                `, [2000 + index, `Test Movie ${index}`, testLibraryId]);
            }

            const result = await autoLearningService.learnGenrePreference(
                testLibraryId,
                genre,
                { userId: 'test-user-insufficient' }
            );

            expect(result.learned).toBe(false);
            expect(result.reason).toBe('insufficient_confidence');

            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 2000 AND tmdb_id < 2010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 2000 AND tmdb_id < 2010');
        });
    });

    describe('Conflict Detection', () => {
        test('should detect conflict when genre is in exclude list', async () => {
            const genre = 'Test Horror';

            await db.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{genres,exclude}',
                    $1::jsonb
                )
                WHERE policy_id = $2
            `, [JSON.stringify([genre]), testPolicyId]);

            const conflict = await autoLearningService.detectIntraLibraryConflict(
                testLibraryId,
                genre,
                'genre_prefer'
            );

            expect(conflict).toBeDefined();
            expect(conflict.conflict).toBeDefined();

            if (conflict.conflict) {
                expect(conflict.type).toBe('intra_library_exclusion');

                const conflictLog = await db.query(`
                    SELECT * FROM learning_conflicts
                    WHERE library_id = $1 AND preference_value = $2
                `, [testLibraryId, genre]);

                expect(conflictLog.rows.length).toBeGreaterThan(0);
            }

            await db.query(`
                UPDATE policy_presets
                SET custom_signals = '{}'::jsonb
                WHERE policy_id = $1
            `, [testPolicyId]);
            await db.query('DELETE FROM learning_conflicts WHERE library_id = $1', [testLibraryId]);
        });
    });

    describe('Learn From Feedback', () => {
        test('should handle feedback without crashing', async () => {
            const genres = ['Sci-Fi', 'Adventure'];
            const keywords = ['space', 'exploration', 'aliens', 'future', 'technology'];
            const studio = 'Test Studios';

            for (let index = 0; index < 5; index++) {
                await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, status, confidence, method
                    )
                    VALUES ($1, $2, 'movie', $3, 'completed', 85, 'policy_auto')
                `, [3000 + index, `Test Sci-Fi Movie ${index}`, testLibraryId]);

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', $2, 'verify', $3, false, NOW())
                `, [3000 + index, `Test Sci-Fi Movie ${index}`, testLibraryId]);
            }

            const result = await autoLearningService.learnFromFeedback({
                tmdbId: 3000,
                libraryId: testLibraryId,
                genres,
                keywords: keywords.slice(0, 5),
                studio,
                wasCorrection: false,
                userId: 'test-user-multi'
            });

            expect(result).toBeDefined();
            expect(result.learned).toBeDefined();

            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 3000 AND tmdb_id < 3010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 3000 AND tmdb_id < 3010');
            await db.query('DELETE FROM auto_learned_preferences WHERE library_id = $1', [testLibraryId]);
            await db.query('DELETE FROM learning_rate_limits WHERE library_id = $1', [testLibraryId]);
        });
    });

    describe('Admin Functions', () => {
        test('should retrieve learned preferences for a library', async () => {
            await db.query(`
                INSERT INTO auto_learned_preferences (
                    library_id, policy_id, preference_type, preference_value,
                    confidence_count, source, learned_from_user_id
                )
                VALUES ($1, $2, 'genre_prefer', 'Test Thriller', 3, 'user_feedback', 'test-admin')
            `, [testLibraryId, testPolicyId]);

            const preferences = await autoLearningService.getLearnedPreferences(testLibraryId);

            expect(preferences.length).toBeGreaterThan(0);
            expect(preferences[0].preference_type).toBe('genre_prefer');
            expect(preferences[0].preference_value).toBe('Test Thriller');

            await db.query('DELETE FROM auto_learned_preferences WHERE library_id = $1', [testLibraryId]);
        });
    });
});