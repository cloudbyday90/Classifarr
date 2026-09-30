import { isOmdbNotFoundMessage } from './omdbResponseClassifier.mjs';
import { OMDbLimitReachedError } from './omdbQuota.mjs';
import { isProviderCredentialRejection } from './providerCredentialRejection.mjs';
import { createOmdbRetryCheckpoint, readOmdbRetryCheckpoint } from './omdbRetryCheckpoint.mjs';

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
        (status >= 500 && status <= 599);

    return isTransientHttpStatus ||
        code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' ||
        code === 'ECONNRESET' ||
        code === 'ECONNREFUSED' ||
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
    let checkpoint = readOmdbRetryCheckpoint(item, item.omdb_lookup_checkpoint);
    try {
        let omdbResult = null;
        if (item.imdb_id && !checkpoint) {
            omdbResult = await omdbService.getByIMDBId(item.imdb_id, undefined, { queueOwned: true,
                onNotFound: context => { checkpoint = createOmdbRetryCheckpoint(item, context); } });
        }
        if (!omdbResult && item.title) {
            omdbResult = await omdbService.getByTitle(item.title, item.year, item.media_type, undefined, {
                queueOwned: true, ...(checkpoint ? { expectedCredentialContext: {
                    source: 'omdb', id: checkpoint.configId, generation: checkpoint.generation,
                } } : {}),
            });
        }

        if (omdbResult) {
            return { success: true, data: omdbResult };
        }

        return { success: false, error: 'OMDb not found' };
    } catch (error) {
        if (['OMDB_ADMISSION_WAIT', 'OMDB_ADMISSION_UNAVAILABLE', 'OMDB_LOOKUP_RESTART'].includes(error.code)) {
            return { success: false, providerAdmissionWait: true, retryAfterSeconds: error.retryAfterSeconds,
                omdbCheckpoint: error.code === 'OMDB_LOOKUP_RESTART' ? null : checkpoint };
        }
        if (isProviderCredentialRejection(error)) {
            return { success: false, credentialsRejected: true, error: 'provider_credentials_rejected' };
        }
        if (error instanceof OMDbLimitReachedError) {
            return { success: false, deferUntilDailyReset: true, error: 'OMDb daily quota unavailable', omdbCheckpoint: checkpoint };
        }
        if (isTransientOmdbTransportError(error)) {
            logger.warn('OMDb enrichment transient error', {
                item: item.title,
                error: error.message,
                code: error.code || null
            });
        } else {
            logger.error('OMDb enrichment failed', { error: error.message, item: item.title });
        }
        return { success: false, error: error.message, transient: isTransientOmdbTransportError(error),
            retryAfterSeconds: error.retryAfterSeconds, omdbCheckpoint: checkpoint };
    }
}
