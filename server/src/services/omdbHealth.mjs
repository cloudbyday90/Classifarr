/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { httpGet } from '../utils/httpClient.mjs';
import { classifyOmdbResponse } from './omdbResponseClassifier.mjs';
import { OMDB_MAX_RESPONSE_BYTES } from './omdbRequestPolicy.mjs';

export function isCertificateError(error) {
	if (!error) {
		return false;
	}

	const message = (error.message || '').toLowerCase();
	return error.code === 'CERT_HAS_EXPIRED' ||
		error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
		error.code === 'CERT_NOT_YET_VALID' ||
		message.includes('certificate');
}

export function getCertificateErrorSignature(error) {
	const code = error?.code || 'NO_CODE';
	const message = (error?.message || 'no_message').toLowerCase();
	return `${code}:${message}`;
}

// Probes test explicit (including unsaved) credentials outside the local lookup budget.
async function probe(baseUrl, params) {
    try {
        const response = await httpGet(baseUrl, { params, timeout: 10000,
            maxResponseBytes: OMDB_MAX_RESPONSE_BYTES });
        return { ...classifyOmdbResponse(response.data, response.status),
            reachable: true, sslError: false, data: response.data };
    } catch (error) {
        if (error.code === 'HTTP_RESPONSE_TOO_LARGE') {
            return { kind: 'response_too_large', reachable: true, sslError: false,
                message: 'OMDb response exceeds the allowed size' };
        }
        if (error.response) {
            return { ...classifyOmdbResponse(error.response.data, error.response.status),
                reachable: true, sslError: false };
        }
        const sslError = isCertificateError(error);
        return { kind: 'transport_error', reachable: false, sslError,
            message: sslError ? 'OMDb SSL certificate validation failed' : 'OMDb connection failed' };
    }
}

export async function testConnection(baseUrl, apiKey) {
    const outcome = await probe(baseUrl, { apikey: apiKey, t: 'The Matrix', y: 1999 });
    return outcome.kind === 'success'
        ? { success: true, message: 'OMDb connection successful', data: outcome.data }
        : { success: false, error: outcome.message };
}

export async function checkHealth(baseUrl, apiKey) {
    const outcome = await probe(baseUrl, { apikey: apiKey, t: 'Test' });
    const healthy = outcome.kind === 'success' || outcome.kind === 'not_found';
    return {
        healthy,
        ssl_error: outcome.sslError,
        api_reachable: outcome.reachable,
        message: healthy ? 'OMDb API is healthy' : outcome.message,
    };
}
