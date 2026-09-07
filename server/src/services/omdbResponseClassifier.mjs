/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isOmdbLookupPayload, isOmdbSearchPayload } from './omdbPayloadValidation.mjs';

const MESSAGES = Object.freeze({
    success: 'OMDb API is healthy',
    not_found: 'OMDb not found',
    authentication: 'OMDb authentication failed; check the API key',
    quota_exhausted: 'OMDb provider request limit reached',
    rate_limited: 'OMDb request rate limited; try again later',
    invalid_request: 'OMDb rejected the lookup request',
    invalid_response: 'OMDb returned an invalid response',
    provider_error: 'OMDb could not complete the request',
});

function normalizeMessage(value) {
    return typeof value === 'string' && value.length <= 256 ? value.trim().toLowerCase() : '';
}

export function isOmdbNotFoundMessage(value) {
    return /^(?:omdb|movie|series|episode) not found[!.]?$/.test(normalizeMessage(value));
}

/** An HTTP failure cannot become a successful lookup or a confirmed miss. */
export function classifyOmdbResponse(data, status = 200, mode = 'lookup') {
    const ok = Number.isInteger(status) && status >= 200 && status < 300;
    const record = data !== null && typeof data === 'object' && !Array.isArray(data);
    const message = record && data.Response === 'False' ? normalizeMessage(data.Error) : '';
    let kind;
    if ((ok || status === 401 || status === 429) && /^(?:request|daily) limit reached[!.]?$/.test(message)) {
        kind = 'quota_exhausted';
    } else if (status === 401 || (ok && /^(?:invalid api key|no api key provided)[!.]?$/.test(message))) {
        kind = 'authentication';
    } else if (status === 429) {
        kind = 'rate_limited';
    } else if (!ok) {
        kind = 'provider_error';
    } else if (!record || !['True', 'False'].includes(data.Response)) {
        kind = 'invalid_response';
    } else if (data.Response === 'True') {
        const valid = mode === 'search' ? isOmdbSearchPayload(data) : isOmdbLookupPayload(data);
        kind = valid && data.Error == null ? 'success' : 'invalid_response';
    } else if (isOmdbNotFoundMessage(message)) {
        kind = 'not_found';
    } else if (/^(?:too many results|incorrect imdb id)[!.]?$/.test(message)) {
        kind = 'invalid_request';
    } else {
        kind = message ? 'provider_error' : 'invalid_response';
    }
    return { kind, message: MESSAGES[kind] };
}
