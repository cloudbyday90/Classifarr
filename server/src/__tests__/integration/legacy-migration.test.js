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
const legacyMigration = require('../../services/legacyMigration');
const { withConsoleSpy } = require('../setup/consoleHelpers');

describe('Legacy Migration Integration Tests', () => {
    let testLibraryId;
    let testMediaServerId;

    beforeAll(async () => {
        // Create a test media server
        const mediaServerResult = await db.query(`
            INSERT INTO media_server (name, type, url, api_key, is_active)
            VALUES ('Test Server', 'plex', 'http://localhost:32400', 'test-key', true)
            RETURNING id
        `);
        testMediaServerId = mediaServerResult.rows[0].id;

        // Create a test library
        const libraryResult = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
            VALUES ($1, 'test-lib-migration', 'Test Library', 'movie', true, 5)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libraryResult.rows[0].id;
    }, 60000);

    afterAll(async () => {
        // Cleanup
        if (testLibraryId) {
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
            await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        }
        if (testMediaServerId) {
            await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        }
    });

    describe('Migration Status', () => {
        beforeEach(async () => {
            // Clean up existing test data
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
        });

        test('should return correct migration status', async () => {
            // Insert test rules
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    ($1, 'Rule 1', 'Test rule 1', '{"field": "genres", "value": "Action"}', true),
                    ($1, 'Rule 2', 'Test rule 2', '{"field": "genres", "value": "Comedy"}', true)
            `, [testLibraryId]);

            const status = await legacyMigration.getMigrationStatus();

            expect(status).toBeDefined();
            expect(status.total).toBe(2);
            expect(status.pending).toBe(2);
            expect(status.migrated).toBe(0);
        });

        test('should track migrated rules correctly', async () => {
            // Insert and migrate one rule
            const result = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Rule 1', 'Test rule 1', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `, [testLibraryId]);
            const ruleId = result.rows[0].id;

            await db.query(`
                UPDATE library_custom_rules 
                SET migrated_at = NOW(), migration_type = 'preset'
                WHERE id = $1
            `, [ruleId]);

            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Rule 2', 'Test rule 2', '{"field": "genres", "value": "Comedy"}', true)
            `, [testLibraryId]);

            const status = await legacyMigration.getMigrationStatus();

            expect(status.total).toBe(2);
            expect(status.pending).toBe(1);
            expect(status.migrated).toBe(1);
        });
    });

    describe('Libraries with Legacy Rules', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
        });

        test('should list libraries with unmigrated rules', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    ($1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true),
                    ($1, 'Rule 2', 'Test', '{"field": "genres", "value": "Comedy"}', true)
            `, [testLibraryId]);

            const libraries = await legacyMigration.getLibrariesWithLegacyRules();

            const testLibrary = libraries.find(l => l.library_id === testLibraryId);
            expect(testLibrary).toBeDefined();
            expect(testLibrary.library_name).toBe('Test Library');
            expect(testLibrary.rule_count).toBe('2');
        });

        test('should not list libraries with only migrated rules', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active, migrated_at)
                VALUES ($1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true, NOW())
            `, [testLibraryId]);

            const libraries = await legacyMigration.getLibrariesWithLegacyRules();

            const testLibrary = libraries.find(l => l.library_id === testLibraryId);
            expect(testLibrary).toBeUndefined();
        });
    });

    describe('Rule Analysis', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
        });

        test('should analyze genre-based rule and suggest preset', async () => {
            const result = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Action Rule', 'Action movies', '{"field": "genres", "value": "Action"}', true)
                RETURNING *
            `, [testLibraryId]);

            const rule = result.rows[0];
            const analysis = await legacyMigration.analyzeRule(rule);

            expect(analysis.rule_id).toBe(rule.id);
            expect(analysis.suggestions).toBeDefined();
            expect(analysis.suggestions.length).toBeGreaterThan(0);
            
            const presetSuggestion = analysis.suggestions.find(s => s.type === 'preset');
            expect(presetSuggestion).toBeDefined();
        });

        test('should suggest override when no preset matches', async () => {
            const result = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Custom Rule', 'Custom', '{"field": "tmdb_id", "value": "12345"}', true)
                RETURNING *
            `, [testLibraryId]);

            const rule = result.rows[0];
            const analysis = await legacyMigration.analyzeRule(rule);

            expect(analysis.suggestions).toBeDefined();
            expect(analysis.suggestions.length).toBeGreaterThan(0);
            expect(analysis.suggestions[0].type).toBe('override');
        });
    });

    describe('Rule Migration', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
            await db.query('DELETE FROM policy_overrides');
            await db.query('DELETE FROM policy_presets');
            await db.query('DELETE FROM library_policies WHERE library_id = $1', [testLibraryId]);
        });

        test('should migrate rule to preset', async () => {
            // Get a system preset
            const presetResult = await db.query('SELECT id FROM content_presets WHERE is_system = true LIMIT 1');
            if (presetResult.rows.length === 0) {
                console.warn('No system presets found, skipping test');
                return;
            }
            const presetId = presetResult.rows[0].id;

            const ruleResult = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Action Rule', 'Test', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `, [testLibraryId]);

            const ruleId = ruleResult.rows[0].id;

            const migrationChoice = {
                type: 'preset',
                preset_id: presetId
            };

            await withConsoleSpy('log', async ({ getMessages }) => {
                await legacyMigration.migrateRule(ruleId, migrationChoice, null);
                expect(getMessages()).toContain('Rule migrated successfully');
                expect(getMessages()).toContain('migrationType');
            });

            // Verify rule is marked as migrated
            const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [ruleId]);
            expect(rule.rows[0].migrated_at).toBeTruthy();
            expect(rule.rows[0].migration_type).toBe('preset');

            // Verify policy was created and preset linked
            const policyPresets = await db.query('SELECT * FROM policy_presets WHERE preset_id = $1', [presetId]);
            expect(policyPresets.rows.length).toBe(1);
        });

        test('should migrate rule to override', async () => {
            const ruleResult = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Custom Rule', 'Test', '{"field": "tmdb_id", "value": "12345"}', true)
                RETURNING id
            `, [testLibraryId]);

            const ruleId = ruleResult.rows[0].id;

            const migrationChoice = {
                type: 'override',
                override_config: {
                    match_field: 'tmdb_id',
                    match_value: '12345',
                    priority: 100,
                    reason: 'Test migration'
                }
            };

            await withConsoleSpy('log', async ({ getMessages }) => {
                await legacyMigration.migrateRule(ruleId, migrationChoice, null);
                expect(getMessages()).toContain('Rule migrated successfully');
                expect(getMessages()).toContain('migrationType');
            });

            // Verify rule is marked as migrated
            const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [ruleId]);
            expect(rule.rows[0].migrated_at).toBeTruthy();
            expect(rule.rows[0].migration_type).toBe('override');

            // Verify override was created
            const overrides = await db.query('SELECT * FROM policy_overrides');
            expect(overrides.rows.length).toBe(1);
        });

        test('should rollback on migration error', async () => {
            const ruleResult = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Test Rule', 'Test', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `, [testLibraryId]);

            const ruleId = ruleResult.rows[0].id;

            await withConsoleSpy('error', async ({ getMessages }) => {
                const migrationChoice = {
                    type: 'preset',
                    preset_id: 9999 // Non-existent preset
                };

                await expect(
                    legacyMigration.migrateRule(ruleId, migrationChoice, null)
                ).rejects.toMatchObject({
                    code: 'PRESET_NOT_FOUND',
                    status: 404
                });

                expect(getMessages()).toContain('Migration failed');
                expect(getMessages()).toContain('Preset not found: 9999');
            });

            // Verify rule is NOT marked as migrated
            const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [ruleId]);
            expect(rule.rows[0].migrated_at).toBeNull();
        });
    });

    describe('Bulk Migration', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM library_custom_rules WHERE library_id = $1', [testLibraryId]);
            await db.query('DELETE FROM policy_presets');
            await db.query('DELETE FROM library_policies WHERE library_id = $1', [testLibraryId]);
        });

        test('should bulk migrate all rules in a library', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    ($1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true),
                    ($1, 'Rule 2', 'Test', '{"field": "genres", "value": "Action"}', true)
            `, [testLibraryId]);

            const results = await legacyMigration.migrateLibrary(testLibraryId, null, true);

            expect(results).toHaveLength(2);
            expect(results.filter(r => r.migrated).length).toBe(2);

            // Verify all rules are migrated
            const unmigrated = await db.query(
                'SELECT * FROM library_custom_rules WHERE library_id = $1 AND migrated_at IS NULL',
                [testLibraryId]
            );
            expect(unmigrated.rows.length).toBe(0);
        });

        test('should return suggestions when auto-migrate is disabled', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES ($1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true)
            `, [testLibraryId]);

            const results = await legacyMigration.migrateLibrary(testLibraryId, 1, false);

            expect(results).toHaveLength(1);
            expect(results[0].migrated).toBe(false);
            expect(results[0].suggestions).toBeDefined();
        });
    });
});
