/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
const policyEngine = require('../../services/policyEngine');

describe('Event Detection Migration Tests (v0.37.0)', () => {
    const eventPresetKeys = [
        'event_holiday',
        'event_sports',
        'event_ppv',
        'event_concert',
        'event_standup',
        'event_awards'
    ];

    describe('Event Preset Creation', () => {
        test('should have all 6 event presets created', async () => {
            const result = await db.query(`
                SELECT key, name, category, icon, signals
                FROM content_presets
                WHERE category = 'events'
                ORDER BY key
            `);

            expect(result.rows.length).toBeGreaterThanOrEqual(6);

            const keys = result.rows.map(r => r.key);
            eventPresetKeys.forEach(key => {
                expect(keys).toContain(key);
            });
        });

        test('event_holiday preset should have correct keywords', async () => {
            const result = await db.query(`
                SELECT signals FROM content_presets WHERE key = 'event_holiday'
            `);

            expect(result.rows.length).toBe(1);
            const signals = result.rows[0].signals;

            expect(signals.keywords).toBeDefined();
            expect(signals.keywords.require_any).toBeDefined();
            expect(signals.keywords.require_any).toContain('christmas');
            expect(signals.keywords.require_any).toContain('halloween');
            expect(signals.keywords.require_any).toContain('thanksgiving');
        });

        test('event_sports preset should have correct keywords and genres', async () => {
            const result = await db.query(`
                SELECT signals FROM content_presets WHERE key = 'event_sports'
            `);

            expect(result.rows.length).toBe(1);
            const signals = result.rows[0].signals;

            expect(signals.keywords).toBeDefined();
            expect(signals.keywords.require_any).toContain('nfl');
            expect(signals.keywords.require_any).toContain('super bowl');
            expect(signals.keywords.require_any).toContain('olympics');
        });

        test('event_ppv preset should have combat sports keywords', async () => {
            const result = await db.query(`
                SELECT signals FROM content_presets WHERE key = 'event_ppv'
            `);

            expect(result.rows.length).toBe(1);
            const signals = result.rows[0].signals;

            expect(signals.keywords.require_any).toContain('ufc');
            expect(signals.keywords.require_any).toContain('mma');
            expect(signals.keywords.require_any).toContain('boxing');
            expect(signals.keywords.require_any).toContain('wrestlemania');
        });
    });

    describe('Event Preset Signal Matching', () => {
        test('should match holiday content via preset', async () => {
            const item = {
                title: 'A Christmas Story',
                media_type: 'movie',
                genres: ['Comedy', 'Family'],
                keywords: ['christmas', 'holiday', 'family'],
                overview: 'A Christmas classic about a boy who wants a BB gun for Christmas'
            };

            // Get the holiday preset
            const presetResult = await db.query(`
                SELECT id, signals FROM content_presets WHERE key = 'event_holiday'
            `);

            expect(presetResult.rows.length).toBe(1);

            const preset = presetResult.rows[0];
            const signals = preset.signals;

            // Check that the item would match the preset's keywords
            const itemText = [
                item.title.toLowerCase(),
                item.overview.toLowerCase(),
                ...item.keywords
            ].join(' ');

            const hasMatch = signals.keywords.require_any.some(keyword =>
                itemText.includes(keyword.toLowerCase())
            );

            expect(hasMatch).toBe(true);
        });

        test('should match sports content via preset', async () => {
            const item = {
                title: '30 for 30: The Last Dance',
                media_type: 'movie',
                genres: ['Documentary', 'Sport'],
                keywords: ['nba', 'basketball', 'championship'],
                overview: 'Documentary about Michael Jordan and the Chicago Bulls'
            };

            const presetResult = await db.query(`
                SELECT signals FROM content_presets WHERE key = 'event_sports'
            `);

            const signals = presetResult.rows[0].signals;
            const itemText = [
                item.title.toLowerCase(),
                item.overview.toLowerCase(),
                ...item.keywords
            ].join(' ');

            const hasMatch = signals.keywords.require_any.some(keyword =>
                itemText.includes(keyword.toLowerCase())
            );

            expect(hasMatch).toBe(true);
        });

        test('should match PPV content via preset', async () => {
            const item = {
                title: 'UFC 300: Main Event',
                media_type: 'movie',
                genres: ['Sport'],
                keywords: ['ufc', 'mma', 'fight', 'ppv'],
                overview: 'Ultimate Fighting Championship pay-per-view event'
            };

            const presetResult = await db.query(`
                SELECT signals FROM content_presets WHERE key = 'event_ppv'
            `);

            const signals = presetResult.rows[0].signals;
            const itemText = [
                item.title.toLowerCase(),
                item.overview.toLowerCase(),
                ...item.keywords
            ].join(' ');

            const hasMatch = signals.keywords.require_any.some(keyword =>
                itemText.includes(keyword.toLowerCase())
            );

            expect(hasMatch).toBe(true);
        });
    });

    describe('PolicyEngine Integration with Event Presets', () => {
        let testLibraryId;
        let testPolicyId;
        let holidayPresetId;
        let testMediaServerId;

        beforeAll(async () => {
            // Create test media server
            const serverRes = await db.query(`
                INSERT INTO media_server (type, name, url, api_key)
                VALUES ('plex', 'Test Event Server', 'http://localhost:32400', 'test-event-key')
                ON CONFLICT DO NOTHING
                RETURNING id
            `);

            if (serverRes.rows.length > 0) {
                testMediaServerId = serverRes.rows[0].id;
            } else {
                const existingServer = await db.query(`SELECT id FROM media_server LIMIT 1`);
                testMediaServerId = existingServer.rows[0].id;
            }

            // Create test library for holiday content
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-event-lib-' || gen_random_uuid()::text, 'Test Holiday Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            testLibraryId = libRes.rows[0].id;

            // Get holiday preset
            const presetRes = await db.query(`
                SELECT id FROM content_presets WHERE key = 'event_holiday'
            `);
            holidayPresetId = presetRes.rows[0].id;

            // Create policy with holiday preset
            // NOTE: Threshold set to 75 because event_holiday preset uses require_any keywords (returns 80 score)
            // 80 > 75 will trigger auto_classify; if threshold was 85, would get prompt_confirm instead
            const policyRes = await db.query(`
                INSERT INTO library_policies (
                    library_id, name, enabled,
                    auto_classify_threshold, prompt_threshold,
                    trust_patterns, trust_rag, trust_history,
                    preset_weight, pattern_weight, rag_weight, history_weight
                ) VALUES ($1, 'Holiday Policy', true, 75, 60, false, false, false, 1.0, 0.0, 0.0, 0.0)
                RETURNING id
            `, [testLibraryId]);
            testPolicyId = policyRes.rows[0].id;

            // Link holiday preset to policy
            await db.query(`
                INSERT INTO policy_presets (policy_id, preset_id, weight)
                VALUES ($1, $2, 2.0)
            `, [testPolicyId, holidayPresetId]);
        });

        afterAll(async () => {
            if (testPolicyId) {
                await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
            }
            if (testLibraryId) {
                await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
            }
        });

        test('PolicyEngine should classify holiday content using event preset', async () => {
            // Holiday item - keywords match event_holiday preset's require_any (returns 80 score)
            // 80 > 75 threshold = auto_classify
            const item = {
                title: 'Elf',
                media_type: 'movie',
                genres: ['Comedy', 'Family'],
                keywords: ['christmas', 'santa', 'holiday', 'north pole'],
                overview: 'A human raised at the North Pole travels to New York to find his father'
            };

            const result = await policyEngine.evaluateItem(item);

            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBeGreaterThanOrEqual(75); // Threshold is 75, preset score is ~80
            expect(result.library.library_id).toBe(testLibraryId);
        });

        test('PolicyEngine should not match non-holiday content', async () => {
            const item = {
                title: 'Die Hard',
                media_type: 'movie',
                genres: ['Action', 'Thriller'],
                keywords: ['action', 'thriller', 'police'],
                overview: 'An action thriller about a cop fighting terrorists'
            };

            const result = await policyEngine.evaluateItem(item);

            // Should not auto-classify to holiday library
            if (result.action === 'auto_classify') {
                expect(result.library.library_id).not.toBe(testLibraryId);
            }
        });
    });

    describe('Backward Compatibility', () => {
        test('detectEventContent should be deprecated but still callable', async () => {
            const classificationService = require('../../services/classification');

            // Method should exist but log deprecation warning
            expect(typeof classificationService.detectEventContent).toBe('function');

            // Call it to ensure it doesn't crash (though it will log a warning)
            const metadata = {
                title: 'Christmas Movie',
                overview: 'A Christmas story',
                genres: ['Family'],
                keywords: ['christmas']
            };
            const libraries = [];

            // Should not throw an error
            await classificationService.detectEventContent(metadata, libraries);
            // Result might be null since we're passing empty libraries
        });
    });
});
