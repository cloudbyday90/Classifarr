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

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

dotenv.config({ path: '../server/.env' });

async function resetData() {
    const [{ default: db }, loggerModule] = await Promise.all([
        import('../server/src/config/database.js'),
        import('../server/src/utils/logger.js')
    ]);
    const { createLogger } = loggerModule.default ?? loggerModule;

    const logger = createLogger('reset_data');

    try {
        logger.info('Resetting database data...');

        await db.query('BEGIN');
        await db.query('TRUNCATE TABLE content_analysis_log RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE learning_patterns RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE media_server_items RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE task_queue RESTART IDENTITY CASCADE');
        await db.query('TRUNCATE TABLE library_custom_rules RESTART IDENTITY CASCADE');
        await db.query('COMMIT');

        logger.info('Database reset complete.');
        logger.info('Cleared: items, history, learning patterns, analysis logs, custom rules, task queues.');
        process.exit(0);
    } catch (error) {
        await db.query('ROLLBACK');
        logger.error('Failed to reset data:', error);
        process.exit(1);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    await resetData();
}