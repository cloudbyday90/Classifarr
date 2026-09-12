/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalStudyModel, resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { readBoundedResponseBody } from '../utils/httpResponseBody.mjs';
import { buildCandidateAdjudicationResponseSchema } from './candidateAdjudicationResponseContract.mjs';
import { isReasoningModel } from './aiResponseNormalizer.mjs';

export const DESCRIPTION_BENCHMARK_OUTPUT_TOKENS = 64;
export const ADJUDICATION_REPLAY_OUTPUT_TOKENS = 256;

/** Local-only inference with no provider fallback, model pulls or persistence. */
export function createLocalDescriptionBenchmarkClient(config, { fetchRequest = fetch, now = () => performance.now() } = {}) {
  if (config?.primary_provider !== 'ollama') throw new Error('description_benchmark_local_provider_required');
  const { baseUrl, model } = resolveLocalStudyEmbeddingConfig({ ...config, rag_enabled: true,
    embedding_provider_mode: 'same', embedding_model: config.ollama_model });
  async function request(path, body, signal) {
    const response = await fetchRequest(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([AbortSignal.timeout(180_000), ...(signal ? [signal] : [])]),
    });
    const bytes = await readBoundedResponseBody(response, 1024 * 1024);
    if (!response.ok) throw new Error('description_benchmark_provider_failed');
    try { return JSON.parse(bytes.toString('utf8')); }
    catch { throw new Error('description_benchmark_response_invalid'); }
  }
  async function inspect(signal) {
    const tags = await request('/api/tags', undefined, signal);
    const matches = (Array.isArray(tags?.models) ? tags.models : []).filter(entry => {
      try { return canonicalStudyModel(entry.name ?? entry.model) === model; } catch { return false; }
    });
    const entry = matches[0];
    if (matches.length !== 1 || entry.remote_host || entry.remote_model || !/^(sha256:)?[a-f0-9]{64}$/.test(entry.digest ?? '')) {
      throw new Error('description_benchmark_installed_local_model_required');
    }
    const details = await request('/api/show', { model, verbose: false }, signal);
    const architecture = details?.model_info?.['general.architecture'];
    const contextLength = details?.model_info?.[`${architecture}.context_length`];
    if (details?.remote_host || details?.remote_model || !Array.isArray(details?.capabilities) || !details.capabilities.includes('completion') ||
        !Number.isInteger(contextLength) || contextLength < 8192) throw new Error('description_benchmark_model_capability_invalid');
    return { model, digest: entry.digest.replace(/^sha256:/, ''), contextLength };
  }
  return {
    inspect,
    async generate({ prompt, count, context, identity, signal, responseContract = 'candidate', onGenerationCall = () => {} }) {
      if (!['candidate', 'adjudication'].includes(responseContract)) throw new Error('description_benchmark_response_contract_invalid');
      const outputTokens = responseContract === 'adjudication' ? ADJUDICATION_REPLAY_OUTPUT_TOKENS : DESCRIPTION_BENCHMARK_OUTPUT_TOKENS;
      if (typeof prompt !== 'string' || !prompt.length || ![8192, 16384, 32768, 65536].includes(context) ||
          !Number.isInteger(count) || count < 2 || count > 3 || context > identity.contextLength ||
          Buffer.byteLength(prompt, 'utf8') > (context - outputTokens) * 3) {
        throw new Error('description_benchmark_context_budget');
      }
      const check = async () => {
        const current = await inspect(signal);
        if (current.model !== identity.model || current.digest !== identity.digest || current.contextLength !== identity.contextLength) {
          throw new Error('description_benchmark_model_changed');
        }
      };
      await check();
      const start = now();
      onGenerationCall();
      const result = await request('/api/generate', { model, prompt, stream: false, think: false, keep_alive: '5m',
        format: responseContract === 'adjudication' ? (isReasoningModel(model) ? undefined : buildCandidateAdjudicationResponseSchema(count)) : { type: 'object', properties: { candidate: { type: 'integer', enum: Array.from({ length: count + 1 }, (_, index) => index) } },
          required: ['candidate'], additionalProperties: false },
        options: { temperature: 0, seed: 42, num_ctx: context, num_predict: outputTokens },
      }, signal);
      const latencyMs = Math.round(now() - start);
      await check();
      if (canonicalStudyModel(result?.model) !== model || result.remote_host || result.remote_model || result.done !== true ||
          typeof result.response !== 'string' || !['stop', 'length'].includes(result.done_reason) ||
          !Number.isSafeInteger(result.prompt_eval_count) || result.prompt_eval_count < 1 || result.prompt_eval_count > context ||
          !Number.isSafeInteger(result.eval_count) || result.eval_count < 0 || result.eval_count > outputTokens) {
        throw new Error('description_benchmark_generation_invalid');
      }
      return { response: result.response, latencyMs, promptTokens: result.prompt_eval_count, outputTokens: result.eval_count,
        outputLimitReached: result.done_reason === 'length',
        inputTruncation: 'unknown', contextLimitSuspected: result.prompt_eval_count >= context - outputTokens };
    },
  };
}
