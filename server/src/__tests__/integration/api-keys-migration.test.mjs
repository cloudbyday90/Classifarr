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

import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');

describe('Migration 067: API Keys Table', () => {
    describe('Table Creation', () => {
        test('api_keys table should exist', async () => {
            const result = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'api_keys'
                );
            `);

            expect(result.rows[0].exists).toBe(true);
        });

        test('api_keys table should have correct columns', async () => {
            const result = await db.query(`
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'api_keys'
                ORDER BY ordinal_position;
            `);

            const columns = result.rows.map(r => r.column_name);

            expect(columns).toContain('id');
            expect(columns).toContain('name');
            expect(columns).toContain('key_hash');
            expect(columns).toContain('key_prefix');
            expect(columns).toContain('permissions');
            expect(columns).toContain('created_at');
            expect(columns).toContain('last_used_at');
            expect(columns).toContain('last_used_ip');
            expect(columns).toContain('is_active');
            expect(columns).toContain('expires_at');
        });

        test('api_keys table should have correct column types', async () => {
            const result = await db.query(`
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'api_keys'
                ORDER BY ordinal_position;
            `);

            const columnTypes = {};
            result.rows.forEach(row => {
                columnTypes[row.column_name] = {
                    type: row.data_type,
                    length: row.character_maximum_length
                };
            });

            expect(columnTypes.id.type).toBe('integer');
            expect(columnTypes.name.type).toBe('character varying');
            expect(columnTypes.name.length).toBe(100);
            expect(columnTypes.key_hash.type).toBe('character varying');
            expect(columnTypes.key_hash.length).toBe(255);
            expect(columnTypes.key_prefix.type).toBe('character varying');
            expect(columnTypes.key_prefix.length).toBe(8);
            expect(columnTypes.permissions.type).toBe('character varying');
            expect(columnTypes.permissions.length).toBe(50);
            expect(columnTypes.last_used_ip.type).toBe('inet');
            expect(columnTypes.is_active.type).toBe('boolean');
        });

        test('api_keys table should have correct default values', async () => {
            const result = await db.query(`
                SELECT column_name, column_default
                FROM information_schema.columns
                WHERE table_name = 'api_keys' AND column_default IS NOT NULL
                ORDER BY ordinal_position;
            `);

            const defaults = {};
            result.rows.forEach(row => {
                defaults[row.column_name] = row.column_default;
            });

            expect(defaults.name).toContain('API Key');
            expect(defaults.permissions).toContain('read_write');
            expect(defaults.created_at).toBeDefined();
            expect(defaults.is_active).toContain('true');
        });
    });

    describe('Indexes', () => {
        test('api_keys should have all required indexes', async () => {
            const result = await db.query(`
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'api_keys'
                ORDER BY indexname;
            `);

            const indexes = result.rows.map(r => r.indexname);

            expect(indexes).toContain('idx_api_keys_hash');
            expect(indexes).toContain('idx_api_keys_prefix');
            expect(indexes).toContain('idx_api_keys_active');
        });

        test('idx_api_keys_hash should index key_hash column', async () => {
            const result = await db.query(`
                SELECT
                    i.relname as index_name,
                    a.attname as column_name
                FROM
                    pg_class t,
                    pg_class i,
                    pg_index ix,
                    pg_attribute a
                WHERE
                    t.oid = ix.indrelid
                    AND i.oid = ix.indexrelid
                    AND a.attrelid = t.oid
                    AND a.attnum = ANY(ix.indkey)
                    AND t.relname = 'api_keys'
                    AND i.relname = 'idx_api_keys_hash';
            `);

            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].column_name).toBe('key_hash');
        });

        test('idx_api_keys_prefix should index key_prefix column', async () => {
            const result = await db.query(`
                SELECT
                    i.relname as index_name,
                    a.attname as column_name
                FROM
                    pg_class t,
                    pg_class i,
                    pg_index ix,
                    pg_attribute a
                WHERE
                    t.oid = ix.indrelid
                    AND i.oid = ix.indexrelid
                    AND a.attrelid = t.oid
                    AND a.attnum = ANY(ix.indkey)
                    AND t.relname = 'api_keys'
                    AND i.relname = 'idx_api_keys_prefix';
            `);

            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].column_name).toBe('key_prefix');
        });

        test('idx_api_keys_active should index is_active column', async () => {
            const result = await db.query(`
                SELECT
                    i.relname as index_name,
                    a.attname as column_name
                FROM
                    pg_class t,
                    pg_class i,
                    pg_index ix,
                    pg_attribute a
                WHERE
                    t.oid = ix.indrelid
                    AND i.oid = ix.indexrelid
                    AND a.attrelid = t.oid
                    AND a.attnum = ANY(ix.indkey)
                    AND t.relname = 'api_keys'
                    AND i.relname = 'idx_api_keys_active';
            `);

            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].column_name).toBe('is_active');
        });
    });

    describe('Data Operations', () => {
        beforeEach(async () => {
            await db.query('DELETE FROM api_keys WHERE name LIKE $1', ['Test API Key%']);
        });

        afterEach(async () => {
            await db.query('DELETE FROM api_keys WHERE name LIKE $1', ['Test API Key%']);
        });

        test('should insert API key with default values', async () => {
            const result = await db.query(`
                INSERT INTO api_keys (key_hash, key_prefix)
                VALUES ('test_hash_123', 'test_pre')
                RETURNING *;
            `);

            expect(result.rows[0].name).toBe('API Key');
            expect(result.rows[0].permissions).toBe('read_write');
            expect(result.rows[0].is_active).toBe(true);
            expect(result.rows[0].created_at).toBeDefined();
        });

        test('should insert API key with custom values', async () => {
            const result = await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix, permissions, is_active)
                VALUES ('Test API Key 1', 'hash_456', 'prefix_2', 'read_only', false)
                RETURNING *;
            `);

            expect(result.rows[0].name).toBe('Test API Key 1');
            expect(result.rows[0].key_hash).toBe('hash_456');
            expect(result.rows[0].key_prefix).toBe('prefix_2');
            expect(result.rows[0].permissions).toBe('read_only');
            expect(result.rows[0].is_active).toBe(false);
        });

        test('should update last_used_at and last_used_ip', async () => {
            const insertResult = await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix)
                VALUES ('Test API Key 2', 'hash_789', 'prefix_3')
                RETURNING id;
            `);

            const apiKeyId = insertResult.rows[0].id;

            await db.query(`
                UPDATE api_keys
                SET last_used_at = NOW(), last_used_ip = '192.168.1.100'
                WHERE id = $1;
            `, [apiKeyId]);

            const result = await db.query('SELECT * FROM api_keys WHERE id = $1', [apiKeyId]);

            expect(result.rows[0].last_used_at).toBeDefined();
            expect(result.rows[0].last_used_ip).toBe('192.168.1.100');
        });

        test('should handle IPv6 addresses in last_used_ip', async () => {
            const result = await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix, last_used_ip)
                VALUES ('Test API Key IPv6', 'hash_ipv6', 'prefix6', '2001:db8::1')
                RETURNING *;
            `);

            expect(result.rows[0].last_used_ip).toBe('2001:db8::1');
        });

        test('should handle expiration timestamp', async () => {
            const DAYS_TO_EXPIRY = 30;
            const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
            const expiresAt = new Date(Date.now() + (DAYS_TO_EXPIRY * MILLISECONDS_PER_DAY));

            const result = await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix, expires_at)
                VALUES ('Test API Key 3', 'hash_abc', 'prefix_4', $1)
                RETURNING *;
            `, [expiresAt]);

            expect(result.rows[0].expires_at).toBeDefined();
            expect(new Date(result.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
        });

        test('should query by key_hash using index', async () => {
            await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix)
                VALUES ('Test API Key 4', 'unique_hash_123', 'prefix_5');
            `);

            const result = await db.query(`
                SELECT * FROM api_keys WHERE key_hash = 'unique_hash_123';
            `);

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].name).toBe('Test API Key 4');
        });

        test('should query active keys using index', async () => {
            await db.query(`
                INSERT INTO api_keys (name, key_hash, key_prefix, is_active)
                VALUES
                    ('Test API Key 5', 'hash_active_1', 'prefix_6', true),
                    ('Test API Key 6', 'hash_inactive', 'prefix_7', false);
            `);

            const result = await db.query(`
                SELECT * FROM api_keys WHERE is_active = true AND name LIKE 'Test API Key%'
                ORDER BY id;
            `);

            expect(result.rows.length).toBeGreaterThanOrEqual(1);
            expect(result.rows.every(row => row.is_active === true)).toBe(true);
        });
    });

    describe('Idempotency', () => {
        test('migration should be idempotent - can run multiple times', async () => {
            await expect(db.query(`
                CREATE TABLE IF NOT EXISTS api_keys (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL DEFAULT 'API Key',
                    key_hash VARCHAR(255) NOT NULL,
                    key_prefix VARCHAR(8) NOT NULL,
                    permissions VARCHAR(50) NOT NULL DEFAULT 'read_write',
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_used_at TIMESTAMP,
                    last_used_ip INET,
                    is_active BOOLEAN DEFAULT true,
                    expires_at TIMESTAMP
                );
            `)).resolves.toBeDefined();

            await expect(db.query(`
                CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
                CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
                CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
            `)).resolves.toBeDefined();
        });
    });

    describe('Migration Tracking', () => {
        test('migration 067 should be recorded in schema_migrations (if table exists)', async () => {
            const tableExists = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'schema_migrations'
                );
            `);

            if (!tableExists.rows[0].exists) {
                return;
            }

            const result = await db.query(`
                SELECT * FROM schema_migrations
                WHERE filename = '067_add_api_keys.sql';
            `);

            expect(result.rows.length).toBe(1);
            expect(result.rows[0].applied_at).toBeDefined();
        });

        test('all required migrations should be applied', async () => {
            const retryColumnsExist = await db.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'classification_history'
                AND column_name IN ('retry_after', 'retry_count', 'max_retries');
            `);
            expect(retryColumnsExist.rows.length).toBe(3);

            const appNotificationsExists = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'app_notifications'
                );
            `);
            expect(appNotificationsExists.rows[0].exists).toBe(true);

            const apiKeysExists = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = 'api_keys'
                );
            `);
            expect(apiKeysExists.rows[0].exists).toBe(true);
        });
    });
});