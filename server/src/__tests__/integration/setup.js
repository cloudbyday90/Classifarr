/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const os = require('os');
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
    // Use os.tmpdir() for cross-platform compatibility (Windows/Linux)
    const tempSqlFile = path.resolve(os.tmpdir(), `classifarr_schema_${Date.now()}.sql`);
    fs.writeFileSync(tempSqlFile, initSql, 'utf8');
    console.log(`Created temp SQL file at: ${tempSqlFile}`);

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

        // Apply migrations for testing new schema
        console.log('Applying migrations...');
        const migrationsDir = path.join(dbPath, 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql') && !f.includes('README') && !f.includes('GUIDE'))
            .sort();

        const failedMigrations = [];
        const knownOptionalFailures = [
            'extension "vector" is not available',  // pgvector extension not in test container
            'relation "schema_migrations" does not exist'  // Migration tracking table not in fresh db
        ];

        for (const migrationFile of migrationFiles) {
            console.log(`  Applying migration: ${migrationFile}`);
            const migrationPath = path.join(migrationsDir, migrationFile);
            const migrationSql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await pool.query(migrationSql);
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

        console.log('Migrations applied.');
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
