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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import Docker from 'dockerode';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import {
    getDockerConnection,
    getRuntimeRunId,
    writeRuntime,
} from './runtime.mjs';

const { Pool } = pg;
const TEMPLATE_DATABASE = 'classifarr_template';
const databaseDir = path.resolve(import.meta.dirname, '../../../../database');

function formatPreflightError(target, error) {
    const details = [
        'Integration test preflight failed before any suites were executed.',
        `Testcontainers could not access Docker from this Node process (${target}).`,
        `Original error: ${error.message}`,
        'Checks:',
        ' - Ensure Docker Desktop or Docker Engine is running.',
        ' - Ensure this shell can access the Docker socket or named pipe used by Testcontainers.',
        ' - If you are running inside a sandboxed tool session, rerun the integration suite with elevated permissions.'
    ];

    return new Error(details.join('\n'));
}

async function applyTemplateSchema(runtime, container) {
    const initSqlPath = path.join(databaseDir, 'init.sql');

    if (!fs.existsSync(initSqlPath)) {
        throw new Error(`init.sql not found at ${initSqlPath}`);
    }

    let initSql = fs.readFileSync(initSqlPath, 'utf8');
    initSql = initSql
        .split('\n')
        .filter(line => !line.trim().startsWith('\\i'))
        .join('\n');

    const tempSqlFile = path.join(
        fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-schema-')),
        `schema-${crypto.randomUUID()}.sql`
    );
    fs.writeFileSync(tempSqlFile, initSql, 'utf8');

    const adminPool = new Pool({
        host: runtime.host,
        port: runtime.port,
        database: runtime.adminDatabase,
        user: runtime.user,
        password: runtime.password,
    });

    let templatePool;

    try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${TEMPLATE_DATABASE}`);
        await adminPool.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);

        await container.copyFilesToContainer([
            {
                source: tempSqlFile,
                target: '/tmp/schema.sql'
            }
        ]);

        const { output, exitCode } = await container.exec([
            'psql', '-U', runtime.user, '-d', TEMPLATE_DATABASE, '-f', '/tmp/schema.sql'
        ]);

        if (exitCode !== 0) {
            throw new Error(`psql failed with exit code ${exitCode}: ${output}`);
        }

        templatePool = new Pool({
            host: runtime.host,
            port: runtime.port,
            database: TEMPLATE_DATABASE,
            user: runtime.user,
            password: runtime.password,
        });

        const migrationsDir = path.join(databaseDir, 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql') && !f.includes('README') && !f.includes('GUIDE'))
            .sort();

        const failedMigrations = [];
        const knownOptionalFailures = [
            'extension "vector" is not available',
            'pg_stat_statements must be loaded via shared_preload_libraries',
            'could not open extension control file',
            'already exists',
        ];

        await templatePool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT NOW()
            );
        `);

        for (const migrationFile of migrationFiles) {
            const migrationPath = path.join(migrationsDir, migrationFile);
            const migrationSql = fs.readFileSync(migrationPath, 'utf8');

            try {
                await templatePool.query(migrationSql);
                await templatePool.query(
                    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                    [migrationFile]
                );
            } catch (error) {
                const isKnownOptional = knownOptionalFailures.some(msg => error.message.includes(msg));

                if (!isKnownOptional) {
                    failedMigrations.push({
                        file: migrationFile,
                        message: error.message
                    });
                }
            }
        }

        if (failedMigrations.length > 0) {
            const details = failedMigrations
                .map(m => `${m.file}: ${m.message}`)
                .join('; ');
            throw new Error(`Failed to apply database migrations: ${details}`);
        }
    } finally {
        if (templatePool) {
            await templatePool.end();
        }
        await adminPool.end();
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
        const tempSqlDir = path.dirname(tempSqlFile);
        if (fs.existsSync(tempSqlDir)) {
            fs.rmSync(tempSqlDir, { recursive: true, force: true });
        }
    }
}

export default async () => {
    const { label, options } = getDockerConnection();
    const docker = new Docker(options);

    try {
        await docker.info();
    } catch (error) {
        throw formatPreflightError(label, error);
    }

    const container = await new PostgreSqlContainer('pgvector/pgvector:pg18')
        .withDatabase('postgres')
        .withUsername('test')
        .withPassword('test')
        .start();

    const runtime = {
        adminDatabase: 'postgres',
        containerId: container.getId(),
        host: container.getHost(),
        password: container.getPassword(),
        port: container.getPort(),
        runId: getRuntimeRunId(),
        templateDatabase: TEMPLATE_DATABASE,
        user: container.getUsername(),
    };

    try {
        await applyTemplateSchema(runtime, container);
        writeRuntime(runtime);
    } catch (error) {
        try {
            await container.stop();
        } catch (_stopError) {
            // Container may already be stopped.
        }
        try {
            await container.remove({ force: true, v: true });
        } catch (_removeError) {
            // Container may already be removed.
        }
        throw error;
    }
};