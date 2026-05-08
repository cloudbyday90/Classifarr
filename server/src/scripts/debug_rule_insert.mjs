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

/* eslint-disable no-console */
import * as db from '../config/database.mjs';

async function test() {
    try {
        console.log('Testing insert of rule into library 2...');

        const rule_type = 'keyword';
        const operator = 'contains';
        const value = 'christmas,xmas,holiday,santa,snowman,elf';
        const is_exception = false;
        const priority = 0;
        const description = 'Christmas/Holiday content (67% match)';
        const library_id = 2;

        const result = await db.query(
            `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [library_id, rule_type, operator, value, is_exception, priority, description]
        );

        console.log('Success! Rule created:', result.rows[0]);
    } catch (err) {
        console.error('INSERT FAILED:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.hint) console.error('Hint:', err.hint);
    } finally {
        process.exit();
    }
}

if (import.meta.main) {
    await test();
}
