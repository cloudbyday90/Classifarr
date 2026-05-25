import { metadataProviderIntegrityService } from './metadataProviderIntegrityService.mjs';

/** @internal */
export function buildTmdbRuntimeSignature(category, fallback, fields = []) {
    return [
        category,
        fallback || 'unknown',
        ...fields.map((value) => String(value || 'none').trim().toLowerCase().replace(/\s+/g, '_')),
    ].join(':');
}

export function classifyHealthError(error) {
    const isCertError = error.code === 'CERT_HAS_EXPIRED' ||
        error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        error.code === 'CERT_NOT_YET_VALID' ||
        (error.message && error.message.includes('certificate'));

    if (isCertError) {
        return {
            healthy: false,
            ssl_error: true,
            api_reachable: false,
            message: `SSL certificate issue: ${error.message}`
        };
    }

    const isNetworkError = error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ETIMEDOUT';

    if (isNetworkError) {
        return {
            healthy: false,
            ssl_error: false,
            api_reachable: false,
            message: `Network error: ${error.message}`
        };
    }

    if (error.response) {
        return {
            healthy: false,
            ssl_error: false,
            api_reachable: true,
            message: error.response.data?.status_message || `API error: ${error.response.status}`
        };
    }

    return {
        healthy: false,
        ssl_error: false,
        api_reachable: false,
        message: error.message
    };
}

export function mapSearchResults(results, mediaType) {
    return results
        .filter(r => r.media_type === 'movie' || r.media_type === 'tv' || mediaType !== 'multi')
        .map(item => ({
            id: item.id,
            title: item.title || item.name,
            original_title: item.original_title || item.original_name,
            media_type: item.media_type || mediaType,
            year: (item.release_date || item.first_air_date || '').substring(0, 4),
            overview: item.overview,
            poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w185${item.poster_path}` : null,
            vote_average: item.vote_average
        }))
        .slice(0, 10);
}

/** @internal */
export function buildIntegrityWarning({ category, messageSuffix, metadata, dedupeSignature }) {
    return {
        provider: 'tmdb',
        category,
        message: `TMDB ${messageSuffix}`,
        metadata,
        dedupeSignature
    };
}

export function handleTmdbProviderFailure(error, { category, messageSuffix, idMetadata = {}, dedupeFields = [] }) {
    metadataProviderIntegrityService.warnProviderRuntimeFailure(
        buildIntegrityWarning({
            category,
            messageSuffix,
            metadata: {
                ...idMetadata,
                error: error.message,
                status: error.response?.status ?? null,
                code: error.code ?? null,
            },
            dedupeSignature: buildTmdbRuntimeSignature(
                category,
                error.response?.status ?? error.code ?? error.message,
                dedupeFields
            ),
        })
    );
}
