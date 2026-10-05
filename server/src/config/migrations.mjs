/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as db from './database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createMigrationDiagnostics } from '../services/migrationDiagnostics.mjs';

const logger = createLogger('Migrations');

/**
 * Extract version key from migration filename for sorting
 *
 * @param {string} filename - Migration filename
 * @returns {string} Sort key for the migration
 *
 * @example
 * getMigrationSortKey('001_initial.sql') // => '00000000_000000_0000000001'
 * getMigrationSortKey('20260201_150000_feature.sql') // => '20260201_150000'
 */
export function getMigrationSortKey(filename) {
    // Timestamp format: 20260201_150000_description.sql
    const timestampMatch = filename.match(/^(\d{8}_\d{6})_/);
    if (timestampMatch) {
        return timestampMatch[1];
    }

    // Numeric format: 076_description.sql
    const numericMatch = filename.match(/^(\d+)_/);
    if (numericMatch) {
        // Pad to ensure numeric sorts before timestamps
        return '00000000_000000_' + numericMatch[1].padStart(10, '0');
    }

    return filename;
}

/**
 * Compare two migration filenames for sorting
 *
 * @param {string} a - First migration filename
 * @param {string} b - Second migration filename
 * @returns {number} -1, 0, or 1 for sort ordering
 */
export function compareMigrations(a, b) {
    const versionA = getMigrationSortKey(a);
    const versionB = getMigrationSortKey(b);

    // Primary sort by version
    const versionCompare = versionA.localeCompare(versionB);

    // If versions are the same (e.g., duplicate prefixes like 011_*, 044_*),
    // use filename as tie-breaker for deterministic ordering
    if (versionCompare === 0) {
        return a.localeCompare(b);
    }

    return versionCompare;
}

/**
 * Database Migration Runner
 */
class MigrationRunner {
    constructor({
        dbClient = db,
        env = process.env,
        fileSystem = fs,
        pathModule = path,
        currentDir = import.meta.dirname,
        onEvent = () => {},
        diagnostics,
    } = {}) {
        this.db = dbClient;
        this.env = env;
        this.fs = fileSystem;
        this.path = pathModule;
        this.currentDir = currentDir;
        this.onEvent = onEvent;
        this.diagnostics = diagnostics;

        // Resolve paths intelligently for both Local development and Docker environments
        // Local:  server/src/config/migrations.mjs -> ../../../database/migrations
        // Docker: /app/src/config/migrations.mjs   -> ../../database/migrations
        const localMigrationsPath = this.path.resolve(this.currentDir, '../../../database/migrations');
        const dockerMigrationsPath = this.path.resolve(this.currentDir, '../../database/migrations');

        const localSchemaPath = this.path.resolve(this.currentDir, '../../../database/schema/current.sql');
        const dockerSchemaPath = this.path.resolve(this.currentDir, '../../database/schema/current.sql');

        if (this.env.MIGRATIONS_DIR) {
            this.migrationsDir = this.env.MIGRATIONS_DIR;
        } else if (this.fs.existsSync(dockerMigrationsPath)) {
            this.migrationsDir = dockerMigrationsPath;
        } else {
            this.migrationsDir = localMigrationsPath;
        }

        if (this.env.SCHEMA_FILE) {
            this.schemaFile = this.env.SCHEMA_FILE;
        } else if (this.fs.existsSync(dockerSchemaPath)) {
            this.schemaFile = dockerSchemaPath;
        } else {
            this.schemaFile = localSchemaPath;
        }

        logger.debug('[Migrations] Migrations directory: ' + this.migrationsDir);
        logger.debug('[Migrations] Schema file: ' + this.schemaFile);
    }

    async ensureMigrationsTable() {
        const { rows } = await this.db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'schema_migrations'
                  AND table_schema = 'public'
            ) AS exists
        `);

        if (rows[0]?.exists) {
            return;
        }

        await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    }

    async initializeFreshInstall(onEvent = this.onEvent) {
        if (!this.fs.existsSync(this.schemaFile)) {
            logger.warn('[Migrations] Schema snapshot not found, using legacy migrations');
            return false;
        }

        logger.info('[Migrations] 🆕 Fresh install detected - loading schema snapshot');
        logger.info('[Migrations] ⚡ This is much faster than running 76+ individual migrations');

        try {
            onEvent('snapshot_read', { migration: 'current.sql' });
            const schemaSQL = this.fs.readFileSync(this.schemaFile, 'utf8').replace(/^\uFEFF/, '');
            onEvent('snapshot_execute', { migration: 'current.sql', contentHash: createHash('sha256').update(schemaSQL).digest('hex') });
            await this.db.withTransaction(async (client) => {
                await client.query(schemaSQL);
            });
            onEvent('snapshot_complete', { migration: 'current.sql' });
            logger.info('[Migrations] ✅ Database initialized from schema snapshot');
            return true;
        } catch (error) {
            onEvent('snapshot_failed', { migration: 'current.sql', error });
            logger.error('[Migrations] Schema snapshot failed; see migration diagnostics');
            return false;
        }
    }

    async getAppliedMigrations() {
        const result = await this.db.query('SELECT filename FROM schema_migrations ORDER BY filename');
        return result.rows.map(row => row.filename);
    }

    getMigrationFiles() {
        if (!this.fs.existsSync(this.migrationsDir)) {
            logger.error('[Migrations] ❌ Migrations directory not found: ' + this.migrationsDir);
            logger.error('[Migrations] 💡 Tip: If running in Docker, set MIGRATIONS_DIR env var or check container path mounting');
            logger.error('[Migrations] 💡 __dirname resolves to: ' + this.currentDir);
            return [];
        }

        const files = this.fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(compareMigrations);

        logger.debug('[Migrations] Found ' + files.length + ' migration files in ' + this.migrationsDir);
        return files;
    }

    async applyMigration(filename, onEvent = this.onEvent) {
        onEvent('migration_read', { migration: filename });
        const filepath = this.path.join(this.migrationsDir, filename);
        const sql = this.fs.readFileSync(filepath, 'utf8').replace(/^\uFEFF/, '');
        const context = { migration: filename, contentHash: createHash('sha256').update(sql).digest('hex') };

        await this.db.withTransaction(async (client) => {
            onEvent('migration_execute', context);
            await client.query(sql);
            onEvent('migration_ledger', context);
            await client.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                [filename]
            );
        });
        onEvent('migration_committed', context);
        return true;
    }

    async run() {
        if (this.diagnostics) return this.diagnostics.run(onEvent => this.runSteps(onEvent));
        return this.runSteps(this.onEvent);
    }

    async runSteps(onEvent) {
        try {
            logger.info('[Migrations] Checking for pending database migrations...');

            onEvent('ledger_probe');
            const { rows } = await this.db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'schema_migrations'
                ) as exists
            `);

            let usedSnapshot = false;
            if (!rows[0].exists) {
                try {
                    usedSnapshot = await this.initializeFreshInstall(onEvent);
                } catch (error) {
                    onEvent('snapshot_failed', { migration: 'current.sql', error });
                    logger.error('[Migrations] Fresh install snapshot threw unexpectedly; see migration diagnostics');
                    usedSnapshot = false;
                }
            }

            onEvent('ledger_ensure');
            await this.ensureMigrationsTable();

            onEvent('migration_discovery');
            const applied = await this.getAppliedMigrations();
            const allFiles = this.getMigrationFiles();
            const pending = allFiles.filter(f => !applied.includes(f));

            if (pending.length === 0) {
                logger.info('[Migrations] Database is up to date (' + applied.length + ' migrations applied)');
                return { applied: 0, total: applied.length, method: usedSnapshot ? 'snapshot' : 'migrations' };
            }

            logger.info('[Migrations] Found ' + pending.length + ' pending migration(s)');

            let successCount = 0;
            for (const filename of pending) {
                try {
                    logger.info('[Migrations] Applying: ' + filename);
                    await this.applyMigration(filename, onEvent);
                    successCount++;
                    logger.info('[Migrations] Applied: ' + filename);
                } catch (error) {
                    onEvent('migration_failed', { migration: filename, error });
                    logger.error('[Migrations] Failed to apply ' + filename + '; see migration diagnostics');
                    throw new Error('Migration failed: ' + filename, { cause: error });
                }
            }

            logger.info('[Migrations] Successfully applied ' + successCount + ' migration(s)');
            return { applied: successCount, total: applied.length + successCount, method: usedSnapshot ? 'snapshot+migrations' : 'migrations' };
        } catch (error) {
            logger.error('[Migrations] Migration runner failed; see migration diagnostics');
            throw error;
        }
    }
}

export function createMigrationRunner(options) {
    return new MigrationRunner(options);
}

const migrationRunner = createMigrationRunner({ diagnostics: createMigrationDiagnostics() });

export { migrationRunner };
