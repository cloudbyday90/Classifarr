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

describe('Migration System Tests', () => {
    describe('Migration Filename Sorting', () => {
        // Test the sorting logic used in MigrationRunner.getMigrationFiles()
        test('should sort numeric migrations before timestamp migrations', () => {
            const files = [
                '20260201_150000_new_feature.sql',
                '076_remove_duplicate_discord.sql',
                '20260201_140000_another_feature.sql',
                '001_initial_schema.sql',
                '20260201_160000_latest_feature.sql',
                '050_middle_migration.sql'
            ];

            const sorted = files.sort((a, b) => {
                const getVersion = (filename) => {
                    // Timestamp format: 20260201_150000_description.sql
                    const timestampMatch = filename.match(/^(\d{8}_\d{6})_/);
                    if (timestampMatch) {
                        return timestampMatch[1];
                    }
                    
                    // Numeric format: 076_description.sql
                    const numericMatch = filename.match(/^(\d+)_/);
                    if (numericMatch) {
                        // Pad to ensure numeric sorts before timestamps
                        return '00000000_000000_' + numericMatch[1].padStart(10, '0');
                    }
                    
                    return filename;
                };
                
                return getVersion(a).localeCompare(getVersion(b));
            });

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

            const sorted = files.sort((a, b) => {
                const getVersion = (filename) => {
                    const timestampMatch = filename.match(/^(\d{8}_\d{6})_/);
                    if (timestampMatch) {
                        return timestampMatch[1];
                    }
                    
                    const numericMatch = filename.match(/^(\d+)_/);
                    if (numericMatch) {
                        return '00000000_000000_' + numericMatch[1].padStart(10, '0');
                    }
                    
                    return filename;
                };
                
                return getVersion(a).localeCompare(getVersion(b));
            });

            expect(sorted[0]).toBe('001_first_numeric.sql');
            expect(sorted[1]).toBe('999_last_numeric.sql');
            expect(sorted[2]).toBe('20260101_000000_first_timestamp.sql');
            expect(sorted[3]).toBe('20269999_235959_far_future.sql');
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
            // The migration should already be applied, running it again should not error
            const migrationSQL = `
                CREATE TABLE IF NOT EXISTS schema_migrations_new (
                  id SERIAL PRIMARY KEY,
                  filename VARCHAR(255) UNIQUE NOT NULL,
                  applied_at TIMESTAMP DEFAULT NOW(),
                  migration_type VARCHAR(50) DEFAULT 'sql',
                  description TEXT
                );

                INSERT INTO schema_migrations_new (filename, applied_at)
                SELECT filename, applied_at
                FROM schema_migrations
                ON CONFLICT (filename) DO NOTHING;

                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations' AND table_schema = 'public') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'migration_type') THEN
                      DROP TABLE schema_migrations;
                      ALTER TABLE schema_migrations_new RENAME TO schema_migrations;
                    END IF;
                  ELSE
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations_new' AND table_schema = 'public') THEN
                      ALTER TABLE schema_migrations_new RENAME TO schema_migrations;
                    END IF;
                  END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied 
                  ON schema_migrations(applied_at DESC);
                CREATE INDEX IF NOT EXISTS idx_schema_migrations_type 
                  ON schema_migrations(migration_type);
            `;

            // Should not throw an error when run multiple times
            await expect(db.query(migrationSQL)).resolves.not.toThrow();
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
            // Check for at least one timestamp-based migration
            const result = await db.query(`
                SELECT filename FROM schema_migrations 
                WHERE filename ~ '^\\d{8}_\\d{6}_'
                ORDER BY filename
                LIMIT 1
            `);

            // Should have at least the conversion migration
            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].filename).toMatch(/^20260201_000000_/);
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
