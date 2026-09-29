import { isOmdbNotFoundMessage } from './omdbResponseClassifier.mjs';

export function isExpectedOmdbMiss(errorMessage) {
    return isOmdbNotFoundMessage(errorMessage);
}

export function isTransientOmdbTransportError(error) {
    const code = String(error?.code || '').toUpperCase();
    const normalized = String(error?.message || '').toLowerCase();
    const status = error?.response?.status;

    const isTransientHttpStatus =
        status === 408 ||
        status === 429 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        (status >= 520 && status <= 527) ||
        status === 530;

    return isTransientHttpStatus ||
        code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'EAI_AGAIN' ||
        normalized.includes('timeout') ||
        normalized.includes('socket hang up') ||
        normalized.includes('cloudflare');
}

export function buildOmdbFallbackReason(resultError) {
    if (isExpectedOmdbMiss(resultError)) {
        return 'OMDb not found';
    }

    if (!resultError) {
        return 'OMDb retry exhausted';
    }

    return `OMDb retry exhausted: ${String(resultError).slice(0, 80)}`;
}

export async function enrichWithOmdb({ omdbService, logger }, item) {
    try {
        let omdbResult = null;
        if (item.imdb_id) {
            omdbResult = await omdbService.getByIMDBId(item.imdb_id);
        }
        if (!omdbResult && item.title) {
            omdbResult = await omdbService.getByTitle(item.title, item.year, item.media_type);
        }

        if (omdbResult) {
            return { success: true, data: omdbResult };
        }

        return { success: false, error: 'OMDb not found' };
    } catch (error) {
        if (isTransientOmdbTransportError(error)) {
            logger.warn('OMDb enrichment transient error', {
                item: item.title,
                error: error.message,
                code: error.code || null
            });
        } else {
            logger.error('OMDb enrichment failed', { error: error.message, item: item.title });
        }
        return { success: false, error: error.message };
    }
}
