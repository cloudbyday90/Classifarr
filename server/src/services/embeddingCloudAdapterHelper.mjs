import { postEmbeddingRequest } from './embeddingHttpClient.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('EmbeddingProvider');

export async function executeCloudEmbedding({ text, model, config, signal, url, bodyBuilder, responseParser, providerName, errorExtractor }, { getAdaptiveTimeout, createRetriedOperation, recordRetry }) {
    const timeout = getAdaptiveTimeout(config);
    const maxRetries = config.max_retries || 3;
    const baseDelay = config.retry_delay || 1000;
    const backoffMultiplier = config.retry_backoff_multiplier || 2;
    const jitter = config.jitter_factor || 0.3;

    const makeRequest = async () => {
        const { body, headers } = bodyBuilder(text, model);
        const response = await postEmbeddingRequest(url, body, { headers, timeout, signal });
        return responseParser(response.data);
    };

    const embeddingWithRetry = await createRetriedOperation(makeRequest, {
        maxRetries,
        baseDelay,
        multiplier: backoffMultiplier,
        jitter,
        signal,
        onRetry: (error, attempt, delay) => {
            logger.warn(`Retrying ${providerName} embedding request`, {
                attempt: attempt + 1,
                delay,
                error: error.message
            });
            const retryAfter = error.response?.headers?.['retry-after'];
            recordRetry(attempt + 1, error, delay, retryAfter);
        }
    });

    try {
        return await embeddingWithRetry();
    } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ERR_CANCELED' || error.code === 'ABORT_ERR'
            || error.code === 'HTTP_RESPONSE_TOO_LARGE' || error.code === 'INVALID_EMBEDDING') {
            throw error;
        }
        throw new Error(`${providerName} embedding failed: ${errorExtractor(error)}`);
    }
}
