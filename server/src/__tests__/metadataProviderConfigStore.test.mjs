/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { metadataProviderConfigQuery, persistMetadataProviderConfig, readMetadataProviderConfig } from '../services/metadataProviderConfigStore.mjs';
import { fetchSingleProviderConfig } from '../routes/helpers/providerConfigHelpers.mjs';

describe('metadata provider configuration boundaries', () => {
    test.each(['tmdb', 'omdb', 'tavily'])('selects %s using explicit activation and ID order', async provider => {
        expect(metadataProviderConfigQuery(provider, { activeOnly: true }))
            .toBe(`SELECT * FROM ${provider}_config WHERE is_active = true ORDER BY id DESC LIMIT 1`);
        expect(metadataProviderConfigQuery(provider))
            .toBe(`SELECT * FROM ${provider}_config ORDER BY (is_active IS TRUE) DESC, id DESC LIMIT 1`);
        const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        expect(await readMetadataProviderConfig(db, provider)).toBeNull();
    });

    test.each(['__proto__', 'constructor', 'tmdb_config', 'tmdb; DROP TABLE users', null])('rejects unsupported provider %j before SQL', async provider => {
        const db = { query: jest.fn() };
        await expect(readMetadataProviderConfig(db, provider)).rejects.toThrow('Unsupported metadata provider');
        await expect(persistMetadataProviderConfig(db, provider, () => ({}))).rejects.toThrow('Unsupported metadata provider');
        expect(db.query).not.toHaveBeenCalled();
    });

    test('the settings bridge rejects unlisted table names', async () => {
        const db = { query: jest.fn() };
        await expect(fetchSingleProviderConfig(db, 'users')).rejects.toThrow('Unsupported provider configuration table');
        expect(db.query).not.toHaveBeenCalled();
    });

    test('does not read secrets or mutate settings when the transaction lock fails', async () => {
        const db = { query: jest.fn().mockRejectedValue(new Error('lock failed')) };
        const buildPayload = jest.fn();
        await expect(persistMetadataProviderConfig(db, 'tmdb', buildPayload)).rejects.toThrow('lock failed');
        expect(db.query).toHaveBeenCalledTimes(1);
        expect(buildPayload).not.toHaveBeenCalled();
    });

    test('binds credential bytes and retains historical rows after a successful upsert', async () => {
        const secret = "fixture'; SELECT pg_sleep(99); --";
        const client = { query: jest.fn(async sql => ({ rows: sql.startsWith('INSERT') ? [{ id: 9 }] : [] })) };
        await persistMetadataProviderConfig(client, 'tmdb', () => ({ apiKey: secret, language: 'en-US' }));
        expect(client.query.mock.calls[2][1]).toEqual([secret, 'en-US', true]);
        expect(client.query.mock.calls.every(([sql]) => !sql.includes(secret) && !sql.startsWith('DELETE'))).toBe(true);
        expect(client.query.mock.calls[3]).toEqual(['UPDATE tmdb_config SET is_active = false WHERE id <> $1 AND is_active = true', [9]]);
    });
});
