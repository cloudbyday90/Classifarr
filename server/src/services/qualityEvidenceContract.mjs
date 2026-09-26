/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { exactQualityKeys as exact, validQualityProtocol } from './sourcePairQualityContract.mjs';
import { EVALUATION_GAP_REASONS } from './evaluationCoverageGaps.mjs';

export const qualityEvidenceHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const qualityEvidenceTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
export const emptyQualityEvidence = protocol => ({ version: 'quality_evidence.v1', protocolId: protocol.id,
  observedAt: protocol.createdAt, cases: protocol.cases.map(row => ({ ...row, correctionTarget: null,
    arms: [0, 1].map(() => ({ status: 'unavailable', gap: 'unknown', target: null, requestKey: null, responseHash: null })) })), requests: [] });

/** Fixed private persistence boundary: hashes/outcomes/usage only, never source or generated content. */
export function validQualityEvidence(value, protocol) {
  if (!validQualityProtocol(protocol) || !exact(value, ['version', 'protocolId', 'observedAt', 'cases', 'requests']) ||
      value.version !== 'quality_evidence.v1' || value.protocolId !== protocol.id || !qualityEvidenceTime(value.observedAt) ||
      Date.parse(value.observedAt) < Date.parse(protocol.createdAt) || Date.parse(value.observedAt) >= Date.parse(protocol.createdAt) + 30 * 86400000 ||
      !Array.isArray(value.cases) || value.cases.length !== protocol.cases.length || !Array.isArray(value.requests) || value.requests.length > 600 ||
      Buffer.byteLength(JSON.stringify(value)) > 1048576) return false;
  const requests = new Map(), items = new Map(protocol.cases.map(row => [row.item, row.mediaType]));
  const targets = new Map(protocol.destinations.map(row => [row.target, row.mediaType]));
  for (const row of value.requests) {
    if (!exact(row, ['key', 'digest', 'promptTokens', 'outputTokens', 'latencyMs']) || !qualityEvidenceHash(row.key) ||
        !qualityEvidenceHash(row.digest) || requests.has(row.key) || !integer(row.promptTokens, 8192) ||
        !integer(row.outputTokens, 256) || !integer(row.latencyMs, 600000)) return false;
    requests.set(row.key, row);
  }
  const used = new Set();
  for (const row of value.cases) {
    if (!exact(row, ['item', 'mediaType', 'correctionTarget', 'arms']) || items.get(row.item) !== row.mediaType || !items.delete(row.item) ||
        row.correctionTarget !== null && targets.get(row.correctionTarget) !== row.mediaType || !Array.isArray(row.arms) || row.arms.length !== 2) return false;
    for (const arm of row.arms) {
      if (!exact(arm, ['status', 'target', 'gap', 'requestKey', 'responseHash']) ||
          !['automatic', 'proposed', 'abstained', 'misses', 'unavailable'].includes(arm.status) ||
          arm.requestKey !== null && !qualityEvidenceHash(arm.requestKey) || arm.responseHash !== null && !qualityEvidenceHash(arm.responseHash)) return false;
      const complete = ['automatic', 'proposed', 'abstained'].includes(arm.status);
      if ((['automatic', 'proposed'].includes(arm.status) ? targets.get(arm.target) !== row.mediaType : arm.target !== null) ||
          (complete ? arm.gap !== 'none' : arm.status === 'misses' ? arm.gap !== 'cache_missing' : !EVALUATION_GAP_REASONS.includes(arm.gap)) ||
          arm.status === 'automatic' && (arm.requestKey !== null || arm.responseHash !== null) ||
          ['proposed', 'abstained'].includes(arm.status) && (!arm.requestKey || !arm.responseHash) ||
          arm.status === 'misses' && (!arm.requestKey || arm.responseHash !== null)) return false;
      if (arm.responseHash !== null) {
        if (requests.get(arm.requestKey)?.digest !== arm.responseHash) return false;
        used.add(arm.requestKey);
      }
    }
  }
  return used.size === requests.size;
}
