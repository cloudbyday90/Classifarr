/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
    buildRagErrorResponse,
    createRagRoute
} from './ragRouteResponseSupport.mjs';
import {
    getAdvancedConfig,
    updateAdvancedConfig,
    getRetryConfig,
    updateRetryConfig,
    exportConfig,
} from './ragOperationsConfig.mjs';
import {
    getLogsPayload,
    clearLogs,
    exportLogs,
    exportMetrics,
    clearEmbeddings,
    reembedImages,
    resetConfig,
} from './ragOperationsData.mjs';

export function createRagOperationsHelpers({ db }) {
    return {
        clearEmbeddings: () => clearEmbeddings({ db }),
        clearLogs: () => clearLogs({ db }),
        exportConfig: () => exportConfig({ db }),
        exportLogs: () => exportLogs({ db }),
        exportMetrics: () => exportMetrics({ db }),
        getAdvancedConfig: () => getAdvancedConfig({ db }),
        getLogsPayload: (options) => getLogsPayload({ db }, options),
        getRetryConfig: () => getRetryConfig({ db }),
        reembedImages: () => reembedImages({ db }),
        resetConfig: () => resetConfig({ db }),
        updateAdvancedConfig: (payload) => updateAdvancedConfig({ db }, payload),
        updateRetryConfig: (payload) => updateRetryConfig({ db }, payload),
    };
}

export function registerRagOperationsRoutes({
    router,
    logger,
    helpers
}) {
    const {
        clearEmbeddings,
        clearLogs,
        exportConfig,
        exportLogs,
        exportMetrics,
        getAdvancedConfig,
        getLogsPayload,
        getRetryConfig,
        reembedImages,
        resetConfig,
        updateAdvancedConfig,
        updateRetryConfig
    } = helpers;

    router.get('/logs', createRagRoute(
        async (req) => getLogsPayload(req.query),
        {
            logger,
            logMessage: 'Failed to get logs'
        }
    ));

    router.delete('/logs', createRagRoute(
        async () => clearLogs(),
        {
            logger,
            logMessage: 'Failed to clear logs'
        }
    ));

    router.get('/advanced', createRagRoute(
        async () => getAdvancedConfig(),
        {
            logger,
            logMessage: 'Failed to get advanced config'
        }
    ));

    router.put('/advanced', createRagRoute(
        async (req) => updateAdvancedConfig(req.body),
        {
            logger,
            logMessage: 'Failed to update advanced config'
        }
    ));

    router.get('/settings/embedding/retry', createRagRoute(
        async () => getRetryConfig(),
        {
            logger,
            logMessage: 'Failed to get retry config'
        }
    ));

    router.put('/settings/embedding/retry', createRagRoute(
        async (req) => updateRetryConfig(req.body),
        {
            logger,
            logMessage: 'Failed to update retry config',
            shouldLogError: (error) => !error?.status && !error?.statusCode && !error?.httpStatus,
            resolveErrorResponse: (error) => buildRagErrorResponse(error, {
                fallbackStatus: 500,
                includeDetails: true
            })
        }
    ));

    router.post('/export/config', createRagRoute(
        async () => exportConfig(),
        {
            logger,
            logMessage: 'Failed to export config'
        }
    ));

    router.post('/export/logs', createRagRoute(
        async () => exportLogs(),
        {
            logger,
            logMessage: 'Failed to export logs',
            beforeSend: (res) => {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=rag-logs.json');
            }
        }
    ));

    router.post('/export/metrics', createRagRoute(
        async () => exportMetrics(),
        {
            logger,
            logMessage: 'Failed to export metrics',
            beforeSend: (res) => {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=rag-metrics.json');
            }
        }
    ));

    router.post('/clear-embeddings', createRagRoute(
        async () => clearEmbeddings(),
        {
            logger,
            logMessage: 'Failed to clear embeddings'
        }
    ));

    router.post('/reembed-images', createRagRoute(
        async () => reembedImages(),
        {
            logger,
            logMessage: 'Failed to clear image embeddings'
        }
    ));

    router.post('/reset-config', createRagRoute(
        async () => resetConfig(),
        {
            logger,
            logMessage: 'Failed to reset config'
        }
    ));
}
