/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
        this.schemaFile = path.join(__dirname, '../../database/schema/current.sql');
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
     * Initialize database for fresh installs using schema snapshot
     */
    async initializeFreshInstall() {
        if (!fs.existsSync(this.schemaFile)) {
            logger.warn('[Migrations] Schema snapshot not found, using legacy migrations');
            return false;
        }

        logger.info('[Migrations] 🆕 Fresh install detected - loading schema snapshot');
        logger.info('[Migrations] ⚡ This is much faster than running 76+ individual migrations');

        const schemaSQL = fs.readFileSync(this.schemaFile, 'utf8');
        
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(schemaSQL);
            await client.query('COMMIT');
            logger.info('[Migrations] ✅ Database initialized from schema snapshot');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('[Migrations] Schema snapshot failed:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get list of already applied migrations
     */
    async getAppliedMigrations() {
        const result = await db.query('SELECT filename FROM schema_migrations ORDER BY filename');
        return result.rows.map(row => row.filename);
    }

    /**
     * Get list of all migration files (supports both numeric and timestamp)
     */
    getMigrationFiles() {
        if (!fs.existsSync(this.migrationsDir)) {
            logger.warn('[Migrations] Migrations directory not found: ' + this.migrationsDir);
            return [];
        }

        const files = fs.readdirSync(this.migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort((a, b) => {
                // Extract version from filename for proper sorting
                const getVersion = (filename) => {
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
                };
                
                return getVersion(a).localeCompare(getVersion(b));
            });

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

            // Check if this is a fresh install
            const { rows } = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'schema_migrations'
                ) as exists
            `);

            if (!rows[0].exists) {
                // FRESH INSTALL - Try schema snapshot first
                const usedSnapshot = await this.initializeFreshInstall();
                if (usedSnapshot) {
                    return { applied: 0, total: 76, method: 'snapshot' };
                }
            }

            // EXISTING INSTALL or no snapshot - Use migrations
            await this.ensureMigrationsTable();
            
            const applied = await this.getAppliedMigrations();
            const allFiles = this.getMigrationFiles();
            const pending = allFiles.filter(f => !applied.includes(f));

            if (pending.length === 0) {
                logger.info('[Migrations] Database is up to date (' + applied.length + ' migrations applied)');
                return { applied: 0, total: applied.length, method: 'migrations' };
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
            return { applied: successCount, total: applied.length + successCount, method: 'migrations' };
        } catch (error) {
            logger.error('[Migrations] Migration runner error: ' + error.message);
            throw error;
        }
    }
}

module.exports = new MigrationRunner();
