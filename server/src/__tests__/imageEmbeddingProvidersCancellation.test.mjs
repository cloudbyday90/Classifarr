/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';

const httpGetBinary = jest.fn();
const httpPost = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({ httpGetBinary, httpPost, httpGet: jest.fn() }));
const { embedLocal, embedCloud, fetchImageBase64, MAX_IMAGE_BYTES } = await import('../services/imageEmbeddingProviders.mjs');
const { EMBEDDING_MAX_RESPONSE_BYTES } = await import('../services/embeddingHttpClient.mjs');

beforeEach(() => { jest.resetAllMocks(); });
const imageUrl = 'https://example.com/poster';
const cases = [
    ['local', signal => embedLocal(imageUrl, {}, { model: 'fixture', imageSize: 384, signal }, 'fixture-key'),
        { embedding: [0.1, 0.2], dims: 2 }, false],
    ['vertex', signal => embedCloud(imageUrl, { image_embedding_cloud_provider: 'vertex',
        image_embedding_cloud_api_key: 'fixture-key', image_embedding_cloud_api_endpoint: 'https://example.com' },
    { model: 'fixture', imageSize: 384, signal }), { predictions: [{ imageEmbedding: [0.1, 0.2] }] }, true],
    ['cohere', signal => embedCloud(imageUrl, { image_embedding_cloud_provider: 'cohere',
        image_embedding_cloud_api_key: 'fixture-key' }, { model: 'fixture', imageSize: 384, signal }),
    { embeddings: [[0.1, 0.2]] }, true],
    ['voyage', signal => embedCloud(imageUrl, { image_embedding_cloud_provider: 'voyage',
        image_embedding_cloud_api_key: 'fixture-key' }, { model: 'fixture', imageSize: 384, signal }),
    { data: [{ embedding: [0.1, 0.2] }] }, false],
];

test.each(cases)('%s refuses pre-aborted work before download or POST', async (_name, run) => {
    await expect(run(AbortSignal.abort('secret'))).rejects.toMatchObject({ name: 'AbortError', message: 'Request cancelled' });
    expect(httpGetBinary).not.toHaveBeenCalled();
    expect(httpPost).not.toHaveBeenCalled();
});

test.each(cases)('%s forwards signal and retains evidence and byte budgets', async (_name, run, data, downloads) => {
    const signal = new AbortController().signal;
    httpGetBinary.mockResolvedValue(Buffer.from('poster'));
    httpPost.mockResolvedValue({ data });
    await expect(run(signal)).resolves.toMatchObject({ embedding: [0.1, 0.2], dims: 2, model: 'fixture', size: 384 });
    expect(httpPost).toHaveBeenCalledWith(expect.any(String), expect.any(Object), expect.objectContaining({
        signal, maxResponseBytes: EMBEDDING_MAX_RESPONSE_BYTES,
    }));
    if (downloads) expect(httpGetBinary).toHaveBeenCalledWith(imageUrl, {
        signal, timeout: 15000, maxBytes: MAX_IMAGE_BYTES,
    });
    else expect(httpGetBinary).not.toHaveBeenCalled();
});

test.each(cases)('%s discards a late successful HTTP response after cancellation', async (_name, run, data) => {
    const caller = new AbortController();
    httpGetBinary.mockResolvedValue(Buffer.from('poster'));
    httpPost.mockImplementation(async () => { caller.abort(); return { data }; });
    await expect(run(caller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test.each(cases.filter(entry => entry[3]))('%s never sends inference after cancelled download', async (_name, run) => {
    const caller = new AbortController();
    httpGetBinary.mockImplementation(async () => { caller.abort(); return Buffer.from('poster'); });
    await expect(run(caller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(httpPost).not.toHaveBeenCalled();
});

test('oversized poster still fails validation without encoding it', async () => {
    httpGetBinary.mockResolvedValue(Buffer.alloc(MAX_IMAGE_BYTES + 1));
    await expect(fetchImageBase64(imageUrl)).rejects.toThrow('Image payload exceeds maximum size');
});
