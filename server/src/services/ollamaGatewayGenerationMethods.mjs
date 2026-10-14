/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { generate, generateWithProgress } from './ollamaGeneration.mjs';
import { normalizeOllamaModelDigest } from './ollamaVerificationCapabilityIdentity.mjs';
import { gatewayDeadline as deadline } from './ollamaGatewayProviderIdentity.mjs';
/** Generation leaves share their owner's transport and lifetime. */
export function createOllamaGatewayGenerationMethods({ config, client, assertModel }) {
  const { model } = config;
  const transport = Object.freeze({
    async generate(body, { timeout = undefined, signal = undefined } = {}) {
      assertModel(body.model);
      const data = await client.request('/api/generate', body, { signal, timeoutMs: deadline(timeout, 120000) });
      return { data };
    },
    stream(body, { timeout, signal, onRecord }) {
      assertModel(body.model);
      return client.request('/api/generate', body, { signal, timeoutMs: deadline(timeout, 300000), onRecord });
    },
  });
  const preflightConnection = async (options = {}) => {
    assertModel(options.model ?? model);
    // No cached success survives a credential/model change or factory close.
    const data = await client.request('/api/tags', undefined, {
      signal: options.signal, timeoutMs: deadline(options.connectivityTimeoutMs, 5000),
    });
    const matches = Array.isArray(data.models) ? data.models.filter(entry => entry?.name === model) : [];
    const expected = normalizeOllamaModelDigest(options.expectedModelDigest);
    const mismatch = Boolean(options.expectedModelDigest) && (!expected || normalizeOllamaModelDigest(matches[0]?.digest) !== expected);
    if (matches.length !== 1 || mismatch) {
      return { success: false, cached: false, models: [], failureType: mismatch ? 'model_changed' : 'model_not_found',
        errorCode: mismatch ? 'MODEL_DIGEST_MISMATCH' : 'MODEL_NOT_FOUND', error: 'Gateway model identity is unavailable or changed' };
    }
    if (options.probeGeneration === true) {
      const { data: probe } = await transport.generate({ model, prompt: 'Reply with OK only.', stream: false,
        options: { temperature: 0, num_predict: 4, num_ctx: 4096 } },
      { signal: options.signal, timeout: deadline(options.probeTimeoutMs, 120000) });
      if (![probe.response, probe.thinking].some(value => typeof value === 'string' && value.trim())) {
        throw Object.assign(new Error('Gateway generation probe returned no output'), { code: 'EINCOMPLETE' });
      }
    }
    return { success: true, cached: false, model, model_available: true,
      ...(options.includeModels === false ? {} : { models: matches }),
      checks: { connectivity: { ok: true }, model_available: { ok: true, value: true },
        generation_probe: { ok: options.probeGeneration === true, skipped: options.probeGeneration !== true } } };
  };
  return Object.freeze({
    preflightConnection,
    async generate(prompt, requestedModel = model, temperature = 0.30, options = {}) {
      assertModel(requestedModel);
      const checked = await preflightConnection({ model, expectedModelDigest: options.expectedModelDigest, signal: options.signal });
      if (!checked.success) throw Object.assign(new Error(checked.error), { code: checked.errorCode });
      return generate(async () => config, prompt, model, temperature, options, transport);
    },
    generateWithProgress(prompt, requestedModel = model, temperature = 0.30, onProgress = null, controller = null, options = {}) {
      assertModel(requestedModel);
      return generateWithProgress(async () => config, preflightConnection, prompt, model, temperature,
        onProgress, controller, { ...options, hardTimeout: deadline(options.hardTimeout, 300000) }, transport);
    },
  });
}
