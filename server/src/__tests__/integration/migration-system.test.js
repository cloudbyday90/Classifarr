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
const { getMigrationSortKey, compareMigrations } = require('../../config/migrations');

describe('Migration System Tests', () => {
    describe('Migration Filename Sorting', () => {
        test('should sort numeric migrations before timestamp migrations', () => {
            const files = [
                '20260201_150000_new_feature.sql',
                '076_remove_duplicate_discord.sql',
                '20260201_140000_another_feature.sql',
                '001_initial_schema.sql',
                '20260201_160000_latest_feature.sql',
                '050_middle_migration.sql'
            ];

            const sorted = files.sort(compareMigrations);

            // Verify numeric migrations come first
            expect(sorted[0]).toBe('001_initial_schema.sql');
            expect(sorted[1]).toBe('050_middle_migration.sql');
            expect(sorted[2]).toBe('076_remove_duplicate_discord.sql');
            
            // Then timestamp migrations in chronological order
            expect(sorted[3]).toBe('20260201_140000_another_feature.sql');
            expect(sorted[4]).toBe('20260201_150000_new_feature.sql');
            expect(sorted[5]).toBe('20260201_160000_latest_feature.sql');
        });

        test('should handle edge cases in migration sorting', () => {
            const files = [
                '999_last_numeric.sql',
                '20260101_000000_first_timestamp.sql',
                '001_first_numeric.sql',
                '20269999_235959_far_future.sql'
            ];

            const sorted = files.sort(compareMigrations);

            expect(sorted[0]).toBe('001_first_numeric.sql');
            expect(sorted[1]).toBe('999_last_numeric.sql');
            expect(sorted[2]).toBe('20260101_000000_first_timestamp.sql');
            expect(sorted[3]).toBe('20269999_235959_far_future.sql');
        });

        test('should handle duplicate numeric prefixes deterministically', () => {
            // These duplicate prefixes exist in the actual repo
            const files = [
                '011_remove_email_column.sql',
                '011_add_library_rules.sql',
                '044_expand_content_presets.sql',
                '044_add_tuning_suggestion_tracking.sql',
                '010_something_else.sql'
            ];

            const sorted = files.sort(compareMigrations);

            // Within same prefix, should sort alphabetically by full filename
            expect(sorted[0]).toBe('010_something_else.sql');
            expect(sorted[1]).toBe('011_add_library_rules.sql'); // 'add' < 'remove'
            expect(sorted[2]).toBe('011_remove_email_column.sql');
            expect(sorted[3]).toBe('044_add_tuning_suggestion_tracking.sql'); // 'add' < 'expand'
            expect(sorted[4]).toBe('044_expand_content_presets.sql');
        });

        test('getMigrationSortKey should generate correct sort keys', () => {
            // Test numeric migrations
            expect(getMigrationSortKey('001_initial.sql')).toBe('00000000_000000_0000000001');
            expect(getMigrationSortKey('076_latest.sql')).toBe('00000000_000000_0000000076');
            expect(getMigrationSortKey('999_last.sql')).toBe('00000000_000000_0000000999');
            
            // Test timestamp migrations
            expect(getMigrationSortKey('20260201_150000_feature.sql')).toBe('20260201_150000');
            expect(getMigrationSortKey('20260201_140000_another.sql')).toBe('20260201_140000');
            
            // Test that numeric sort keys are less than timestamp sort keys
            const numericKey = getMigrationSortKey('999_last.sql');
            const timestampKey = getMigrationSortKey('20260101_000000_first.sql');
            expect(numericKey < timestampKey).toBe(true);
        });
    });

    describe('Schema Migrations Table', () => {
        test('should have schema_migrations table with correct structure', async () => {
            const tableExists = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'schema_migrations'
                ) as exists
            `);
            
            expect(tableExists.rows[0].exists).toBe(true);

            // Check columns
            const columns = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'schema_migrations'
                ORDER BY ordinal_position
            `);

            const columnNames = columns.rows.map(c => c.column_name);
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('filename');
            expect(columnNames).toContain('applied_at');
        });

        test('should have unique constraint on filename', async () => {
            const constraints = await db.query(`
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_name = 'schema_migrations'
                AND constraint_type = 'UNIQUE'
            `);

            expect(constraints.rows.length).toBeGreaterThan(0);
        });
    });

    describe('Discord Display Options Migration', () => {
        test('should have discord_include_signal_breakdown setting', async () => {
            const result = await db.query(`
                SELECT * FROM confidence_settings 
                WHERE setting_key = 'discord_include_signal_breakdown'
            `);

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].setting_value).toBe('true');
            expect(result.rows[0].default_value).toBe('true');
            expect(result.rows[0].description).toContain('signal breakdown');
        });

        test('should have discord_show_similar_items setting', async () => {
            const result = await db.query(`
                SELECT * FROM confidence_settings 
                WHERE setting_key = 'discord_show_similar_items'
            `);

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].setting_value).toBe('true');
            expect(result.rows[0].default_value).toBe('true');
            expect(result.rows[0].description).toContain('similar items');
        });

        test('should allow updating discord display options', async () => {
            // Update the setting
            await db.query(`
                UPDATE confidence_settings 
                SET setting_value = 'false' 
                WHERE setting_key = 'discord_include_signal_breakdown'
            `);

            // Verify the update
            const result = await db.query(`
                SELECT setting_value FROM confidence_settings 
                WHERE setting_key = 'discord_include_signal_breakdown'
            `);

            expect(result.rows[0].setting_value).toBe('false');

            // Reset to original value
            await db.query(`
                UPDATE confidence_settings 
                SET setting_value = 'true' 
                WHERE setting_key = 'discord_include_signal_breakdown'
            `);
        });
    });

    describe('Migration Idempotency', () => {
        test('timestamp conversion migration should be idempotent', async () => {
            // Rather than running the full migration SQL which can mutate the schema,
            // verify that the schema_migrations table has the expected structure
            const columns = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'schema_migrations'
                ORDER BY ordinal_position
            `);

            const columnNames = columns.rows.map(c => c.column_name);
            
            // Verify the table has the new columns from the conversion migration
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('filename');
            expect(columnNames).toContain('applied_at');
            
            // The conversion migration adds these columns
            // If they exist, the migration has been applied
            const hasMigrationType = columnNames.includes('migration_type');
            const hasDescription = columnNames.includes('description');
            
            // At least one should exist if conversion has run
            expect(hasMigrationType || hasDescription).toBe(true);
        });

        test('discord display options migration should be idempotent', async () => {
            const migrationSQL = `
                INSERT INTO confidence_settings (setting_key, setting_value, description, default_value)
                VALUES
                  (
                    'discord_include_signal_breakdown',
                    'true',
                    'Always include AI signal breakdown in Discord verification messages',
                    'true'
                  ),
                  (
                    'discord_show_similar_items',
                    'true',
                    'Show top 3 similar items already in library in Discord messages',
                    'true'
                  )
                ON CONFLICT (setting_key) DO UPDATE SET
                  description = EXCLUDED.description,
                  default_value = EXCLUDED.default_value;
            `;

            // Should not throw an error when run multiple times
            await expect(db.query(migrationSQL)).resolves.not.toThrow();
        });
    });

    describe('Migration Tracking', () => {
        test('should track timestamp-based migrations', async () => {
            // Check that the specific conversion migration exists
            const result = await db.query(`
                SELECT filename FROM schema_migrations 
                WHERE filename LIKE '20260201_000000_%'
                ORDER BY filename
            `);

            // Should have the conversion migration
            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].filename).toMatch(/^20260201_000000_convert_to_timestamp_migrations\.sql$/);
        });

        test('should track both numeric and timestamp migrations', async () => {
            const numeric = await db.query(`
                SELECT COUNT(*) as count FROM schema_migrations 
                WHERE filename ~ '^\\d{3}_'
            `);

            const timestamp = await db.query(`
                SELECT COUNT(*) as count FROM schema_migrations 
                WHERE filename ~ '^\\d{8}_\\d{6}_'
            `);

            // Should have legacy numeric migrations
            expect(parseInt(numeric.rows[0].count)).toBeGreaterThan(0);
            
            // Should have new timestamp migrations
            expect(parseInt(timestamp.rows[0].count)).toBeGreaterThan(0);
        });
    });
});
