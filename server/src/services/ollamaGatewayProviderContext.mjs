/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createGatewayClient } from '../ollamaGateway/client.mjs';
import { gatewayError } from '../ollamaGateway/contract.mjs';
import { readEmbeddingResponse } from '../utils/embeddingValidation.mjs';
import { createOllamaGatewayGenerationMethods } from './ollamaGatewayGenerationMethods.mjs';
import { assertGatewayEndpoint, canonicalGatewayModel, gatewayDeadline } from './ollamaGatewayProviderIdentity.mjs';

/** Explicit local-only dependency; never reads settings or enables routing itself. */
export function createOllamaGatewayProviderContext({ configuration, gateway }) {
  const model = canonicalGatewayModel(configuration.model);
  const embeddingModel = configuration.embeddingModel == null ? null : canonicalGatewayModel(configuration.embeddingModel);
  const models = [...new Set([model, embeddingModel].filter(Boolean))];
  const config = Object.freeze({ ...configuration, model, embeddingModel });
  assertGatewayEndpoint(config.baseUrl, config.host, config.port);
  const client = createGatewayClient(gateway, { expectedUpstream: config.baseUrl });
  if (models.some(name => !gateway.models.includes(name))) { client.close(); throw gatewayError('gateway_model_invalid', 400); }
  let closed = false;
  const assertOpen = () => { if (closed) throw gatewayError('gateway_client_closed'); };
  const assertModel = (value = model, expected = model) => {
    assertOpen();
    if (!expected || canonicalGatewayModel(value) !== expected) throw gatewayError('gateway_model_mismatch', 409);
    return expected;
  };
  const generation = createOllamaGatewayGenerationMethods({ config, client, assertModel });
  const embedding = embeddingModel ? createOllamaGatewayGenerationMethods({ config: { ...config, model: embeddingModel }, client,
    assertModel: value => assertModel(value ?? embeddingModel, embeddingModel) }) : null;
  const inspect = async (path, body, options = {}) => {
    assertOpen();
    return client.request(path, body, { signal: options.signal, timeoutMs: gatewayDeadline(options.timeoutMs, 5000) });
  };
  const list = async (path, options) => {
    const data = await inspect(path, undefined, options);
    if (!Array.isArray(data.models)) throw gatewayError('gateway_response_invalid');
    const selected = data.models.filter(entry => models.includes(entry?.name));
    if (new Set(selected.map(entry => entry.name)).size !== selected.length) throw gatewayError('gateway_response_invalid');
    return selected;
  };
  const verify = async (methods, options = {}) => {
    const result = await methods.preflightConnection(options);
    if (!result.success) throw Object.assign(new Error(result.error), { code: result.errorCode });
  };
  const embed = async (text, requestedModel = embeddingModel, keepAlive = '5m', signal = null, options = {}) => {
    assertModel(requestedModel, embeddingModel);
    if (typeof text !== 'string' || !text.length || keepAlive !== '5m') throw gatewayError('gateway_body_invalid', 400);
    await verify(embedding, { signal, expectedModelDigest: options.expectedModelDigest });
    const data = await client.request('/api/embed', { model: embeddingModel, input: text, truncate: false, keep_alive: '5m' },
      { signal, timeoutMs: gatewayDeadline(options.timeoutMs, 300000), maxResponseBytes: 4 * 1024 * 1024 });
    const vector = readEmbeddingResponse(data, 'ollama');
    return { embedding: vector, dims: vector.length };
  };
  return Object.freeze({
    ...generation,
    assertEndpoint(host, port) { assertOpen(); assertGatewayEndpoint(config.baseUrl, host, port); },
    async getVersion(options = {}) {
      const data = await inspect('/api/version', undefined, options);
      return typeof data.version === 'string' ? data.version : null;
    },
    getModels(options = {}) { return list('/api/tags', options); },
    getLoadedModels(options = {}) { return list('/api/ps', options); },
    getModelInfo(requestedModel = model, options = {}) {
      assertOpen();
      const name = canonicalGatewayModel(requestedModel);
      if (!models.includes(name)) throw gatewayError('gateway_model_mismatch', 409);
      return inspect('/api/show', { model: name, verbose: false }, options);
    },
    embed,
    async warmModel(options = {}) {
      assertOpen();
      await verify(generation, { signal: options.signal, expectedModelDigest: options.expectedModelDigest });
      await client.request('/api/generate', { model, prompt: '', stream: false, keep_alive: '5m' },
        { signal: options.signal, timeoutMs: gatewayDeadline(options.timeoutMs, 60000) });
      return { success: true, model };
    },
    async warmEmbeddingModel(options = {}) {
      await embed('warmup', embeddingModel, '5m', options.signal, options);
      return { success: true, model: embeddingModel };
    },
    close() { if (!closed) { closed = true; client.close(); } },
  });
}
