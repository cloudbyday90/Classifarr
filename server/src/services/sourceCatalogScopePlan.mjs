/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const REQUIREMENTS = Object.freeze(['fresh_source_and_membership', 'typed_catalog_scope_evidence',
  'authenticated_operator_review', 'scope_aware_consumers']);
const positiveId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const season = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
const keysAre = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedList = value => Array.isArray(value) && value.length > 0 && value.length <= 256;

function copySource(source) {
  if (!keysAre(source, ['mediaServerId', 'externalId', 'mediaType', 'identityDigest']) ||
      !positiveId(source.mediaServerId) || !['movie', 'tv'].includes(source.mediaType) ||
      typeof source.externalId !== 'string' || !source.externalId.trim() || source.externalId.length > 500 ||
      /[\p{Cc}\p{Cf}]/u.test(source.externalId) || typeof source.identityDigest !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(source.identityDigest)) return null;
  // No library name, policy, URL or credentials can define mapping identity.
  return { mediaServerId: source.mediaServerId, externalId: source.externalId,
    mediaType: source.mediaType, identityDigest: source.identityDigest };
}

function copySeasonScope(scope) {
  if (!keysAre(scope, ['kind', 'coverage', 'sourceSeasonNumbers', 'mappings']) ||
      !['partial', 'complete'].includes(scope.coverage) || !boundedList(scope.sourceSeasonNumbers) ||
      !boundedList(scope.mappings)) return null;
  const sourceSeasons = new Set();
  for (const number of scope.sourceSeasonNumbers) {
    if (!season(number) || sourceSeasons.has(number)) return null;
    sourceSeasons.add(number);
  }
  const usedSource = new Set();
  const usedTarget = new Set();
  const targetWorks = new Set();
  const mappings = [];
  for (const edge of scope.mappings) {
    if (!keysAre(edge, ['sourceSeason', 'tmdbSeriesId', 'tmdbSeason']) ||
        !season(edge.sourceSeason) || !season(edge.tmdbSeason) || !positiveId(edge.tmdbSeriesId) ||
        !sourceSeasons.has(edge.sourceSeason) || usedSource.has(edge.sourceSeason)) return null;
    const target = `${edge.tmdbSeriesId}:${edge.tmdbSeason}`;
    if (usedTarget.has(target)) return null;
    usedSource.add(edge.sourceSeason);
    usedTarget.add(target);
    targetWorks.add(edge.tmdbSeriesId);
    if (targetWorks.size > 64) return null;
    mappings.push({ sourceSeason: edge.sourceSeason, tmdbSeriesId: edge.tmdbSeriesId, tmdbSeason: edge.tmdbSeason });
  }
  const complete = usedSource.size === sourceSeasons.size;
  if (complete !== (scope.coverage === 'complete')) return null;
  return { kind: 'seasons', coverage: scope.coverage,
    sourceSeasonNumbers: [...sourceSeasons].sort((a, b) => a - b),
    mappings: mappings.sort((a, b) => a.sourceSeason - b.sourceSeason) };
}

/** Canonical structural scope only; declarations are not verified inventory. */
export function copySourceCatalogScope(mediaType, input) {
  if (!['movie', 'tv'].includes(mediaType)) return null;
  if (input?.kind === 'whole_work' && keysAre(input, ['kind', 'tmdbId']) && positiveId(input.tmdbId)) {
    return { kind: 'whole_work', tmdbId: input.tmdbId };
  }
  return input?.kind === 'seasons' && mediaType === 'tv' ? copySeasonScope(input) : null;
}

function copyPlan(input) {
  if (!keysAre(input, ['version', 'intent', 'source', 'scope']) ||
      input.version !== 'source_catalog_scope_plan.v1' || input.intent !== 'preserve_source_grouping') return null;
  const source = copySource(input.source);
  if (!source) return null;
  const scope = copySourceCatalogScope(source.mediaType, input.scope);
  return scope ? { version: input.version, intent: input.intent, source, scope } : null;
}

/** Pure structural review of untrusted proposals. Never produces an applicable mapping. */
export function reviewSourceCatalogScopePlan(input) {
  const plan = copyPlan(input);
  const report = { version: 'source_catalog_scope_plan_review.v1',
    status: /** @type {{ id: string, reason?: string }} */ ({ id: 'invalid_draft', reason: 'invalid_scope_plan' }), canApply: false, verification: 'structure_only',
    planFingerprint: null, summary: null, requirements: REQUIREMENTS };
  if (!plan) return report;
  const whole = plan.scope.kind === 'whole_work';
  report.status = { id: 'valid_draft' };
  report.planFingerprint = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  report.summary = { mediaType: plan.source.mediaType, scope: plan.scope.kind,
    coverage: whole ? 'whole_work' : plan.scope.coverage,
    declaredSourceSeasons: whole ? null : plan.scope.sourceSeasonNumbers.length,
    mappedSourceSeasons: whole ? null : plan.scope.mappings.length,
    unmappedSourceSeasons: whole ? null : plan.scope.sourceSeasonNumbers.length - plan.scope.mappings.length,
    targetWorks: whole ? 1 : new Set(plan.scope.mappings.map(edge => edge.tmdbSeriesId)).size };
  return report;
}
