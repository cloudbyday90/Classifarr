/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../utils/httpClient.mjs';
import { rateLimiters } from '../utils/rateLimiter.mjs';
import { tmdbObservationFailure } from './tmdbObservationFailure.mjs';

const stringList = value => Array.isArray(value) && value.length > 0 && value.length <= 500 &&
    value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 100);

/** Fixed-origin, bounded read. No credentials or upstream error text leave this boundary. */
export async function verifyInventoryCredential(apiKey, { request = httpGet,
    execute = fn => rateLimiters.tmdb.execute(fn) } = {}) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) return { verified: false, category: 'authentication' };
    try {
        const response = await execute(() => request('https://api.themoviedb.org/3/configuration', {
            params: { api_key: apiKey }, timeout: 5000, maxResponseBytes: 65536,
        }));
        const valid = response?.status === 200 && stringList(response.data?.change_keys) &&
            stringList(response.data?.images?.poster_sizes) &&
            typeof response.data?.images?.secure_base_url === 'string' &&
            response.data.images.secure_base_url.startsWith('https://');
        return valid ? { verified: true } : { verified: false, category: 'invalid_response' };
    } catch (error) {
        const { category, retryAfterMs } = tmdbObservationFailure(error);
        return { verified: false, category, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) };
    }
}

export function inventoryCredentialProbeDelay(failures, retryAfterMs, random = Math.random) {
    const jitter = Math.max(0, Math.min(1, Number(random()) || 0));
    const base = Math.min(5 * 3600000, 15 * 60000 * 2 ** Math.min(10, failures));
    const hint = Number.isFinite(retryAfterMs) ? Math.max(0, Math.min(30 * 86400000, retryAfterMs)) : 0;
    return Math.ceil(Math.max(base * (1 + jitter * 0.2), hint));
}
