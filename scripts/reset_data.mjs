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

import * as db from '../server/src/config/database.mjs';
import { createLogger } from '../server/src/utils/logger.mjs';
import { closeDatabasePool, failCli, shouldRunCli } from './lib/cliRuntime.mjs';

const logger = createLogger('reset_data');

async function resetData() {
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
    } catch (error) {
        await db.query('ROLLBACK');
        logger.error('Failed to reset data:', error);
        failCli();
    } finally {
        await closeDatabasePool(db);
    }
}

if (shouldRunCli(import.meta)) {
    await resetData();
}
