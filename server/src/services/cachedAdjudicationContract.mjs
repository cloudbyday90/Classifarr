/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { CANDIDATE_ADJUDICATION_RESPONSE_VERSION } from './candidateAdjudicationResponseContract.mjs';

export const ADJUDICATION_CAPTURE_CONTEXT = 8192;
export const ADJUDICATION_PAIR_LIMIT = 25;
export const adjudicationDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** JSONB object-key ordering and response insertion order are not evidence changes. */
export function adjudicationBatchDigest(batch) {
  if (!batch) return null;
  return adjudicationDigest([batch.version,batch.configuration,
    [batch.identity.model,batch.identity.digest,batch.identity.contextLength],
    batch.records.map(({ key,generated: g }) => [key,g.response,g.latencyMs,g.promptTokens,g.outputTokens,
      g.outputLimitReached,g.inputTruncation,g.contextLimitSuspected]).sort(([a],[b]) => a.localeCompare(b))]);
}
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;

export function adjudicationRequest(entry) {
  const arm = entry.arms.protected;
  const prompt = arm.prompt, count = arm.contract.candidates.length;
  if (typeof prompt !== 'string' || !prompt.length || Buffer.byteLength(prompt) > (8192 - 256) * 3 ||
      ![2, 3].includes(count)) return null;
  const key = adjudicationDigest({ version: 'cached_adjudication_request.v1', prompt,
    candidates: arm.contract.candidates.map(candidate => candidate.libraryId),
    responseVersion: CANDIDATE_ADJUDICATION_RESPONSE_VERSION,
    context: 8192, outputTokens: 256, temperature: 0, seed: 42, thinking: false });
  return { key, prompt, count };
}

export function validAdjudicationPlan(plan) {
  return Array.isArray(plan) && plan.length <= ADJUDICATION_PAIR_LIMIT * 2 &&
    new Set(plan.map(row => row?.key)).size === plan.length && plan.every(row =>
      exact(row, ['key', 'prompt', 'count']) && hex(row.key) && typeof row.prompt === 'string' &&
      row.prompt.length > 0 && Buffer.byteLength(row.prompt) <= (8192 - 256) * 3 && [2, 3].includes(row.count));
}

export function readAdjudicationBatch(batch, configuration) {
  if (!exact(batch, ['version', 'configuration', 'identity', 'records']) || batch.version !== 'cached_adjudication.v1' ||
      !hex(batch.configuration) || batch.configuration !== configuration ||
      !exact(batch.identity, ['model', 'digest', 'contextLength']) || !hex(batch.identity.digest) ||
      typeof batch.identity.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$/.test(batch.identity.model) ||
      !integer(batch.identity.contextLength, 10_000_000) || batch.identity.contextLength < 8192 ||
      !Array.isArray(batch.records) || batch.records.length > 50 ||
      new Set(batch.records.map(row => row?.key)).size !== batch.records.length) return null;
  for (const row of batch.records) {
    if (!exact(row, ['key', 'generated']) || !hex(row.key) ||
        !exact(row.generated, ['response', 'latencyMs', 'promptTokens', 'outputTokens', 'outputLimitReached', 'inputTruncation', 'contextLimitSuspected'])) return null;
    const value = row.generated;
    if (typeof value.response !== 'string' || Buffer.byteLength(value.response) > 16384 ||
        !integer(value.latencyMs, 600000) || !integer(value.promptTokens, 8192) || value.promptTokens < 1 ||
        !integer(value.outputTokens, 256) || typeof value.outputLimitReached !== 'boolean' ||
        typeof value.contextLimitSuspected !== 'boolean' || value.inputTruncation !== 'unknown') return null;
  }
  return batch;
}
