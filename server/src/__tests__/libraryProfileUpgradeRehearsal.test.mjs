/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import {
    BASELINE_COMMIT,
    BASELINE_TAG,
    createIsolatedDbClient,
    readPinnedReleaseSchema,
    rehearseLibraryProfileUpgrade,
} from '../scripts/libraryProfileUpgradeRehearsal.mjs';

describe('pinned library profile upgrade rehearsal', () => {
    test('loads only the expected published release schema', () => {
        const commands = [];
        const git = (_binary, args) => {
            commands.push(args);
            return args[0] === 'rev-parse'
                ? `${BASELINE_COMMIT}\n`
                : '-- Latest Migration: 20260829_110000_add_ollama_verification_capability_outcome_history.sql\nCREATE TABLE public.schema_migrations (';
        };
        expect(readPinnedReleaseSchema({ git, repoRoot: '/fixture' })).toContain('schema_migrations');
        expect(commands).toEqual([
            ['rev-parse', `refs/tags/${BASELINE_TAG}^{commit}`],
            ['show', `${BASELINE_COMMIT}:database/schema/current.sql`],
        ]);
    });

    test('rejects a moved release tag before reading its schema', () => {
        const git = jest.fn(() => 'different-commit');
        expect(() => readPinnedReleaseSchema({ git, repoRoot: '/fixture' })).toThrow('differs from the pinned commit');
        expect(git).toHaveBeenCalledTimes(1);
    });

    test('uses a single client and rolls back failed transactions', async () => {
        const statements = [];
        const connection = {
            query: async sql => { statements.push(sql); return { rows: [] }; },
            release: jest.fn(),
        };
        const dbClient = createIsolatedDbClient({
            query: connection.query,
            connect: async () => connection,
        });
        await expect(dbClient.withTransaction(async client => {
            await client.query('SELECT 1');
            throw new Error('synthetic failure');
        })).rejects.toThrow('synthetic failure');
        expect(statements).toEqual(['BEGIN', 'SELECT 1', 'ROLLBACK']);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });

    test('refuses an existing database before applying any release schema', async () => {
        const queries = [];
        const dbClient = {
            withTransaction: async () => {},
            query: async sql => {
                queries.push(sql);
                return { rows: [{ name: 'classifarr_rehearsal', libraries: 'libraries', ledger: null }] };
            },
        };
        await expect(rehearseLibraryProfileUpgrade({
            dbClient,
            releaseSchema: 'CREATE TABLE public.schema_migrations (',
            migrationsDir: '/fixture',
        })).rejects.toThrow('empty, named rehearsal database');
        expect(queries).toHaveLength(1);
        expect(queries[0]).toContain('current_database()');
    });

    test('refuses a non-rehearsal database even when it is empty', async () => {
        const dbClient = {
            withTransaction: async () => {},
            query: jest.fn(async () => ({ rows: [{ name: 'classifarr', libraries: null, ledger: null }] })),
        };
        await expect(rehearseLibraryProfileUpgrade({
            dbClient,
            releaseSchema: 'CREATE TABLE public.schema_migrations (',
            migrationsDir: '/fixture',
        })).rejects.toThrow('empty, named rehearsal database');
        expect(dbClient.query).toHaveBeenCalledTimes(1);
    });
});
