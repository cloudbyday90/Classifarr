/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { metadataProviderDefinition } from './metadataProviderConfigSql.mjs';

const snapshotSql = `SELECT id, api_key, daily_limit, requests_today,
    to_char(last_reset_date, 'YYYY-MM-DD') AS last_reset_date,
    to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS quota_day
    FROM omdb_config WHERE is_active = true ORDER BY id DESC LIMIT 1`;

function evaluateQuota(config) {
    if (!config?.api_key?.trim()) return { status: 'not_configured', used: 0, limit: 0 };
    const count = config.requests_today ?? 0;
    const limit = config.daily_limit;
    const day = config.quota_day;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2147483647 ||
        !Number.isInteger(count) || count < 0 || count > 2147483647 ||
        !day || (config.last_reset_date && config.last_reset_date > day)) {
        return { status: 'invalid_configuration', used: 0, limit: 0 };
    }
    // Undated counts are retained conservatively; only a completed day resets.
    const used = config.last_reset_date && config.last_reset_date < day ? 0 : count;
    return { status: used < limit ? 'available' : 'limit_reached', used, limit, day };
}

export async function readOmdbQuota(db) {
    const { rows } = await db.query(snapshotSql);
    return evaluateQuota(rows[0]);
}

export async function reserveOmdbQuota(db) {
    return db.withTransaction(async client => {
        // This lock also coordinates empty-table saves, rotation and backup restore.
        await client.query(metadataProviderDefinition('omdb').lock);
        const { rows } = await client.query(snapshotSql);
        const config = rows[0];
        const quota = evaluateQuota(config);
        if (quota.status !== 'available') return quota;
        const result = await client.query(
            'UPDATE omdb_config SET requests_today = $1, last_reset_date = $2::date WHERE id = $3 RETURNING id',
            [quota.used + 1, quota.day, config.id]
        );
        if (result.rows.length !== 1) throw new Error('OMDb quota reservation was not persisted');
        return { ...quota, status: 'reserved', apiKey: config.api_key, configId: config.id };
    });
}
