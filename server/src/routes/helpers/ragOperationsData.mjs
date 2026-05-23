/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getRagResetConfigDefaults } from './ragConfigDefaults.mjs';

export async function getLogsPayload({ db }, { level, type, limit = 100, offset = 0 } = {}) {
    let query = 'SELECT * FROM rag_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (level && level !== 'all') {
        query += ` AND level = $${paramCount}`;
        params.push(level);
        paramCount += 1;
    }

    if (type && type !== 'all') {
        query += ` AND type = $${paramCount}`;
        params.push(type);
        paramCount += 1;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    return { logs: result.rows };
}

export async function clearLogs({ db }) {
    await db.query('DELETE FROM rag_logs');
    return { success: true, message: 'Logs cleared' };
}

export async function exportLogs({ db }) {
    const logs = await db.query(`
        SELECT * FROM rag_logs ORDER BY created_at DESC LIMIT 1000
    `);

    return { logs: logs.rows };
}

export async function exportMetrics({ db }) {
    const metrics = await db.query(`
        SELECT * FROM rag_metrics
        WHERE operation = 'embedding_generation'
        ORDER BY period_start DESC
        LIMIT 1000
    `);

    return { metrics: metrics.rows };
}

export async function clearEmbeddings({ db }) {
    await db.query('DELETE FROM classification_embeddings');

    await db.query(`
        INSERT INTO rag_logs (level, type, message)
        VALUES ('warning', 'system', 'All embeddings cleared by user')
    `);

    return { success: true, message: 'All embeddings cleared' };
}

export async function reembedImages({ db }) {
    const result = await db.query(`
        UPDATE classification_embeddings
        SET image_embedding = NULL,
            image_embedding_dims = NULL,
            image_provider = NULL,
            image_model = NULL,
            image_embedding_hash = NULL,
            image_embedding_size = NULL,
            image_embedding_source_url = NULL,
            updated_at = NOW()
    `);

    await db.query(`
        INSERT INTO rag_logs (level, type, message)
        VALUES ('warning', 'system', 'Image embeddings cleared by user for re-embedding')
    `);

    return { success: true, cleared: result.rowCount };
}

export async function resetConfig({ db }) {
    const defaults = getRagResetConfigDefaults();
    await db.query(`
        UPDATE ai_provider_config SET
            embedding_provider_mode = $1,
            embedding_ollama_host = $2,
            embedding_ollama_port = $3,
            embedding_ollama_model = $4,
            embedding_cloud_provider = $5,
            embedding_cloud_api_key = $6,
            embedding_cloud_model = $7,
            image_embedding_provider_mode = $8,
            image_embedding_local_host = $9,
            image_embedding_local_port = $10,
            image_embedding_local_model = $11,
            image_embedding_cloud_provider = $12,
            image_embedding_cloud_api_key = $13,
            image_embedding_cloud_model = $14,
            image_embedding_cloud_api_endpoint = $15,
            realtime_embedding_enabled = $16,
            idle_backfill_enabled = $17,
            idle_threshold = $18,
            idle_batch_size = $19,
            scheduled_backfill_enabled = $20,
            scheduled_backfill_time = $21,
            scheduled_backfill_days = $22,
            scheduled_backfill_batch_size = $23,
            scheduled_backfill_max_duration = $24,
            manual_backfill_batch_size = $25,
            max_retries = $26,
            retry_delay = $27,
            request_timeout = $28,
            cache_enabled = $29,
            cache_ttl = $30,
            verbose_logging = $31,
            log_embedding_content = $32
        WHERE id = 1
    `, [
        defaults.embedding_provider_mode,
        defaults.embedding_ollama_host,
        defaults.embedding_ollama_port,
        defaults.embedding_ollama_model,
        defaults.embedding_cloud_provider,
        defaults.embedding_cloud_api_key,
        defaults.embedding_cloud_model,
        defaults.image_embedding_provider_mode,
        defaults.image_embedding_local_host,
        defaults.image_embedding_local_port,
        defaults.image_embedding_local_model,
        defaults.image_embedding_cloud_provider,
        defaults.image_embedding_cloud_api_key,
        defaults.image_embedding_cloud_model,
        defaults.image_embedding_cloud_api_endpoint,
        defaults.realtime_embedding_enabled,
        defaults.idle_backfill_enabled,
        defaults.idle_threshold,
        defaults.idle_batch_size,
        defaults.scheduled_backfill_enabled,
        defaults.scheduled_backfill_time,
        defaults.scheduled_backfill_days,
        defaults.scheduled_backfill_batch_size,
        defaults.scheduled_backfill_max_duration,
        defaults.manual_backfill_batch_size,
        defaults.max_retries,
        defaults.retry_delay,
        defaults.request_timeout,
        defaults.cache_enabled,
        defaults.cache_ttl,
        defaults.verbose_logging,
        defaults.log_embedding_content
    ]);

    await db.query(`
        INSERT INTO rag_logs (level, type, message)
        VALUES ('warning', 'system', 'RAG configuration reset to defaults by user')
    `);

    return { success: true, message: 'Configuration reset to defaults' };
}
