/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../config/database', () => {
    const clientMock = { query: jest.fn() };
    const module = {
        query: jest.fn(),
        withTransaction: jest.fn(async (fn) => fn(clientMock)),
        _clientMock: clientMock
    };
    return module;
});

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

describe('LegacyMigrationService (legacyMigration.js)', () => {
    let legacyMigration;
    let clientMock;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        jest.mock('../config/database', () => {
            const clientMock = { query: jest.fn() };
            return {
                query: jest.fn(),
                withTransaction: jest.fn(async (fn) => fn(clientMock)),
                _clientMock: clientMock
            };
        });

        jest.mock('../utils/logger', () => ({
            createLogger: () => ({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn()
            })
        }));

        legacyMigration = require('../services/legacyMigration');
        const dbModule = require('../config/database');
        clientMock = dbModule._clientMock;
    });

    describe('migrateRule', () => {
        it('uses db.withTransaction for preset migration (not raw BEGIN/COMMIT)', async () => {
            const dbModule = require('../config/database');

            // Pool-level query: rule SELECT
            dbModule.query.mockResolvedValue({
                rows: [{ id: 10, library_id: 5 }]
            });

            // Pinned client queries inside the transaction
            clientMock.query
                .mockResolvedValueOnce({ rows: [{ id: 99 }] })                          // getOrCreatePolicy SELECT
                .mockResolvedValueOnce({ rows: [{ id: 7, is_system: true, is_public: false, user_id: null }] }) // content_presets SELECT
                .mockResolvedValueOnce({ rows: [] })                                    // policy_presets INSERT ON CONFLICT
                .mockResolvedValueOnce({ rowCount: 1 });                                // UPDATE library_custom_rules

            const result = await legacyMigration.migrateRule(10, { type: 'preset', preset_id: 7 }, 'user1');

            expect(dbModule.withTransaction).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ success: true });

            // Verify rule SELECT ran outside the transaction (via pool-level query)
            const ruleSelectCall = dbModule.query.mock.calls.find(
                ([sql]) => sql && sql.includes('library_custom_rules') && sql.includes('SELECT')
            );
            expect(ruleSelectCall).toBeDefined();

            // Verify content_presets and policy_presets ran on the pinned client
            const presetInsertCall = clientMock.query.mock.calls.find(
                ([sql]) => sql && sql.includes('policy_presets')
            );
            expect(presetInsertCall).toBeDefined();
        });

        it('uses db.withTransaction for override migration', async () => {
            const dbModule = require('../config/database');

            dbModule.query.mockResolvedValue({ rows: [{ id: 10, library_id: 5 }] });

            clientMock.query
                .mockResolvedValueOnce({ rows: [{ id: 99 }] })   // getOrCreatePolicy SELECT
                .mockResolvedValueOnce({ rows: [] })              // policy_overrides INSERT
                .mockResolvedValueOnce({ rowCount: 1 });          // UPDATE library_custom_rules

            const result = await legacyMigration.migrateRule(10, {
                type: 'override',
                override_config: { match_field: 'genre', reason: 'test reason' }
            }, 'user1');

            expect(dbModule.withTransaction).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ success: true });

            const overrideInsertCall = clientMock.query.mock.calls.find(
                ([sql]) => sql && sql.includes('policy_overrides')
            );
            expect(overrideInsertCall).toBeDefined();
        });

        it('throws without opening a transaction when the rule is not found', async () => {
            const dbModule = require('../config/database');

            dbModule.query.mockResolvedValue({ rows: [] });

            await expect(
                legacyMigration.migrateRule(999, { type: 'preset', preset_id: 1 }, null)
            ).rejects.toThrow('Rule not found');

            expect(dbModule.withTransaction).not.toHaveBeenCalled();
        });

        it('propagates transaction errors to the caller without swallowing them', async () => {
            const dbModule = require('../config/database');

            dbModule.query.mockResolvedValue({ rows: [{ id: 10, library_id: 5 }] });
            dbModule.withTransaction.mockRejectedValue(new Error('constraint violation'));

            await expect(
                legacyMigration.migrateRule(10, { type: 'preset', preset_id: 7 }, null)
            ).rejects.toThrow('constraint violation');
        });

        it('creates a new policy via pinned client when none exists for the library', async () => {
            const dbModule = require('../config/database');

            dbModule.query.mockResolvedValue({ rows: [{ id: 10, library_id: 5 }] });

            clientMock.query
                .mockResolvedValueOnce({ rows: [] })              // getOrCreatePolicy SELECT: no policy exists
                .mockResolvedValueOnce({ rows: [{ id: 200 }] })  // getOrCreatePolicy INSERT: new policy
                .mockResolvedValueOnce({ rows: [{ id: 7, is_system: true, is_public: false, user_id: null }] }) // content_presets
                .mockResolvedValueOnce({ rows: [] })              // policy_presets INSERT
                .mockResolvedValueOnce({ rowCount: 1 });          // UPDATE library_custom_rules

            await legacyMigration.migrateRule(10, { type: 'preset', preset_id: 7 }, null);

            const insertPolicyCall = clientMock.query.mock.calls.find(
                ([sql]) => sql && sql.includes('INSERT INTO library_policies')
            );
            expect(insertPolicyCall).toBeDefined();
        });
    });
});
