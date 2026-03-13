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

const { newDb } = require('pg-mem');

const db = newDb();

// Register to_regclass function
db.public.registerFunction({
    name: 'to_regclass',
    args: [db.public.getType('text')],
    returns: db.public.getType('text'),
    implementation: (name) => {
        try {
            db.public.getTable(name);
            return name;
        } catch (_e) {
            return null;
        }
    }
});

// Register gen_random_uuid
db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: db.public.getType('uuid'),
    implementation: () => '00000000-0000-0000-0000-000000000000'
});

module.exports = db;
