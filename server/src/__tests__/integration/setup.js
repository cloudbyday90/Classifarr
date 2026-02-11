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

const path = require('path');
const fs = require('fs');
const os = require('os');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { Pool } = require('pg');

const verboseLogs = process.env.INTEGRATION_TEST_VERBOSE === 'true';
const isPrimaryWorker = !process.env.JEST_WORKER_ID || process.env.JEST_WORKER_ID === '1';
const log = (...args) => {
    if (verboseLogs) {
        console.log(...args);
    }
};
const summaryLog = (...args) => {
    if (isPrimaryWorker) {
        console.log(...args);
    }
};

if (!process.env.API_KEY_ENCRYPTION_KEY) {
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

let container;
let pool;

// Global setup - start PostgreSQL container
beforeAll(async () => {
    summaryLog('Integration test database setup starting (set INTEGRATION_TEST_VERBOSE=true for details).');
    log('Starting PostgreSQL container via testcontainers...');

    const dbPath = path.resolve(__dirname, '../../../../database');
    const initSqlPath = path.join(dbPath, 'init.sql');

    if (!fs.existsSync(initSqlPath)) {
        throw new Error(`init.sql not found at ${initSqlPath}`);
    }

    // Read and preprocess init.sql (skip migrations for fresh install)
    let initSql = fs.readFileSync(initSqlPath, 'utf8');

    // Remove \i migration commands (not needed for fresh database)
    initSql = initSql.split('\n')
        .filter(line => !line.trim().startsWith('\\i'))
        .join('\n');

    // Write preprocessed SQL to temp file for copying to container
    // Use os.tmpdir() for cross-platform compatibility (Windows/Linux)
    const tempSqlFile = path.resolve(os.tmpdir(), `classifarr_schema_${Date.now()}.sql`);
    fs.writeFileSync(tempSqlFile, initSql, 'utf8');
    log(`Created temp SQL file at: ${tempSqlFile}`);

    try {
        // Start PostgreSQL container and copy the SQL file
        // Use pgvector image to support RAG embeddings
        container = await new PostgreSqlContainer('pgvector/pgvector:pg15')
            .withDatabase('classifarr_test')
            .withUsername('test')
            .withPassword('test')
            .withCopyFilesToContainer([
                {
                    source: tempSqlFile,
                    target: '/tmp/schema.sql'
                }
            ])
            .start();

        log(`PostgreSQL container started on port ${container.getPort()}`);

        // Create connection pool
        pool = new Pool({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        });

        // Apply schema using psql -f inside the container
        log('Applying schema via psql -f...');

        const { output, exitCode } = await container.exec([
            'psql', '-U', 'test', '-d', 'classifarr_test', '-f', '/tmp/schema.sql'
        ]);

        if (exitCode !== 0) {
            console.error('psql output:', output);
            throw new Error(`psql failed with exit code ${exitCode}: ${output}`);
        }

        log('Schema applied successfully via psql.');

        // Apply migrations for testing new schema
        log('Applying migrations...');
        const migrationsDir = path.join(dbPath, 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql') && !f.includes('README') && !f.includes('GUIDE'))
            .sort();

        const failedMigrations = [];
        const knownOptionalFailures = [
            'extension "vector" is not available'  // pgvector extension not in test container
        ];

        // Ensure migration tracking table exists (align with production migration runner)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT NOW()
            );
        `);

        for (const migrationFile of migrationFiles) {
            log(`  Applying migration: ${migrationFile}`);
            const migrationPath = path.join(migrationsDir, migrationFile);
            const migrationSql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(migrationSql);
                await pool.query(
                    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                    [migrationFile]
                );
            } catch (error) {
                const isKnownOptional = knownOptionalFailures.some(msg => error.message.includes(msg));

                if (isKnownOptional) {
                    console.warn(`  Skipping ${migrationFile} (expected): ${error.message}`);
                } else {
                    console.error(`  Failed to apply ${migrationFile}:`, error.message);
                    failedMigrations.push({
                        file: migrationFile,
                        message: error.message
                    });
                }
            }
        }

        if (failedMigrations.length > 0) {
            console.error('One or more critical migrations failed to apply:', failedMigrations);
            const details = failedMigrations
                .map(m => `${m.file}: ${m.message}`)
                .join('; ');
            throw new Error(`Failed to apply database migrations: ${details}`);
        }

        log('Migrations applied.');
        summaryLog('Integration test database setup complete.');
    } finally {
        // Clean up temp file
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
    }
}, 300000); // 5 minute timeout for container startup in CI/slow environments

// Global teardown - stop container
afterAll(async () => {
    summaryLog('Integration test database teardown starting.');
    log('Stopping PostgreSQL container...');
    if (pool) {
        await pool.end();
    }
    if (container) {
        await container.stop();
    }
    log('PostgreSQL container stopped.');
    summaryLog('Integration test database teardown complete.');
});

// Mock the database module to use our test pool
jest.mock('../../config/database', () => {
    return {
        get query() {
            const setupModule = require('./setup');
            return (text, params) => setupModule.getPool().query(text, params);
        },
        get pool() {
            const setupModule = require('./setup');
            return setupModule.getPool();
        }
    };
});

// Export pool getter for the mock
module.exports = {
    getPool: () => pool
};
