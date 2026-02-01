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

const db = require('../../config/database');
const autoLearningService = require('../../services/autoLearningService');

describe('AutoLearningService Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testMediaServerId;
    let testUserId;

    beforeAll(async () => {
        // Create test user
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role)
            VALUES ('test-learning-user', 'hash', 'admin')
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        // Create test media server
        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Learning Server', 'http://localhost:32400', 'test-key')
            RETURNING id
        `);
        testMediaServerId = serverRes.rows[0].id;

        // Create test library
        const libRes = await db.query(`
            INSERT INTO libraries (name, media_type, media_server_id, is_active)
            VALUES ('Test Learning Library', 'movie', $1, true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        // Create policy for library
        const policyRes = await db.query(`
            INSERT INTO library_policies (library_id, name, description)
            VALUES ($1, 'Test Learning Policy', 'Test policy for learning')
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        // Create policy preset
        await db.query(`
            INSERT INTO policy_presets (policy_id, preset_name, custom_signals)
            VALUES ($1, 'test_preset', '{}')
        `, [testPolicyId]);
    });

    afterAll(async () => {
        // Cleanup in reverse order
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
            // Insert 50 rate limit entries for the same user
            const userId = 'test-user-rate-limit';
            for (let i = 0; i < 50; i++) {
                await db.query(`
                    INSERT INTO learning_rate_limits (user_id, library_id, learn_timestamp)
                    VALUES ($1, $2, NOW() - INTERVAL '1 minute')
                `, [userId, testLibraryId]);
            }

            const result = await autoLearningService.canApplyLearning(userId, testLibraryId);
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('rate limit exceeded');

            // Cleanup
            await db.query('DELETE FROM learning_rate_limits WHERE user_id = $1', [userId]);
        });
    });

    describe('Genre Learning', () => {
        test('should learn genre after sufficient confirmations', async () => {
            const genre = 'Test Action';
            
            // Create feedback entries simulating confirmations
            for (let i = 0; i < 3; i++) {
                await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, item_metadata, status
                    )
                    VALUES ($1, 'Test Movie ${i}', 'movie', $2, $3, 'completed')
                    RETURNING id
                `, [1000 + i, testLibraryId, JSON.stringify({ genres: [genre] })]);

                const classId = (await db.query('SELECT id FROM classification_history ORDER BY id DESC LIMIT 1')).rows[0].id;

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', 'Test Movie ${i}', 'verify', $2, false, NOW())
                `, [1000 + i, testLibraryId]);
            }

            // Call learning service
            const result = await autoLearningService.learnGenrePreference(
                testLibraryId,
                genre,
                { userId: 'test-user-genre' }
            );

            expect(result.learned).toBe(true);
            expect(result.confirmCount).toBeGreaterThanOrEqual(3);

            // Verify it was added to preferences
            const pref = await db.query(`
                SELECT * FROM auto_learned_preferences
                WHERE library_id = $1 AND preference_type = 'genre_prefer' AND preference_value = $2
            `, [testLibraryId, genre]);

            expect(pref.rows.length).toBe(1);
            expect(pref.rows[0].status).toBe('active');

            // Cleanup
            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 1000 AND tmdb_id < 1010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 1000 AND tmdb_id < 1010');
        });

        test('should not learn genre with insufficient confirmations', async () => {
            const genre = 'Test Drama';
            
            // Create only 2 feedback entries (below threshold of 3)
            for (let i = 0; i < 2; i++) {
                await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, item_metadata, status
                    )
                    VALUES ($1, 'Test Movie ${i}', 'movie', $2, $3, 'completed')
                `, [2000 + i, testLibraryId, JSON.stringify({ genres: [genre] })]);

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', 'Test Movie ${i}', 'verify', $2, false, NOW())
                `, [2000 + i, testLibraryId]);
            }

            const result = await autoLearningService.learnGenrePreference(
                testLibraryId,
                genre,
                { userId: 'test-user-insufficient' }
            );

            expect(result.learned).toBe(false);
            expect(result.reason).toBe('insufficient_confidence');

            // Cleanup
            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 2000 AND tmdb_id < 2010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 2000 AND tmdb_id < 2010');
        });
    });

    describe('Conflict Detection', () => {
        test('should detect conflict when genre is in exclude list', async () => {
            const genre = 'Test Horror';

            // Add genre to exclude list
            await db.query(`
                UPDATE policy_presets
                SET custom_signals = jsonb_set(
                    COALESCE(custom_signals, '{}'),
                    '{genres,exclude}',
                    '["${genre}"]'::jsonb
                )
                WHERE policy_id = $1
            `, [testPolicyId]);

            const conflict = await autoLearningService.detectIntraLibraryConflict(
                testLibraryId,
                genre,
                'genre_prefer'
            );

            expect(conflict.conflict).toBe(true);
            expect(conflict.type).toBe('intra_library_exclusion');

            // Verify conflict was logged
            const conflictLog = await db.query(`
                SELECT * FROM learning_conflicts
                WHERE library_id = $1 AND preference_value = $2
            `, [testLibraryId, genre]);

            expect(conflictLog.rows.length).toBeGreaterThan(0);

            // Cleanup
            await db.query(`
                UPDATE policy_presets
                SET custom_signals = '{}'::jsonb
                WHERE policy_id = $1
            `, [testPolicyId]);
            await db.query('DELETE FROM learning_conflicts WHERE library_id = $1', [testLibraryId]);
        });
    });

    describe('Learn From Feedback', () => {
        test('should learn multiple preference types from single feedback', async () => {
            // Create sufficient history for learning
            const genres = ['Sci-Fi', 'Adventure'];
            const keywords = ['space', 'exploration', 'aliens', 'future', 'technology'];
            const studio = 'Test Studios';

            // Create 5 confirmations with same signals
            for (let i = 0; i < 5; i++) {
                await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id, title, media_type, library_id, item_metadata, status
                    )
                    VALUES ($1, 'Test Sci-Fi Movie ${i}', 'movie', $2, $3, 'completed')
                `, [3000 + i, testLibraryId, JSON.stringify({ genres, keywords, studio })]);

                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, prompt_type,
                        selected_library_id, was_correction, prompted_at
                    )
                    VALUES ($1, 'movie', 'Test Sci-Fi Movie ${i}', 'verify', $2, false, NOW())
                `, [3000 + i, testLibraryId]);
            }

            const result = await autoLearningService.learnFromFeedback({
                tmdbId: 3000,
                libraryId: testLibraryId,
                genres: genres,
                keywords: keywords.slice(0, 5),
                studio: studio,
                wasCorrection: false,
                userId: 'test-user-multi'
            });

            expect(result.learned).toBe(true);
            expect(result.count).toBeGreaterThan(0);

            // Cleanup
            await db.query('DELETE FROM classification_history WHERE tmdb_id >= 3000 AND tmdb_id < 3010');
            await db.query('DELETE FROM policy_feedback_log WHERE tmdb_id >= 3000 AND tmdb_id < 3010');
            await db.query('DELETE FROM auto_learned_preferences WHERE library_id = $1', [testLibraryId]);
            await db.query('DELETE FROM learning_rate_limits WHERE library_id = $1', [testLibraryId]);
        });
    });

    describe('Admin Functions', () => {
        test('should retrieve learned preferences for a library', async () => {
            // Insert a test preference
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

            // Cleanup
            await db.query('DELETE FROM auto_learned_preferences WHERE library_id = $1', [testLibraryId]);
        });
    });
});
