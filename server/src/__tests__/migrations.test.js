/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

const fs = require('fs');
const path = require('path');

describe('Migration Path Resolution', () => {
    const originalEnv = process.env;

    afterEach(() => {
        // Restore original environment after each test
        process.env = originalEnv;
    });

    test('should resolve migrations directory to absolute path', () => {
        // Use isolateModules to get a fresh instance
        jest.isolateModules(() => {
            const migrationRunner = require('../config/migrations');
            
            // Verify the resolved path is absolute
            expect(path.isAbsolute(migrationRunner.migrationsDir)).toBe(true);
            
            // Verify it resolves to the expected default path
            const expectedPath = path.resolve(__dirname, '../../../database/migrations');
            expect(migrationRunner.migrationsDir).toBe(expectedPath);
        });
    });

    test('should support MIGRATIONS_DIR environment variable override', () => {
        const customPath = '/custom/migrations/path';
        
        // Use isolateModules to get a fresh instance with new env var
        jest.isolateModules(() => {
            process.env.MIGRATIONS_DIR = customPath;
            const migrationRunner = require('../config/migrations');
            
            // Verify the constructor respected the env var override
            expect(migrationRunner.migrationsDir).toBe(customPath);
        });
    });

    test('should support SCHEMA_FILE environment variable override', () => {
        const customSchemaPath = '/custom/schema/current.sql';
        
        // Use isolateModules to get a fresh instance with new env var
        jest.isolateModules(() => {
            process.env.SCHEMA_FILE = customSchemaPath;
            const migrationRunner = require('../config/migrations');
            
            // Verify the constructor respected the env var override
            expect(migrationRunner.schemaFile).toBe(customSchemaPath);
        });
    });

    test('init.sql should use script-relative migration includes', () => {
        const initSqlPath = path.resolve(__dirname, '../../../database/init.sql');
        const initSql = fs.readFileSync(initSqlPath, 'utf8');

        expect(initSql).toContain('\\ir migrations/001_add_arr_settings.sql');
        expect(initSql).not.toContain('/app/database/migrations/');
    });
});

describe('Migration Sorting', () => {
    // Import helper functions for testing
    const { getMigrationSortKey, compareMigrations } = require('../config/migrations');

    test('getMigrationSortKey should handle numeric migrations', () => {
        expect(getMigrationSortKey('001_initial.sql')).toBe('00000000_000000_0000000001');
        expect(getMigrationSortKey('076_latest.sql')).toBe('00000000_000000_0000000076');
    });

    test('getMigrationSortKey should handle timestamp migrations', () => {
        expect(getMigrationSortKey('20260201_150000_feature.sql')).toBe('20260201_150000');
        expect(getMigrationSortKey('20260201_160000_another.sql')).toBe('20260201_160000');
    });

    test('compareMigrations should sort numeric before timestamp', () => {
        const files = [
            '20260201_150000_feature.sql',
            '001_initial.sql',
            '076_latest.sql',
            '20260201_140000_another.sql'
        ];

        const sorted = files.sort(compareMigrations);

        expect(sorted[0]).toBe('001_initial.sql');
        expect(sorted[1]).toBe('076_latest.sql');
        expect(sorted[2]).toBe('20260201_140000_another.sql');
        expect(sorted[3]).toBe('20260201_150000_feature.sql');
    });
});
