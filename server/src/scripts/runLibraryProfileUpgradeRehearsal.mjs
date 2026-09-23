/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
// eslint-disable-next-line n/no-unpublished-import -- This offline rehearsal uses the existing development-only Docker test tooling.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import {
    createIsolatedDbClient,
    readPinnedReleaseSchema,
    rehearseLibraryProfileUpgrade,
} from './libraryProfileUpgradeRehearsal.mjs';

/** This command never accepts a connection URL, a dump path, or live credentials. */
async function main() {
    const releaseSchema = readPinnedReleaseSchema();
    let container;
    let pool;
    try {
        container = await new PostgreSqlContainer('pgvector/pgvector:0.8.6-pg18')
            .withDatabase('classifarr_rehearsal')
            .withUsername('rehearsal')
            .withPassword(randomBytes(32).toString('hex'))
            .start();
        pool = new pg.Pool({
            host: container.getHost(),
            port: container.getPort(),
            database: container.getDatabase(),
            user: container.getUsername(),
            password: container.getPassword(),
            max: 2,
        });
        const result = await rehearseLibraryProfileUpgrade({
            dbClient: createIsolatedDbClient(pool),
            releaseSchema,
            migrationsDir: resolve(import.meta.dirname, '../../../database/migrations'),
        });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } finally {
        try {
            if (pool) await pool.end();
        } finally {
            if (container) await container.stop();
        }
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main().catch(error => {
        process.stderr.write(`Library profile upgrade rehearsal failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}
