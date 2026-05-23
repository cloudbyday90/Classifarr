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

export async function testConnection(baseUrl, apiKey) {
	try {
		const response = await httpGet(baseUrl, {
			params: {
				apikey: apiKey,
				t: 'The Matrix',
				y: 1999,
			},
		});

		if (response.data.Response === 'True') {
			return { success: true, message: 'OMDb connection successful', data: response.data };
		}

		return { success: false, error: response.data.Error || 'Unknown error' };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

export async function checkHealth(baseUrl, apiKey) {
	try {
		const response = await httpGet(baseUrl, {
			params: {
				apikey: apiKey,
				t: 'Test',
			},
			timeout: 10000,
		});

		if (response.data.Response === 'True' || response.data.Response === 'False') {
			return {
				healthy: true,
				ssl_error: false,
				api_reachable: true,
				message: 'OMDb API is healthy'
			};
		}

		return {
			healthy: false,
			ssl_error: false,
			api_reachable: true,
			message: 'Unexpected API response format'
		};
	} catch (error) {
		const isCertError = isCertificateError(error);

		if (isCertError) {
			return {
				healthy: false,
				ssl_error: true,
				api_reachable: false,
				message: `SSL certificate issue: ${error.message}. OMDb enrichment will be skipped until the certificate is renewed.`
			};
		}

		const msg = (error.message || '').toLowerCase();
		const isNetworkError = error.code === 'ECONNREFUSED' ||
			error.code === 'ENOTFOUND' ||
			error.code === 'ETIMEDOUT' ||
			error.code === 'ECONNRESET' ||
			error.code === 'EAI_AGAIN' ||
			msg.includes('socket hang up');

		if (isNetworkError) {
			return {
				healthy: false,
				ssl_error: false,
				api_reachable: false,
				message: `Network error: ${error.message}`
			};
		}

		return {
			healthy: false,
			ssl_error: false,
			api_reachable: false,
			message: error.message
		};
	}
}
