/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readHealthProbeJson } from './healthProbeRequest.mjs';
import { classifyOmdbResponse } from './omdbResponseClassifier.mjs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.every(item => nonempty(item));
const omdbFailureCodes = new Map([
    ['authentication', 'authentication_failed'], ['access_denied', 'authentication_failed'],
    ['quota_exhausted', 'quota_exhausted'], ['rate_limited', 'rate_limited'],
    ['invalid_response', 'response_invalid'], ['not_found', 'response_invalid'],
]);

/** Fixed production endpoints; injectable transport permits isolated HTTP fixtures. */
export function createMetadataHealthProbes({ readJson = readHealthProbeJson } = {}) {
    async function probeTmdbConnection(apiKey) {
        if (!nonempty(apiKey)) return { success: false, code: 'configuration_invalid' };
        const data = await readJson('https://api.themoviedb.org/3/configuration', {}, {
            params: { api_key: apiKey }, timeout: 5000,
        });
        const images = data?.images;
        const valid = data?.success !== false && nonempty(images?.base_url) &&
            nonempty(images?.secure_base_url) && strings(images?.poster_sizes) &&
            images.poster_sizes.length > 0 && strings(data?.change_keys);
        return valid ? { success: true } : null;
    }

    /** @param {Parameters<typeof readHealthProbeJson>[2]} options */
    async function probeOmdbConnection(apiKey, options = {}) {
        const { observeResponse } = options;
        if (!nonempty(apiKey)) return { success: false, code: 'configuration_invalid' };
        let outcome;
        try {
            const data = await readJson('https://www.omdbapi.com/', {}, {
                params: { apikey: apiKey, t: 'The Matrix', y: 1999 },
                ...(observeResponse ? { observeResponse } : {}),
            });
            outcome = classifyOmdbResponse(data, 200);
        } catch (error) {
            // Preserve quota/auth classification even when OMDb uses HTTP 401/429.
            // Transport exceptions stay with the shared sanitized error mapper.
            if (!error?.response) throw error;
            outcome = classifyOmdbResponse(error.response.data, error.response.status);
        }
        return outcome.kind === 'success' ? { success: true }
            : { success: false, code: omdbFailureCodes.get(outcome.kind) || 'connection_failed' };
    }
    return { probeTmdbConnection, probeOmdbConnection };
}

export const { probeTmdbConnection, probeOmdbConnection } = createMetadataHealthProbes();
