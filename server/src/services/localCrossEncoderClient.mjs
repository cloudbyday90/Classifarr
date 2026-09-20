/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readBoundedResponseBody } from '../utils/httpResponseBody.mjs';
import { resolveCrossEncoderOrigin, inspectCrossEncoderInfo, CROSS_ENCODER_BATCH_SIZE } from './localCrossEncoderConfig.mjs';

export function validateCrossEncoderInput({ query, texts } = {}) {
  if (typeof query !== 'string' || !query.trim() || Buffer.byteLength(query) > 4096 ||
      !Array.isArray(texts) || texts.length < 1 || texts.length > CROSS_ENCODER_BATCH_SIZE ||
      texts.some(text => typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 4096) ||
      Buffer.byteLength(JSON.stringify({ query, texts, raw_scores: true, return_text: false, truncate: false })) > 64 * 1024) throw new Error('cross_encoder_input_invalid');
  return { query, texts: [...texts] };
}

export function parseCrossEncoderScores(rows, count) {
  if (!Array.isArray(rows) || rows.length !== count) throw new Error('cross_encoder_response_invalid');
  const scores = Array(count), seen = new Set();
  for (const row of rows) {
    if (!row || Object.keys(row).some(key => !['index', 'score', 'text'].includes(key)) ||
        (row.text !== undefined && row.text !== null) || !Number.isSafeInteger(row.index) || row.index < 0 || row.index >= count ||
        seen.has(row.index) || typeof row.score !== 'number' || !Number.isFinite(row.score)) throw new Error('cross_encoder_response_invalid');
    seen.add(row.index); scores[row.index] = row.score;
  }
  return scores;
}

/** Local pair inference only. No generation, retries, model pulls, logging, persistence or fallback. */
export function createLocalCrossEncoderClient({ origin } = {}, { fetchRequest = fetch, now = () => performance.now() } = {}) {
  const baseUrl = resolveCrossEncoderOrigin(origin);
  async function request(path, body, signal) {
    const abort = AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]);
    let failureCode = 'cross_encoder_transport_unavailable';
    try {
      abort.throwIfAborted();
      const response = await fetchRequest(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: abort });
      if (!response.ok) {
        failureCode = response.status === 429 ? 'cross_encoder_overloaded'
          : [400, 413, 422].includes(response.status) ? 'cross_encoder_input_rejected' : failureCode;
        // Cleanup must not expose a provider body or replace the redacted failure.
        await Promise.allSettled([response.body?.cancel()]);
        throw new Error('provider_rejected');
      }
      const bytes = await readBoundedResponseBody(response, 64 * 1024);
      abort.throwIfAborted();
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      signal?.throwIfAborted();
      throw new Error(abort.aborted ? 'cross_encoder_timeout' : failureCode);
    }
  }
  const inspect = async signal => inspectCrossEncoderInfo(await request('/info', undefined, signal));
  return { inspect, async score(input, { signal, onScoringCall = () => {} } = {}) {
    const { query, texts } = validateCrossEncoderInput(input);
    const identity = await inspect(signal), start = now();
    signal?.throwIfAborted(); onScoringCall();
    const response = await request('/rerank', { query, texts, raw_scores: true, return_text: false, truncate: false }, signal);
    const scores = parseCrossEncoderScores(response, texts.length);
    await inspect(signal); signal?.throwIfAborted();
    const latencyMs = now() - start;
    if (!Number.isFinite(latencyMs) || latencyMs < 0) throw new Error('cross_encoder_clock_invalid');
    return { identity, scores, latencyMs: Math.round(latencyMs) };
  } };
}
