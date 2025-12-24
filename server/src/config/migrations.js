/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const fs = require('fs');
const path = require('path');
const db = require('./database');
const { createLogger } = require('../utils/logger');
const logger = createLogger('Migrations');

/**
 * Database Migration Runner
 * Automatically applies pending migrations on startup
 */
class MigrationRunner {
    constructor() {
        this.migrationsDir = path.join(__dirname, '../../database/migrations');
    }

    /**
     * Create schema_migrations tracking table if not exists
     */
    async ensureMigrationsTable() {
        await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    }

    /**
     * Get list of already applied migrations
     */
    async getAppliedMigrations() {
        const result = await db.query('SELECT filename FROM schema_migrations ORDER BY filename');
        return result.rows.map(row => row.filename);
    }

    /**
     * Get list of all migration files
     */
    getMigrationFiles() {
        if (!fs.existsSync(this.migrationsDir)) {
            logger.warn('[Migrations] Migrations directory not found: ' + this.migrationsDir);
            return [];
        }

        const files = fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Sort alphabetically (001_, 002_, etc.)

        return files;
    }

    /**
     * Apply a single migration
     */
    async applyMigration(filename) {
        const filepath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filepath, 'utf8');

        // Run migration in a transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Execute migration SQL
            await client.query(sql);

            // Record the migration
            await client.query(
                'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                [filename]
            );

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Run all pending migrations
     */
    async run() {
        try {
            logger.info('[Migrations] Checking for pending database migrations...');

            // Ensure tracking table exists
            await this.ensureMigrationsTable();

            // Get applied and pending migrations
            const applied = await this.getAppliedMigrations();
            const allFiles = this.getMigrationFiles();
            const pending = allFiles.filter(f => !applied.includes(f));

            if (pending.length === 0) {
                logger.info('[Migrations] Database is up to date (' + applied.length + ' migrations applied)');
                return { applied: 0, total: applied.length };
            }

            logger.info('[Migrations] Found ' + pending.length + ' pending migration(s)');

            // Apply each pending migration
            let successCount = 0;
            for (const filename of pending) {
                try {
                    logger.info('[Migrations] Applying: ' + filename);
                    await this.applyMigration(filename);
                    successCount++;
                    logger.info('[Migrations] Applied: ' + filename);
                } catch (error) {
                    logger.error('[Migrations] Failed to apply ' + filename + ': ' + error.message);
                    // Stop on first failure
                    throw new Error('Migration failed: ' + filename + ' - ' + error.message);
                }
            }

            logger.info('[Migrations] Successfully applied ' + successCount + ' migration(s)');
            return { applied: successCount, total: applied.length + successCount };
        } catch (error) {
            logger.error('[Migrations] Migration runner error: ' + error.message);
            throw error;
        }
    }
}

module.exports = new MigrationRunner();
