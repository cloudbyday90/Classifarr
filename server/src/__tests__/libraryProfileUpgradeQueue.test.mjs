/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { queueLibraryProfileUpgrade } from '../services/libraryProfileUpgradeQueue.mjs';

const task = { id: 'profile_refresh_fixture', version: 'fixture', description: 'Fixture refresh' };

describe('library profile upgrade queue', () => {
    test('records intent before dirtying revisions in one transaction', async () => {
        const client = { query: jest.fn()
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockResolvedValueOnce({ rowCount: 3 }) };
        const dbClient = { withTransaction: jest.fn(async callback => callback(client)) };

        await expect(queueLibraryProfileUpgrade(task, dbClient)).resolves.toEqual({ queued: 3, alreadyRecorded: false });
        expect(dbClient.withTransaction).toHaveBeenCalledTimes(1);
        expect(client.query.mock.calls[0][0]).toContain('INSERT INTO post_upgrade_tasks');
        expect(client.query.mock.calls[0][1]).toEqual([task.id, task.version, task.description]);
        expect(client.query.mock.calls[1][0]).toContain('ON CONFLICT (library_id) DO UPDATE');
        expect(client.query.mock.calls[1][0]).toContain('EXISTS (SELECT 1 FROM media_server_items');
    });

    test('a repeated task cannot bump revisions again', async () => {
        const client = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
        const dbClient = { withTransaction: callback => callback(client) };

        await expect(queueLibraryProfileUpgrade(task, dbClient)).resolves.toEqual({ queued: 0, alreadyRecorded: true });
        expect(client.query).toHaveBeenCalledTimes(1);
    });

    test('propagates a dirty-revision failure so the transaction rolls back the ledger', async () => {
        const client = { query: jest.fn()
            .mockResolvedValueOnce({ rowCount: 1 })
            .mockRejectedValueOnce(new Error('revision store unavailable')) };
        const dbClient = { withTransaction: async callback => callback(client) };

        await expect(queueLibraryProfileUpgrade(task, dbClient)).rejects.toThrow('revision store unavailable');
    });

    test('rejects an unregistered task shape', async () => {
        await expect(queueLibraryProfileUpgrade({ id: 'incomplete' })).rejects.toThrow('registered upgrade task');
    });
});
