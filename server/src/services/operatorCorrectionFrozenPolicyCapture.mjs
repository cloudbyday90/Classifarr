/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { projectFreshPolicyConfiguration } from './freshInventoryPolicyRuntime.mjs';
import { validateFrozenPolicyInput } from './operatorCorrectionFrozenPolicyInput.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Capture only fold-local library profiles and admitted query traits from a read snapshot. */
export function captureOperatorCorrectionFrozenPolicyInput({ source, prepared, correctionCohort, evidence }) {
  if (!/^[a-f0-9]{64}$/.test(source?.fingerprint) || !/^[a-f0-9]{64}$/.test(prepared?.sampleFingerprint) ||
      !Array.isArray(prepared.cases) || !Array.isArray(correctionCohort?.source?.policies) ||
      !(correctionCohort.corrections instanceof Map) || typeof evidence?.forCase !== 'function') {
    throw new Error('frozen_policy_capture_invalid');
  }
  const folds = new Map();
  const cases = prepared.cases.map(sample => {
    const key = `${sample.mediaType}:${sample.itemIdentity?.tmdbId}`;
    const label = correctionCohort.corrections.get(key);
    const runtime = evidence.forCase(sample);
    if (!label || !runtime) throw new Error('frozen_policy_capture_case_unavailable');
    const foldKey = `${sample.foldIndex}:${sample.mediaType}`;
    const held = sample.heldDescriptionHashes;
    if (!(held instanceof Set) || !held.has(sample.descriptionHash)) {
      throw new Error('frozen_policy_capture_holdout_invalid');
    }
    const heldDescriptionFingerprint = hash([...held].sort());
    if (!folds.has(foldKey)) {
      folds.set(foldKey, { foldIndex: sample.foldIndex, mediaType: sample.mediaType,
        heldDescriptionFingerprint, profiles: [...runtime.profiles].sort(([left], [right]) => left - right)
          .map(([libraryId, value]) => ({ libraryId, profile: value.profile })) });
    } else if (folds.get(foldKey).heldDescriptionFingerprint !== heldDescriptionFingerprint) {
      throw new Error('frozen_policy_capture_fold_mismatch');
    }
    const { tmdb_id: _sourceId, ...metadata } = runtime.metadata;
    return { mediaType: sample.mediaType, labelLibraryId: label.libraryId,
      foldIndex: sample.foldIndex, metadata };
  });
  return validateFrozenPolicyInput({ version: 2, sourceFingerprint: source.fingerprint,
    sampleFingerprint: prepared.sampleFingerprint, provenance: 'temporally_screened_operator_corrections',
    eligibleCorrections: correctionCohort.corrections.size,
    policies: correctionCohort.source.policies.map(projectFreshPolicyConfiguration),
    folds: [...folds.values()].sort((a, b) => a.foldIndex - b.foldIndex || a.mediaType.localeCompare(b.mediaType)), cases });
}
