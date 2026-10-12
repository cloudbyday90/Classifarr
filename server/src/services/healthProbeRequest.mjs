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

export async function readHealthProbeJson(url, headers = {}) {
    const response = await httpGet(url, {
        headers: { Accept: 'application/json', ...headers },
        timeout: 10_000,
        maxResponseBytes: 1_048_576,
        redirect: 'error',
    });
    return response.status === 200 ? response.data : null;
}
