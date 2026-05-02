/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createRagDiagnosticsHelpers({
    db,
    logger,
    embeddingRouter,
    embeddingProvider,
    embeddingMigrationService,
    patternMiningService,
    ragLoopMetricsCollector,
    ragLogger,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig
}) {
    const loadRagLoopConfig = async (selectSql) => {
        const defaults = getRagLoopDefaultConfig();
        let configRow = {};

        try {
            const result = await db.query(selectSql);
            configRow = result.rows[0] || {};
        } catch (configError) {
            if (!['42P01', '42703'].includes(configError.code)) {
                throw configError;
            }
            configRow = {};
        }

        const mergedConfig = { ...defaults, ...configRow };
        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(mergedConfig, mergedConfig);

        return { configRow, normalizedConfig };
    };

    const getLatestFallbackIncidentPayload = async () => {
        const { configRow, normalizedConfig } = await loadRagLoopConfig(`
            SELECT
                rag_loop_rollout_mode,
                rag_loop_auto_fallback_enabled,
                rag_loop_auto_fallback_min_apply_samples,
                rag_loop_auto_fallback_consecutive_breaches,
                rag_loop_auto_fallback_cooldown_ms,
                rag_loop_auto_recover_enabled,
                rag_loop_auto_fallback_breach_count,
                rag_loop_auto_fallback_last_breach_at,
                rag_loop_auto_fallback_last_triggered_at,
                rag_loop_auto_fallback_cooldown_until,
                rag_loop_auto_fallback_last_incident_id,
                rag_loop_auto_fallback_last_incident_payload,
                rag_loop_auto_fallback_last_version,
                rag_loop_auto_recover_last_attempt_version,
                rag_loop_auto_recover_last_attempt_at
            FROM ai_provider_config
            WHERE id = 1
        `);

        let incident = null;
        if (
            configRow.rag_loop_auto_fallback_last_incident_payload &&
            typeof configRow.rag_loop_auto_fallback_last_incident_payload === 'object' &&
            !Array.isArray(configRow.rag_loop_auto_fallback_last_incident_payload)
        ) {
            incident = {
                ...configRow.rag_loop_auto_fallback_last_incident_payload
            };
        }

        if (incident) {
            if (!incident.incident_id && configRow.rag_loop_auto_fallback_last_incident_id) {
                incident.incident_id = configRow.rag_loop_auto_fallback_last_incident_id;
            }
            if (!incident.triggered_at && configRow.rag_loop_auto_fallback_last_triggered_at) {
                incident.triggered_at = configRow.rag_loop_auto_fallback_last_triggered_at;
            }
        }

        return {
            incident,
            rollout_mode: normalizedConfig.rag_loop_rollout_mode,
            fallback_state: {
                auto_fallback_enabled: normalizedConfig.rag_loop_auto_fallback_enabled,
                auto_recover_enabled: normalizedConfig.rag_loop_auto_recover_enabled,
                breach_count: Math.max(0, Number(configRow.rag_loop_auto_fallback_breach_count || 0)),
                cooldown_until: configRow.rag_loop_auto_fallback_cooldown_until || null,
                last_triggered_at: configRow.rag_loop_auto_fallback_last_triggered_at || null,
                last_fallback_version: configRow.rag_loop_auto_fallback_last_version || null,
                last_recover_attempt_version: configRow.rag_loop_auto_recover_last_attempt_version || null,
                last_recover_attempt_at: configRow.rag_loop_auto_recover_last_attempt_at || null
            },
            checked_at: new Date().toISOString()
        };
    };

    const getPromotionReadinessPayload = async () => {
        const { normalizedConfig } = await loadRagLoopConfig(`
            SELECT
                rag_loop_shadow_min_samples,
                rag_loop_shadow_max_error_rate_delta,
                rag_loop_shadow_max_p95_latency_delta_ms
            FROM ai_provider_config
            WHERE id = 1
        `);

        const readiness = ragLoopMetricsCollector.canPromote(normalizedConfig);

        return {
            ready: readiness.ready,
            metrics: readiness.metrics,
            gates: {
                min_samples: normalizedConfig.rag_loop_shadow_min_samples,
                max_error_rate_delta: normalizedConfig.rag_loop_shadow_max_error_rate_delta,
                max_p95_latency_delta_ms: normalizedConfig.rag_loop_shadow_max_p95_latency_delta_ms
            },
            checked_at: new Date().toISOString()
        };
    };

    const getCircuitBreakerPayload = () => {
        const status = embeddingRouter.getCircuitStatus();
        const stateHistory = embeddingRouter.getCircuitStateHistory(20);

        return {
            ...status,
            stateHistory
        };
    };

    const resetCircuitBreaker = () => {
        embeddingRouter.resetCircuit();

        return {
            success: true,
            message: 'Circuit breaker reset successfully',
            status: embeddingRouter.getCircuitStatus()
        };
    };

    const warmup = async () => {
        const result = await embeddingProvider.warmup();
        return {
            success: true,
            ...result
        };
    };

    const getErrorsPayload = async ({ limit = 50, operation } = {}) => {
        const errors = await ragLogger.getRecentErrors(
            parseInt(limit, 10),
            operation || null
        );

        return { errors };
    };

    const getMigrationStatus = () => embeddingMigrationService.getProgress();

    const startMigration = async ({ markAllStale = false } = {}) => {
        if (markAllStale) {
            await embeddingMigrationService.markAllForReembedding();
        }

        embeddingMigrationService.startBackgroundMigration().catch((error) => {
            logger.error('Background migration error', { error: error.message });
        });

        return {
            success: true,
            message: 'Migration started in background',
            progress: embeddingMigrationService.getProgress()
        };
    };

    const getPatternsPayload = async ({ libraryId, status = 'approved' } = {}) => {
        let query = `
            SELECT * FROM discovered_patterns
            WHERE status = $1
        `;
        const params = [status];

        if (libraryId) {
            query += ' AND library_id = $2';
            params.push(parseInt(libraryId, 10));
        }

        query += ' ORDER BY confidence DESC, support_count DESC LIMIT 100';

        const result = await db.query(query, params);

        return {
            patterns: result.rows,
            summary: await patternMiningService.getPatternsSummary()
        };
    };

    const discoverPatterns = async () => patternMiningService.discoverPatterns();

    const approvePattern = async ({ id, approvedBy = 'user' }) => {
        const result = await db.query(`
            UPDATE discovered_patterns
            SET status = 'approved',
                approved_by = $1,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [approvedBy, id]);

        if (result.rows.length === 0) {
            const error = new Error('Pattern not found');
            error.status = 404;
            throw error;
        }

        return { pattern: result.rows[0] };
    };

    const rejectPattern = async ({ id, rejectedBy = 'user', reason = '' }) => {
        const result = await db.query(`
            UPDATE discovered_patterns
            SET status = 'rejected',
                rejected_by = $1,
                rejected_at = NOW(),
                rejection_reason = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [rejectedBy, reason, id]);

        if (result.rows.length === 0) {
            const error = new Error('Pattern not found');
            error.status = 404;
            throw error;
        }

        return { pattern: result.rows[0] };
    };

    const getGraphFillRatePayload = async () => {
        const result = await db.query(`
            SELECT
                COUNT(*)                                                              AS total,
                COUNT(director_name)                                                  AS has_director,
                COUNT(primary_studio_name)                                            AS has_studio,
                COUNT(genre_names)  FILTER (WHERE array_length(genre_names,  1) > 0) AS has_genres,
                COUNT(cast_ids)     FILTER (WHERE array_length(cast_ids,     1) > 0) AS has_cast,
                COUNT(collection_id)                                                  AS has_collection
            FROM classification_history
            WHERE metadata IS NOT NULL
        `);

        const row = result.rows[0];
        const total = Number(row.total);
        const pct = (n) => total > 0 ? Math.round((Number(n) / total) * 1000) / 10 : null;

        return {
            total,
            has_director: Number(row.has_director),
            has_studio: Number(row.has_studio),
            has_genres: Number(row.has_genres),
            has_cast: Number(row.has_cast),
            has_collection: Number(row.has_collection),
            pct_director: pct(row.has_director),
            pct_studio: pct(row.has_studio),
            pct_genres: pct(row.has_genres),
            pct_cast: pct(row.has_cast),
            pct_collection: pct(row.has_collection)
        };
    };

    return {
        approvePattern,
        discoverPatterns,
        getCircuitBreakerPayload,
        getErrorsPayload,
        getGraphFillRatePayload,
        getLatestFallbackIncidentPayload,
        getMigrationStatus,
        getPatternsPayload,
        getPromotionReadinessPayload,
        rejectPattern,
        resetCircuitBreaker,
        startMigration,
        warmup
    };
}

export function registerRagDiagnosticsRoutes({
    router,
    logger,
    helpers
}) {
    const {
        approvePattern,
        discoverPatterns,
        getCircuitBreakerPayload,
        getErrorsPayload,
        getGraphFillRatePayload,
        getLatestFallbackIncidentPayload,
        getMigrationStatus,
        getPatternsPayload,
        getPromotionReadinessPayload,
        rejectPattern,
        resetCircuitBreaker,
        startMigration,
        warmup
    } = helpers;

    router.get('/loop/latest-fallback-incident', async (req, res) => {
        try {
            res.json(await getLatestFallbackIncidentPayload());
        } catch (error) {
            logger.error('Failed to get rag loop latest fallback incident', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/loop/promotion-readiness', async (req, res) => {
        try {
            res.json(await getPromotionReadinessPayload());
        } catch (error) {
            logger.error('Failed to get rag loop promotion readiness', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/circuit-breaker', async (req, res) => {
        try {
            res.json(getCircuitBreakerPayload());
        } catch (error) {
            logger.error('Failed to get circuit breaker status', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/circuit-breaker/reset', async (req, res) => {
        try {
            res.json(resetCircuitBreaker());
        } catch (error) {
            logger.error('Failed to reset circuit breaker', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/warmup', async (req, res) => {
        try {
            res.json(await warmup());
        } catch (error) {
            logger.error('Model warmup failed', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    router.get('/errors', async (req, res) => {
        try {
            res.json(await getErrorsPayload(req.query));
        } catch (error) {
            logger.error('Failed to get RAG errors', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/migration/status', async (req, res) => {
        try {
            res.json(await getMigrationStatus());
        } catch (error) {
            logger.error('Failed to get migration status', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/migration/start', async (req, res) => {
        try {
            res.json(await startMigration(req.body || {}));
        } catch (error) {
            logger.error('Failed to start migration', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/patterns', async (req, res) => {
        try {
            res.json(await getPatternsPayload(req.query));
        } catch (error) {
            logger.error('Failed to get patterns', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/patterns/discover', async (req, res) => {
        try {
            res.json(await discoverPatterns());
        } catch (error) {
            logger.error('Pattern discovery failed', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/patterns/:id/approve', async (req, res) => {
        try {
            res.json(await approvePattern({
                id: req.params.id,
                approvedBy: req.body?.approvedBy
            }));
        } catch (error) {
            logger.error('Failed to approve pattern', { error: error.message });
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.put('/patterns/:id/reject', async (req, res) => {
        try {
            res.json(await rejectPattern({
                id: req.params.id,
                rejectedBy: req.body?.rejectedBy,
                reason: req.body?.reason
            }));
        } catch (error) {
            logger.error('Failed to reject pattern', { error: error.message });
            res.status(error.status || 500).json({ error: error.message });
        }
    });

    router.get('/graph/fill-rate', async (req, res) => {
        try {
            res.json(await getGraphFillRatePayload());
        } catch (error) {
            logger.error('Failed to get graph fill-rate', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    });
}

export default {
    createRagDiagnosticsHelpers,
    registerRagDiagnosticsRoutes
};