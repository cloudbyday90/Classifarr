/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
// eslint-disable-next-line n/no-unpublished-import -- This offline CLI deliberately uses the existing development-only Docker test tooling.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runLibraryScanRecoveryMeasurements } from './libraryScanRecovery/runner.mjs';
const POSTGRES_IMAGE = 'postgres:18.6-alpine';

/** No source connection arguments or application environment/configuration are loaded. */
export async function runLibraryScanRecoveryBenchmark({ argv = process.argv.slice(2),
    start = password => new PostgreSqlContainer(POSTGRES_IMAGE)
        .withDatabase('scan_recovery_benchmark').withUsername('benchmark').withPassword(password).start(),
    connect = config => new pg.Client(config), measure = runLibraryScanRecoveryMeasurements } = {}) {
    if (!Array.isArray(argv) || argv.length) throw new Error('Recovery benchmark accepts no arguments');
    const container = await start(randomBytes(24).toString('hex'));
    let client;
    try {
        const config = { host: container.getHost(), port: container.getPort(), database: container.getDatabase(),
            user: container.getUsername(), password: container.getPassword(), connectionTimeoutMillis: 10000,
            statement_timeout: 15000, application_name: 'library_scan_recovery_benchmark' };
        client = connect(config);
        await client.connect();
        const version = (await client.query('SHOW server_version')).rows[0].server_version;
        // The callback must be awaited; credentials never leave this scoped connection factory.
        const withClient = async work => {
            const peer = connect(config);
            try { await peer.connect(); return await work(peer); }
            finally { await peer.end(); }
        };
        return { ...await measure(client, { withClient }), postgresVersion: version, postgresImage: POSTGRES_IMAGE };
    } finally {
        try { if (client) await client.end(); } finally { await container.stop(); }
    }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runLibraryScanRecoveryBenchmark().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Library scan recovery benchmark failed; no production recovery was enabled.\n'); process.exitCode = 1; });
}
