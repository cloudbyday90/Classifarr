/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { Pool } = require('pg');

let container;
let pool;

// Global setup - start PostgreSQL container
beforeAll(async () => {
    console.log('Starting PostgreSQL container via testcontainers...');

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
    const tempSqlFile = path.join(__dirname, 'temp_schema.sql');
    fs.writeFileSync(tempSqlFile, initSql, 'utf8');

    try {
        // Start PostgreSQL container and copy the SQL file
        container = await new PostgreSqlContainer('postgres:15-alpine')
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

        console.log(`PostgreSQL container started on port ${container.getPort()}`);

        // Create connection pool
        pool = new Pool({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
        });

        // Apply schema using psql -f inside the container
        console.log('Applying schema via psql -f...');

        const { output, exitCode } = await container.exec([
            'psql', '-U', 'test', '-d', 'classifarr_test', '-f', '/tmp/schema.sql'
        ]);

        if (exitCode !== 0) {
            console.error('psql output:', output);
            throw new Error(`psql failed with exit code ${exitCode}: ${output}`);
        }

        console.log('Schema applied successfully via psql.');
    } finally {
        // Clean up temp file
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
    }
}, 120000); // 120 second timeout for container startup

// Global teardown - stop container
afterAll(async () => {
    console.log('Stopping PostgreSQL container...');
    if (pool) {
        await pool.end();
    }
    if (container) {
        await container.stop();
    }
    console.log('PostgreSQL container stopped.');
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
