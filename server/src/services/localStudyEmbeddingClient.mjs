/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isTrustedLocalOllamaEndpoint } from './ollamaLocalEndpointTrust.mjs';
import { readBoundedResponseBody } from '../utils/httpResponseBody.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

export function canonicalStudyModel(model) {
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$/.test(model) || /cloud/i.test(model)) {
    throw new Error('local_study_embedding_model_invalid');
  }
  return model.includes(':') ? model : `${model}:latest`;
}

export function resolveLocalStudyEmbeddingConfig(config = {}) {
  const separate = config.embedding_provider_mode === 'separate_ollama';
  if (!config.rag_enabled || (!separate &&
      ((config.embedding_provider_mode || 'same') !== 'same' || config.primary_provider !== 'ollama'))) {
    throw new Error('local_study_embeddings_required');
  }
  const host = separate ? config.embedding_ollama_host : config.ollama_host;
  const port = Number((separate ? config.embedding_ollama_port : config.ollama_port) || 11434);
  if (!isTrustedLocalOllamaEndpoint(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('local_study_endpoint_required');
  }
  const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(host) ? host : `http://${host}`);
  url.port = String(port);
  return {
    baseUrl: url.origin,
    model: canonicalStudyModel(separate ? config.embedding_ollama_model : config.embedding_model),
  };
}

/** Local-only study transport. No fallback, model pulls, retries or DB writes. */
export function createLocalStudyEmbeddingClient(config, { fetchRequest = fetch } = {}) {
  const { baseUrl, model } = resolveLocalStudyEmbeddingConfig(config);
  async function request(path, body, signal) {
    const response = await fetchRequest(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([AbortSignal.timeout(60_000), ...(signal ? [signal] : [])]),
    });
    const bytes = await readBoundedResponseBody(response, 4 * 1024 * 1024);
    if (!response.ok) throw new Error('local_study_embedding_request_failed');
    try { return JSON.parse(bytes.toString('utf8')); }
    catch { throw new Error('local_study_embedding_response_invalid'); }
  }
  return {
    provider: 'ollama', model,
    async inspect({ signal } = {}) {
      const tags = await request('/api/tags', undefined, signal);
      const matches = (Array.isArray(tags?.models) ? tags.models : []).filter(entry => {
        try { return canonicalStudyModel(entry.name ?? entry.model) === model; }
        catch { return false; }
      });
      const entry = matches[0];
      if (matches.length !== 1 || entry.remote_host || entry.remote_model ||
          typeof entry.digest !== 'string' || !/^(sha256:)?[a-f0-9]{64}$/.test(entry.digest)) {
        throw new Error('local_study_installed_model_required');
      }
      const details = await request('/api/show', { model, verbose: false }, signal);
      if (details?.remote_host || details?.remote_model || !Array.isArray(details?.capabilities) ||
          !details.capabilities.includes('embedding')) {
        throw new Error('local_study_embedding_capability_required');
      }
      const architecture = details.model_info?.['general.architecture'];
      const dimensions = typeof architecture === 'string' ? details.model_info[`${architecture}.embedding_length`] : undefined;
      return { provider: 'ollama', model, digest: entry.digest.replace(/^sha256:/, ''),
        ...(Number.isInteger(dimensions) && dimensions > 0 && dimensions <= 16000 ? { dimensions } : {}) };
    },
    async embedBatch(texts, { dimensions, signal } = {}) {
      if (!Array.isArray(texts) || texts.length < 1 || texts.length > 8 ||
          texts.some(text => typeof text !== 'string' || !text.trim() || [...text].length > 1000) ||
          !Number.isInteger(dimensions) || dimensions < 1 || dimensions > 16000) {
        throw new Error('local_study_embedding_batch_invalid');
      }
      const result = await request('/api/embed', { model, input: texts, truncate: false, keep_alive: '5m' }, signal);
      if (canonicalStudyModel(result?.model) !== model || result.remote_host || result.remote_model ||
          !Array.isArray(result.embeddings) || result.embeddings.length !== texts.length) {
        throw new Error('local_study_embedding_batch_response_invalid');
      }
      return result.embeddings.map(vector => validateEmbedding(vector, dimensions));
    },
  };
}
