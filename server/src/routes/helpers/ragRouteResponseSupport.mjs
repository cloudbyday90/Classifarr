/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';

export function getRagRouteErrorStatus(error, fallbackStatus = 500) {
    return error?.statusCode || error?.status || error?.httpStatus || fallbackStatus;
}

export function buildRagErrorResponse(error, {
    fallbackStatus = 500,
    includeDetails = false
} = {}) {
    const body = {
        error: error.message
    };

    if (includeDetails && Array.isArray(error.details)) {
        body.details = error.details;
    }

    return {
        status: getRagRouteErrorStatus(error, fallbackStatus),
        body
    };
}

export function createRagRoute(handler, {
    logger,
    logMessage,
    fallbackStatus = 500,
    resolveErrorResponse = (error) => buildRagErrorResponse(error, { fallbackStatus }),
    shouldLogError = () => Boolean(logMessage),
    beforeSend
} = {}) {
    return asyncHandler(async (req, res) => {
        try {
            const payload = await handler(req, res);

            if (typeof beforeSend === 'function') {
                beforeSend(res, payload, req);
            }

            return sendData(res, payload);
        } catch (error) {
            if (logger?.error && shouldLogError(error)) {
                logger.error(logMessage, { error: error.message });
            }

            const response = resolveErrorResponse(error);
            return res.status(response.status).json(response.body);
        }
    });
}
