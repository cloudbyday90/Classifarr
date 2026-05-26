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

export function createRagRoute(handler) {
    return asyncHandler(async (req, res) => {
        const payload = await handler(req, res);
        return sendData(res, payload);
    });
}
