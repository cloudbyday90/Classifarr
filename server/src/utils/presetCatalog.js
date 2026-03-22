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

const db = require('../config/database');

function normalizeFilterValue(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildPresetListQuery({
    category = null,
    search = null,
    includeCustom = false,
    orderBy = 'policy'
} = {}) {
    const normalizedCategory = normalizeFilterValue(category);
    const normalizedSearch = normalizeFilterValue(search);
    const params = [];
    const placeholders = {};

    if (normalizedCategory) {
        params.push(normalizedCategory);
        placeholders.category = `$${params.length}`;
    }

    if (normalizedSearch) {
        params.push(`%${normalizedSearch}%`);
        placeholders.search = `$${params.length}`;
    }

    const builtinWhere = ['1=1'];

    if (placeholders.category) {
        builtinWhere.push(`cp.category = ${placeholders.category}`);
    }

    if (placeholders.search) {
        builtinWhere.push(`(cp.name ILIKE ${placeholders.search} OR COALESCE(cp.description, '') ILIKE ${placeholders.search})`);
    }

    const usageCountJoin = `
        LEFT JOIN (
            SELECT preset_id, COUNT(*)::int AS usage_count
            FROM policy_presets
            GROUP BY preset_id
        ) ppu ON ppu.preset_id = cp.id
    `;

    const selects = [`
        SELECT
            cp.id,
            cp.key,
            cp.name,
            cp.description,
            cp.icon,
            cp.category,
            cp.signals,
            cp.is_system,
            cp.display_order,
            COALESCE(ppu.usage_count, 0)::int AS usage_count,
            'builtin'::text AS source
        FROM content_presets cp
        ${usageCountJoin}
        WHERE ${builtinWhere.join('\n          AND ')}
          AND cp.is_system = true
    `];

    if (includeCustom) {
        const customWhere = ['cp.is_system = false'];

        if (placeholders.category) {
            customWhere.push(`cp.category = ${placeholders.category}`);
        }

        if (placeholders.search) {
            customWhere.push(`(cp.name ILIKE ${placeholders.search} OR COALESCE(cp.description, '') ILIKE ${placeholders.search})`);
        }

        selects.push(`
        SELECT
            cp.id,
            cp.key,
            cp.name,
            cp.description,
            cp.icon,
            cp.category,
            cp.signals,
            cp.is_system,
            cp.display_order,
            COALESCE(ppu.usage_count, 0)::int AS usage_count,
            'custom'::text AS source
        FROM content_presets cp
        ${usageCountJoin}
        WHERE ${customWhere.join('\n          AND ')}
        `);
    }

    let orderClause = 'ORDER BY category, source DESC, display_order, name';
    if (orderBy === 'unified') {
        orderClause = 'ORDER BY source DESC, display_order, name';
    }

    return {
        text: `${selects.join('\nUNION ALL\n')}\n${orderClause}`,
        values: params
    };
}

async function listPresets(options = {}) {
    const { text, values } = buildPresetListQuery(options);
    const result = await db.query(text, values);
    return result.rows;
}

module.exports = {
    buildPresetListQuery,
    listPresets
};
