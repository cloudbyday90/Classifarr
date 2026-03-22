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

const crypto = require('crypto');
const { Pool, types } = require('pg');
const { readRuntime } = require('./runtime');

types.setTypeParser(20, (val) => {
    if (val === null) return null;
    const num = parseInt(val, 10);
    return (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) ? val : num;
});

const verboseLogs = process.env.INTEGRATION_TEST_VERBOSE === 'true';
const log = (...args) => {
    if (verboseLogs) {
        console.log(...args);
    }
};

if (!process.env.API_KEY_ENCRYPTION_KEY) {
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

let runtime;
let adminPool;
let pool;
let suiteDatabaseName;

function quoteIdentifier(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function buildSuiteDatabaseName() {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    return `classifarr_suite_${suffix}`;
}

async function dropSuiteDatabase() {
    if (!adminPool || !suiteDatabaseName) {
        return;
    }

    await adminPool.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
    `, [suiteDatabaseName]);

    await adminPool.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(suiteDatabaseName)}`);
}

beforeAll(async () => {
    runtime = readRuntime();
    if (!runtime.runId) {
        throw new Error('Integration runtime is missing runId');
    }
    suiteDatabaseName = buildSuiteDatabaseName();

    adminPool = new Pool({
        host: runtime.host,
        port: runtime.port,
        database: runtime.adminDatabase,
        user: runtime.user,
        password: runtime.password,
    });

    log(`Creating integration suite database ${suiteDatabaseName} from template ${runtime.templateDatabase}`);

    await adminPool.query(`
        CREATE DATABASE ${quoteIdentifier(suiteDatabaseName)}
        TEMPLATE ${quoteIdentifier(runtime.templateDatabase)}
    `);

    pool = new Pool({
        host: runtime.host,
        port: runtime.port,
        database: suiteDatabaseName,
        user: runtime.user,
        password: runtime.password,
    });
}, 120000);

afterAll(async () => {
    if (pool) {
        await pool.end();
        pool = null;
    }

    try {
        await dropSuiteDatabase();
    } finally {
        if (adminPool) {
            await adminPool.end();
            adminPool = null;
        }
        suiteDatabaseName = null;
    }
}, 120000);

jest.mock('../../config/database', () => {
    const getPool = () => require('./setup').getPool();

    const mockWithTransaction = async (fn) => {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rbErr) {
                console.error('[integration-test] Rollback error:', rbErr.message);
            }
            throw error;
        } finally {
            client.release();
        }
    };

    return {
        get query() {
            return (text, params) => getPool().query(text, params);
        },
        get pool() {
            return getPool();
        },
        withTransaction: mockWithTransaction,
        healthCheck: async () => ({ connected: true, responseTime: 0 }),
        tryAdvisoryLock: async () => true,
        withSessionAdvisoryLock: async (_lockKey, fn) => { await fn(); return true; },
        prewarmHnswIndexes: async () => ({ loaded: false, error: 'pg_prewarm not available in integration test environment' }),
        checkPgStatStatements: async () => ({ active: false, reason: 'skipped in integration test environment' }),
        DB_ADVISORY_LOCKS: {
            IDLE_BACKFILL: 1001,
            SCHEDULED_BACKFILL: 1002,
            MANUAL_BACKFILL: 1003,
            BACKFILL_OWNER: 1004,
        },
    };
});

module.exports = {
    getPool: () => {
        if (!pool) {
            throw new Error('Integration test pool is not initialized yet');
        }
        return pool;
    }
};
