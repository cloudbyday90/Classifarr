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

const { setupTestDB, teardownTestDB, getTestDB } = require('./setup');
const legacyMigration = require('../../services/legacyMigration');

describe('Legacy Migration Integration Tests', () => {
    let db;

    beforeAll(async () => {
        db = await setupTestDB();
    }, 60000);

    afterAll(async () => {
        await teardownTestDB();
    });

    describe('Migration Status', () => {
        beforeEach(async () => {
            // Clean up
            await db.query('DELETE FROM library_custom_rules');
            await db.query('DELETE FROM libraries');
            
            // Create test library
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES (1, 'Test Library', 'movie', '/movies')
            `);
        });

        test('should return correct migration status', async () => {
            // Insert test rules
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    (1, 'Rule 1', 'Test rule 1', '{"field": "genres", "value": "Action"}', true),
                    (1, 'Rule 2', 'Test rule 2', '{"field": "genres", "value": "Comedy"}', true)
            `);

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
                VALUES (1, 'Rule 1', 'Test rule 1', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `);
            const ruleId = result.rows[0].id;

            await db.query(`
                UPDATE library_custom_rules 
                SET migrated_at = NOW(), migration_type = 'preset'
                WHERE id = $1
            `, [ruleId]);

            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES (1, 'Rule 2', 'Test rule 2', '{"field": "genres", "value": "Comedy"}', true)
            `);

            const status = await legacyMigration.getMigrationStatus();

            expect(status.total).toBe(2);
            expect(status.pending).toBe(1);
            expect(status.migrated).toBe(1);
        });
    });

    describe('Libraries with Legacy Rules', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM library_custom_rules');
            await db.query('DELETE FROM libraries');
        });

        test('should list libraries with unmigrated rules', async () => {
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES 
                    (1, 'Library A', 'movie', '/movies'),
                    (2, 'Library B', 'tv', '/tv')
            `);

            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    (1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true),
                    (1, 'Rule 2', 'Test', '{"field": "genres", "value": "Comedy"}', true),
                    (2, 'Rule 3', 'Test', '{"field": "genres", "value": "Drama"}', true)
            `);

            const libraries = await legacyMigration.getLibrariesWithLegacyRules();

            expect(libraries).toHaveLength(2);
            expect(libraries[0].library_name).toBe('Library A');
            expect(libraries[0].rule_count).toBe('2');
            expect(libraries[1].library_name).toBe('Library B');
            expect(libraries[1].rule_count).toBe('1');
        });

        test('should not list libraries with only migrated rules', async () => {
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES (1, 'Library A', 'movie', '/movies')
            `);

            const result = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active, migrated_at)
                VALUES (1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true, NOW())
                RETURNING id
            `);

            const libraries = await legacyMigration.getLibrariesWithLegacyRules();

            expect(libraries).toHaveLength(0);
        });
    });

    describe('Rule Analysis', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM content_presets');
            await db.query('DELETE FROM library_custom_rules');
            await db.query('DELETE FROM libraries');

            // Create test library
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES (1, 'Test Library', 'movie', '/movies')
            `);

            // Create test preset
            await db.query(`
                INSERT INTO content_presets (id, key, name, signals, is_system)
                VALUES (1, 'action', 'Action Movies', 
                    '{"genres": {"require_any": ["Action", "Adventure"]}}', true)
            `);
        });

        test('should analyze genre-based rule and suggest preset', async () => {
            const result = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES (1, 'Action Rule', 'Action movies', '{"field": "genres", "value": "Action"}', true)
                RETURNING *
            `);

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
                VALUES (1, 'Custom Rule', 'Custom', '{"field": "tmdb_id", "value": "12345"}', true)
                RETURNING *
            `);

            const rule = result.rows[0];
            const analysis = await legacyMigration.analyzeRule(rule);

            expect(analysis.suggestions).toBeDefined();
            expect(analysis.suggestions.length).toBeGreaterThan(0);
            expect(analysis.suggestions[0].type).toBe('override');
        });
    });

    describe('Rule Migration', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM policy_presets');
            await db.query('DELETE FROM policy_overrides');
            await db.query('DELETE FROM library_policies');
            await db.query('DELETE FROM content_presets');
            await db.query('DELETE FROM library_custom_rules');
            await db.query('DELETE FROM libraries');

            // Create test library
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES (1, 'Test Library', 'movie', '/movies')
            `);

            // Create test preset
            await db.query(`
                INSERT INTO content_presets (id, key, name, signals, is_system)
                VALUES (1, 'action', 'Action Movies', 
                    '{"genres": {"require_any": ["Action"]}}', true)
            `);
        });

        test('should migrate rule to preset', async () => {
            const ruleResult = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES (1, 'Action Rule', 'Test', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `);

            const ruleId = ruleResult.rows[0].id;

            const migrationChoice = {
                type: 'preset',
                preset_id: 1
            };

            await legacyMigration.migrateRule(ruleId, migrationChoice, 1);

            // Verify rule is marked as migrated
            const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [ruleId]);
            expect(rule.rows[0].migrated_at).toBeTruthy();
            expect(rule.rows[0].migration_type).toBe('preset');

            // Verify policy was created and preset linked
            const policyPresets = await db.query('SELECT * FROM policy_presets WHERE preset_id = 1');
            expect(policyPresets.rows.length).toBe(1);
        });

        test('should migrate rule to override', async () => {
            const ruleResult = await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES (1, 'Custom Rule', 'Test', '{"field": "tmdb_id", "value": "12345"}', true)
                RETURNING id
            `);

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

            await legacyMigration.migrateRule(ruleId, migrationChoice, 1);

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
                VALUES (1, 'Test Rule', 'Test', '{"field": "genres", "value": "Action"}', true)
                RETURNING id
            `);

            const ruleId = ruleResult.rows[0].id;

            const migrationChoice = {
                type: 'preset',
                preset_id: 9999 // Non-existent preset
            };

            await expect(
                legacyMigration.migrateRule(ruleId, migrationChoice, 1)
            ).rejects.toThrow();

            // Verify rule is NOT marked as migrated
            const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [ruleId]);
            expect(rule.rows[0].migrated_at).toBeNull();
        });
    });

    describe('Bulk Migration', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM policy_presets');
            await db.query('DELETE FROM library_policies');
            await db.query('DELETE FROM content_presets');
            await db.query('DELETE FROM library_custom_rules');
            await db.query('DELETE FROM libraries');

            // Create test library
            await db.query(`
                INSERT INTO libraries (id, name, media_type, path)
                VALUES (1, 'Test Library', 'movie', '/movies')
            `);

            // Create test preset
            await db.query(`
                INSERT INTO content_presets (id, key, name, signals, is_system)
                VALUES (1, 'action', 'Action Movies', 
                    '{"genres": {"require_any": ["Action"]}}', true)
            `);
        });

        test('should bulk migrate all rules in a library', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES 
                    (1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true),
                    (1, 'Rule 2', 'Test', '{"field": "genres", "value": "Action"}', true)
            `);

            const results = await legacyMigration.migrateLibrary(1, 1, true);

            expect(results).toHaveLength(2);
            expect(results.filter(r => r.migrated).length).toBe(2);

            // Verify all rules are migrated
            const unmigrated = await db.query(
                'SELECT * FROM library_custom_rules WHERE library_id = 1 AND migrated_at IS NULL'
            );
            expect(unmigrated.rows.length).toBe(0);
        });

        test('should return suggestions when auto-migrate is disabled', async () => {
            await db.query(`
                INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
                VALUES (1, 'Rule 1', 'Test', '{"field": "genres", "value": "Action"}', true)
            `);

            const results = await legacyMigration.migrateLibrary(1, 1, false);

            expect(results).toHaveLength(1);
            expect(results[0].migrated).toBe(false);
            expect(results[0].suggestions).toBeDefined();
        });
    });
});
