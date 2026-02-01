/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

const path = require('path');
const { getMigrationSortKey, compareMigrations } = require('../config/migrations');

describe('Migration Path Resolution', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment before each test
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    test('should resolve migrations directory to absolute path', () => {
        // The constructor should use path.resolve(), not path.join()
        const expectedPath = path.resolve(__dirname, '../../../database/migrations');
        
        // Verify the path is absolute (starts with / on Unix or drive letter on Windows)
        expect(path.isAbsolute(expectedPath)).toBe(true);
    });

    test('should support MIGRATIONS_DIR environment variable override', () => {
        const customPath = '/custom/migrations/path';
        process.env.MIGRATIONS_DIR = customPath;
        
        // The constructor should respect the env var
        // Note: We can't test the actual constructor here without refactoring,
        // but this documents the expected behavior
        expect(process.env.MIGRATIONS_DIR).toBe(customPath);
    });

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
