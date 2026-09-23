/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { compareInventoryDescriptionEvidence } from './inventoryDescriptionEvidenceComparison.mjs';
import { createHash } from 'node:crypto';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';

export const INVENTORY_RANKING_SHADOW_VERSION = 'inventory_description_company_shadow_v1';
const captures = new WeakMap();
const identities = new WeakMap();
const reasons = new WeakMap();
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const fit = value => Number.isFinite(value) && Math.abs(value) <= 20;
const identity = item => ['movie', 'tv'].includes(item?.media_type) && id(item?.tmdb_id)
  ? `${item.media_type}:${item.tmdb_id}` : null;

/** Predeclared ranking experiment, not the policy score, AI confidence, or a routing grant. */
export function chooseInventoryShadowCandidate(candidates, includeCompany = false) {
  const ranked = candidates.map(row => ({ id: row.libraryId,
    score: row.descriptionMean + .25 * Math.tanh(row.metadataFit) +
      (includeCompany ? .25 * Math.tanh(row.companyFit ?? 0) : 0) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
  return ranked[0].score > 0 && ranked[0].score - ranked[1].score > 0.000001 ? ranked[0].id : null;
}

/** Validate persisted numeric records without trusting extra metadata or recomputing from today's library. */
export function validInventoryRankingShadow(value) {
  if (value?.version !== INVENTORY_RANKING_SHADOW_VERSION ||
      !['movie', 'tv'].includes(value.mediaType) || !Number.isFinite(Date.parse(value.capturedAt)) ||
      !/^[a-f0-9]{64}$/.test(value.snapshotId ?? '') ||
      !/^[a-f0-9]{64}$/.test(value.queryHash ?? '') ||
      !Array.isArray(value.candidates) || value.candidates.length < 2 || value.candidates.length > 64 ||
      new Set(value.candidates.map(row => row?.libraryId)).size !== value.candidates.length ||
      value.candidates.some(row => !id(row?.libraryId) || !Number.isFinite(row.descriptionMean) ||
        Math.abs(row.descriptionMean) > 1 || !fit(row.metadataFit) ||
        (row.companyFit !== null && !fit(row.companyFit)))) return false;
  const companyComplete = value.candidates.every(row => row.companyFit !== null);
  if (!companyComplete && value.candidates.some(row => row.companyFit !== null)) return false;
  return value.companyAvailable === companyComplete &&
    value.baselineLibraryId === chooseInventoryShadowCandidate(value.candidates) &&
    value.combinedLibraryId === chooseInventoryShadowCandidate(value.candidates, true);
}

/** In-process receipt: only this live retrieval boundary can mint a persistable capture. */
export function rememberInventoryRankingShadow(evaluations, item, evidence) {
  captures.delete(evaluations);
  reasons.set(evaluations, 'retrieval_unavailable');
  try {
    const key = identity(item);
    if (!key) { reasons.set(evaluations, 'identity_mismatch'); return; }
    if (evidence?.statusId !== 'available') return;
    const projection = projectInventoryDescription({ metadata: item });
    if (!projection) { reasons.set(evaluations, 'description_unavailable'); return; }
    const compared = compareInventoryDescriptionEvidence(evidence.candidates);
    if (!compared || new Set(evaluations.map(row => row.library_id)).size !== compared.length ||
        compared.some(row => !evaluations.some(candidate => candidate.library_id === row.candidate.libraryId))) {
      reasons.set(evaluations, 'comparison_incomplete');
      return;
    }
    const first = compared[0].candidate.learnedProfile;
    if (compared.some(row => row.candidate.learnedProfile.snapshotId !== first.snapshotId ||
        row.profile.trainingDescriptions !== first.trainingDescriptions)) {
      reasons.set(evaluations, 'comparison_incomplete');
      return;
    }
    const companyAvailable = compared.every(({ candidate }) => {
      const company = candidate.learnedProfile.companyProfile;
      return company?.version === 'production_company_set_v1' && fit(company.relativeFit) &&
        Number.isInteger(company.trainingDescriptions) && company.trainingDescriptions > 0 &&
        company.trainingDescriptions <= 10000 &&
        company.trainingDescriptions === first.companyProfile?.trainingDescriptions;
    });
    const candidates = compared.map(({ candidate, mean, profile }) => Object.freeze({
      libraryId: candidate.libraryId, descriptionMean: Number(mean.toFixed(6)), metadataFit: profile.relativeFit,
      companyFit: companyAvailable ? candidate.learnedProfile.companyProfile.relativeFit : null,
    })).sort((a, b) => a.libraryId - b.libraryId);
    const capture = Object.freeze({ version: INVENTORY_RANKING_SHADOW_VERSION, mediaType: item.media_type,
      capturedAt: new Date().toISOString(), snapshotId: first.snapshotId, companyAvailable,
      queryHash: createHash('sha256').update(projection.text).digest('hex'),
      candidates: Object.freeze(candidates), baselineLibraryId: chooseInventoryShadowCandidate(candidates),
      combinedLibraryId: chooseInventoryShadowCandidate(candidates, true) });
    if (!validInventoryRankingShadow(capture)) { reasons.set(evaluations, 'capture_invalid'); return; }
    identities.set(capture, key);
    captures.set(evaluations, capture);
    reasons.delete(evaluations);
  } catch {
    reasons.set(evaluations, 'unexpected_error');
    /* Diagnostic failure must never change classification or expose provider content. */
  }
}

export function setInventoryRankingShadowReason(evaluations, reasonId) {
  if (Array.isArray(evaluations)) reasons.set(evaluations, reasonId);
}

export function getInventoryRankingShadowReason(evaluations) {
  return reasons.get(evaluations) ?? null;
}

export function getInventoryRankingShadow(evaluations) {
  return captures.get(evaluations) ?? null;
}

export function projectInventoryRankingShadow(result, metadata) {
  const capture = result?.policyResult?.inventoryRankingShadow ?? result?.signalContext?.policyResult?.inventoryRankingShadow;
  return capture && identities.get(capture) === identity(metadata) ? capture : null;
}
