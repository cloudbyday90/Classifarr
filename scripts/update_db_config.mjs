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
import { resolve } from 'node:path';
import db from '../server/src/config/database.mjs';

dotenv.config({ path: './server/.env' });

async function updateConfig() {
    try {
        console.log('Updating Ollama Config to 192.168.50.95...');

        await db.query(`
      UPDATE ollama_config 
      SET host = '192.168.50.95', port = 11434, is_active = true 
      WHERE id = (SELECT id FROM ollama_config LIMIT 1)
    `);

        const result = await db.query('SELECT * FROM ollama_config');
        if (result.rows.length === 0) {
            await db.query(`
        INSERT INTO ollama_config (host, port, model, temperature, is_active)
        VALUES ('192.168.50.95', 11434, 'qwen3:14b', 0.3, true)
      `);
        }

        console.log("Resetting stuck 'processing' tasks to 'pending'...");
        const resetResult = await db.query(`
      UPDATE task_queue 
      SET status = 'pending', attempts = 0, started_at = NULL 
      WHERE status = 'processing'
    `);
        console.log(`Reset ${resetResult.rowCount} stuck tasks.`);

        console.log('Database update complete.');
    } catch (err) {
        console.error('Error updating config:', err);
    } finally {
        process.exit();
    }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    await updateConfig();
}
