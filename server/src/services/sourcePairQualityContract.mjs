/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest } from './cachedAdjudicationContract.mjs';

export const qualityHash = adjudicationDigest;
export const qualityTarget = (mediaType, id) => qualityHash([mediaType, String(id)]);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const exactQualityKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const media = value => ['movie', 'tv'].includes(value);
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const protocolKeys = ['version', 'createdAt', 'cohort', 'evidenceRevision', 'modelRevision', 'cases', 'destinations', 'providerCalls', 'id'];
export const qualityProtocolId = value => qualityHash([value.version, value.createdAt, value.cohort, value.evidenceRevision, value.modelRevision,
  value.cases.map(row => [row.item, row.mediaType]), value.destinations.map(row => [row.target, row.mediaType]), value.providerCalls]);

export function validQualityProtocol(value) {
  return exactQualityKeys(value, protocolKeys) && value.version === 'source_pair_quality_protocol.v1' && iso(value.createdAt) &&
    Array.isArray(value.cohort) && value.cohort.length <= 300 && value.cohort.every(hex) && new Set(value.cohort).size === value.cohort.length && hex(value.evidenceRevision) && hex(value.modelRevision) && value.providerCalls === 0 &&
    Array.isArray(value.cases) && value.cases.length === value.cohort.length &&
    value.cases.every(row => exactQualityKeys(row, ['item', 'mediaType']) && hex(row.item) && media(row.mediaType)) &&
    new Set(value.cases.map(row => row.item)).size === value.cases.length &&
    Array.isArray(value.destinations) && value.destinations.length <= 1000 &&
    value.destinations.every(row => exactQualityKeys(row, ['target', 'mediaType']) && hex(row.target) && media(row.mediaType)) &&
    new Set(value.destinations.map(row => row.target)).size === value.destinations.length && value.id === qualityProtocolId(value);
}

/** Review independence is declared provenance, never inferred from matching model predictions. */
export function readQualityReferences(document, protocol) {
  if (!validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid');
  const labels = new Map(), conflicts = new Set();
  if (document === null) return { labels, conflicts, provenance: 'none' };
  if (!exactQualityKeys(document, ['version', 'protocolId', 'provenance', 'labels']) || document.version !== 'source_pair_quality_reference.v1' ||
      document.protocolId !== protocol.id || !['independent_human.v1', 'synthetic_fixture.v1'].includes(document.provenance) ||
      !Array.isArray(document.labels) || document.labels.length > 600) throw new Error('quality_reference_invalid');
  const items = new Map(protocol.cases.map(row => [row.item, row.mediaType]));
  const targets = new Map(protocol.destinations.map(row => [row.target, row.mediaType]));
  for (const row of document.labels) {
    if (!exactQualityKeys(row, ['item', 'mediaType', 'target', 'consensus', 'reviewerCount']) || !media(row.mediaType) ||
        items.get(row.item) !== row.mediaType || targets.get(row.target) !== row.mediaType ||
        !['unanimous', 'adjudicated'].includes(row.consensus) || !Number.isInteger(row.reviewerCount) ||
        row.reviewerCount < (row.consensus === 'adjudicated' ? 3 : 2) || row.reviewerCount > 8) throw new Error('quality_reference_invalid');
    if (labels.has(row.item) && labels.get(row.item) !== row.target) conflicts.add(row.item);
    labels.set(row.item, row.target);
  }
  for (const item of conflicts) labels.delete(item);
  return { labels, conflicts, provenance: document.provenance };
}
