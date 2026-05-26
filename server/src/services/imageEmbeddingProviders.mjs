import { ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';
import { httpGet, httpPost, httpGetBinary } from '../utils/httpClient.mjs';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchImageBase64(imageUrl) {
    const buffer = await httpGetBinary(imageUrl, {
        timeout: 15000,
        maxBytes: MAX_IMAGE_BYTES,
    });

    if (buffer.length > MAX_IMAGE_BYTES) {
        throw new ValidationError('Image payload exceeds maximum size');
    }

    return buffer.toString('base64');
}

export async function embedLocal(imageUrl, config, { model, imageSize }, localApiKey) {
    const host = config.image_embedding_local_host || 'localhost';
    const port = config.image_embedding_local_port || 8000;
    const timeout = config.image_embedding_local_timeout_ms ?? 15000;
    const headers = {};
    if (localApiKey) {
        headers['X-Api-Key'] = localApiKey;
    }

    const response = await httpPost(
        `http://${host}:${port}/embed-image`,
        {
            image_url: imageUrl,
            model,
            normalize: true,
            image_size: imageSize,
        },
        { timeout, headers }
    );

    const embedding = response.data?.embedding || [];

    return {
        embedding,
        dims: response.data?.dims || embedding.length,
        provider: 'local',
        model,
        size: imageSize
    };
}

export async function embedVertex(imageUrl, { apiKey, apiEndpoint, model, imageSize }) {
    if (!apiEndpoint) {
        throw new ServiceUnavailableError('Vertex API endpoint is required for image embeddings');
    }

    const imageBase64 = await fetchImageBase64(imageUrl);
    const modelId = model || 'multimodalembedding@001';
    const endpoint = `${apiEndpoint}/${modelId}:predict`;

    const response = await httpPost(endpoint, {
        instances: [{ image: { bytesBase64Encoded: imageBase64 } }]
    }, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        timeout: 20000,
    });

    const embedding = response.data?.predictions?.[0]?.imageEmbedding || [];

    return {
        embedding,
        dims: embedding.length,
        provider: 'vertex',
        model: modelId,
        size: imageSize
    };
}

export async function embedVoyage(imageUrl, { apiKey, model, imageSize }) {
    const modelId = model || 'voyage-multimodal-3.5';
    const response = await httpPost(
        'https://api.voyageai.com/v1/embeddings',
        {
            model: modelId,
            input: [{ type: 'image', image_url: imageUrl }],
        },
        {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 20000,
        }
    );

    const embedding = response.data?.data?.[0]?.embedding || [];

    return {
        embedding,
        dims: embedding.length,
        provider: 'voyage',
        model: modelId,
        size: imageSize
    };
}

export async function embedCohere(imageUrl, { apiKey, model, imageSize }) {
    const modelId = model || 'embed-english-v3.0';
    const imageBase64 = await fetchImageBase64(imageUrl);

    const response = await httpPost(
        'https://api.cohere.com/v1/embed',
        {
            model: modelId,
            input_type: 'image',
            images: [imageBase64],
        },
        {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 20000,
        }
    );

    const embedding = response.data?.embeddings?.[0] || [];

    return {
        embedding,
        dims: embedding.length,
        provider: 'cohere',
        model: modelId,
        size: imageSize
    };
}

export async function embedCloud(imageUrl, config, { model, imageSize }) {
    const provider = (config.image_embedding_cloud_provider || '').toLowerCase();
    const apiKey = config.image_embedding_cloud_api_key;
    const apiEndpoint = config.image_embedding_cloud_api_endpoint || config.api_endpoint || '';

    if (!provider) {
        throw new ServiceUnavailableError('Image embedding cloud provider is not configured');
    }
    if (!apiKey) {
        throw new ServiceUnavailableError('Image embedding cloud API key is not configured');
    }

    switch (provider) {
        case 'vertex':
        case 'google':
        case 'vertex_ai':
            return await embedVertex(imageUrl, { apiKey, apiEndpoint, model, imageSize });
        case 'voyage':
            return await embedVoyage(imageUrl, { apiKey, model, imageSize });
        case 'cohere':
            return await embedCohere(imageUrl, { apiKey, model, imageSize });
        default:
            throw new ValidationError(`Image embedding provider not supported: ${provider}`);
    }
}

export async function getLocalModels(config, fallbackApiKey) {
    const host = config?.image_embedding_local_host;
    const port = config?.image_embedding_local_port || 8000;
    const timeout = config?.image_embedding_local_timeout_ms ?? 15000;

    if (!host) {
        throw new ServiceUnavailableError('Image embedding local host is not configured');
    }

    const headers = {};
    const rawApiKey = config?.image_embedding_local_api_key !== undefined
        ? config.image_embedding_local_api_key
        : fallbackApiKey;
    const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
    if (apiKey) {
        headers['X-Api-Key'] = apiKey;
    }

    const response = await httpGet(`http://${host}:${port}/models`, { timeout, headers });
    const models = response.data?.models || [];

    return models.map((model) => ({
        id: model.id || model.name || '',
        name: model.name || model.id || '',
        dims: model.dims,
        image_size: model.image_size
    })).filter((model) => model.id);
}
