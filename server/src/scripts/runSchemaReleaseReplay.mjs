/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
// eslint-disable-next-line n/no-unpublished-import -- Isolated verification uses the existing development-only container dependency.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { createIsolatedDbClient } from './libraryProfileUpgradeRehearsal.mjs';
import { readPinnedReleaseSchema } from './pinnedReleaseSchema.mjs';
import { CURRENT_DB, RELEASE_DB, rehearseReleaseSchema } from './schemaReleaseReplay.mjs';

export function dumpIsolatedCatalog({ containerId, dbName, user, password, exec = execFileSync }) {
    if (!/^[a-f0-9]{12,64}$/.test(containerId) || ![RELEASE_DB, CURRENT_DB].includes(dbName)) {
        throw new Error('Refusing to dump a catalog outside the isolated replay containers');
    }
    return exec('docker', ['exec', containerId, 'env', `PGPASSWORD=${password}`, 'pg_dump',
        '--schema-only', '--no-owner', '--no-privileges', '--host', '127.0.0.1',
        '--username', user, '--dbname', dbName], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

/** No live database address, credentials, or dump path can be supplied to this command. */
export async function main() {
    const releaseSchema = readPinnedReleaseSchema();
    const snapshotPath = resolve(import.meta.dirname, '../../../database/schema/current.sql');
    const password = randomBytes(32).toString('hex');
    let container;
    let releasePool;
    let currentPool;
    try {
        container = await new PostgreSqlContainer('pgvector/pgvector:0.8.6-pg18')
            .withDatabase(RELEASE_DB).withUsername('rehearsal').withPassword(password)
            .withCommand(['postgres', '-c', 'shared_preload_libraries=pg_stat_statements']).start();
        const config = { host: container.getHost(), port: container.getPort(),
            user: container.getUsername(), password: container.getPassword(), max: 2 };
        releasePool = new pg.Pool({ ...config, database: RELEASE_DB });
        await releasePool.query(`CREATE DATABASE ${CURRENT_DB}`);
        currentPool = new pg.Pool({ ...config, database: CURRENT_DB });
        const currentSchema = fs.readFileSync(snapshotPath, 'utf8');
        const result = await rehearseReleaseSchema({
            releaseDb: createIsolatedDbClient(releasePool),
            currentDb: createIsolatedDbClient(currentPool),
            releaseSchema,
            currentSchema,
            dumpCatalog: dbName => dumpIsolatedCatalog({ containerId: container.getId(),
                dbName, user: config.user, password }),
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } finally {
        try {
            if (currentPool) await currentPool.end();
            if (releasePool) await releasePool.end();
        } finally {
            if (container) await container.stop();
        }
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main().catch(error => {
        process.stderr.write(`Release schema replay failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}
