/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest, validAdjudicationPlan, ADJUDICATION_PAIR_LIMIT } from './cachedAdjudicationContract.mjs';
import { evaluationArmGap, EVALUATION_GAP_REASONS } from './evaluationCoverageGaps.mjs';

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Ephemeral metadata only; observed membership is a stratum, never a target label. */
export function captureAdmissionCase(key, mediaType, libraryIds, results, requestKeys) {
  return { item: adjudicationDigest(key), mediaType,
    stratum: adjudicationDigest([mediaType, [...new Set(libraryIds)].sort((a, b) => a - b)]),
    arms: results.map((result, index) => ({ key: requestKeys[index], gap: evaluationArmGap(result) })) };
}

export function validCaptureAdmission(value, plan) {
  if (!validAdjudicationPlan(plan) || !Array.isArray(value) || value.length > ADJUDICATION_PAIR_LIMIT ||
      new Set(value.map(row => row?.item)).size !== value.length) return false;
  const keys = new Set(plan.map(row => row.key)), referenced = new Set();
  return value.every(row => exact(row, ['item', 'mediaType', 'stratum', 'arms']) && hex(row.item) && hex(row.stratum) &&
    ['movie', 'tv'].includes(row.mediaType) && Array.isArray(row.arms) && row.arms.length === 2 && row.arms.every(arm => {
      if (!exact(arm, ['key', 'gap']) || !(arm.key === null || keys.has(arm.key)) ||
          !(arm.gap === 'none' || EVALUATION_GAP_REASONS.includes(arm.gap)) ||
          (arm.gap === 'cache_missing' && arm.key === null)) return false;
      if (arm.key !== null) referenced.add(arm.key);
      return true;
    })) && referenced.size === keys.size;
}

/** A separate ordering: never reorder the canonical plan used by durable checkpoints. */
export function planCaptureAdmission(admission, plan) {
  if (!validCaptureAdmission(admission, plan)) throw new Error('adjudication_capture_admission_invalid');
  const media = new Map(), strata = new Map(), selected = new Set(), pending = [];
  const served = row => {
    media.set(row.mediaType, (media.get(row.mediaType) ?? 0) + 1);
    strata.set(row.stratum, (strata.get(row.stratum) ?? 0) + 1);
  };
  for (const row of admission) {
    if (row.arms.every(arm => arm.gap === 'none')) served(row);
    else if (row.arms.every(arm => ['none', 'cache_missing'].includes(arm.gap))) {
      pending.push({ ...row, missing: [...new Set(row.arms.filter(arm => arm.gap === 'cache_missing').map(arm => arm.key))] });
    }
  }
  const remaining = row => row.missing.filter(key => !selected.has(key));
  while (pending.length) {
    pending.sort((a, b) => remaining(a).length - remaining(b).length ||
      (media.get(a.mediaType) ?? 0) - (media.get(b.mediaType) ?? 0) ||
      (strata.get(a.stratum) ?? 0) - (strata.get(b.stratum) ?? 0) || a.item.localeCompare(b.item));
    const row = pending.shift();
    for (const key of remaining(row)) selected.add(key);
    served(row);
  }
  return [...selected];
}
