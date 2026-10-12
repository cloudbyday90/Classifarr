/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { httpGet } from '../utils/httpClient.mjs';

/** Saved LAN endpoints are allowed; credentials must stay in headers. */
export function healthProbeUrl(base, path) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new TypeError('Invalid health endpoint');
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
    return url.href;
}

/** @param {{ params?: Record<string, unknown>, timeout?: number, rejectUnauthorized?: boolean }} options */
export async function readHealthProbeJson(url, headers = {}, options = {}) {
    const timeout = Number.isFinite(options.timeout) && options.timeout > 0
        ? Math.min(options.timeout, 10_000) : 10_000;
    const response = await httpGet(url, {
        headers: { Accept: 'application/json', ...headers },
        params: options.params,
        timeout,
        rejectUnauthorized: options.rejectUnauthorized !== false,
        maxResponseBytes: 1_048_576,
        redirect: 'error',
    });
    return response.status === 200 ? response.data : null;
}
