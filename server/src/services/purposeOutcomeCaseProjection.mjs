/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { validPurposeOutcomeReference, purposeOutcomeTime } from './purposeOutcomeReference.mjs';
import { projectPurposeCaseReferences } from './purposeOutcomeCaseReferences.mjs';

const referenceKinds = Object.freeze({ manual: 'manual_prior_destination', runtime: 'runtime_answer_contract', history_review: 'original_automated_destination' });
const compare = (left, right) => left === null || right === null ? 'unavailable' : left === right ? 'agrees' : 'differs';
const iso = value => new Date(purposeOutcomeTime(value)).toISOString();

/** Closed private output. Never spread prepared events, sources or reference snapshots into JSON. */
export function projectPurposeOutcomeCase(event) {
  const classificationId = canonicalDatabaseBigintId(event.classificationId), sourceId = canonicalDatabaseBigintId(event.sourceOrder);
  const tmdbId = Number(event.identityKey?.split(':')[1]), mediaType = event.mediaType;
  if (event.disposition !== 'eligible' || event.gap || !classificationId || classificationId !== event.classificationId ||
      !sourceId || sourceId !== event.sourceOrder || inventoryRankingItemIdentity({ media_type: mediaType, tmdb_id: tmdbId }) !== event.identityKey ||
      !validPurposeOutcomeReference(event.payload) || !['confirmation', 'correction'].includes(event.action) ||
      !Object.hasOwn(referenceKinds, event.sourceKind) || referenceKinds[event.sourceKind] !== event.actionReference ||
      typeof event.order !== 'bigint' || event.order / 1000n !== BigInt(event.at)) throw new Error('purpose_cases_invalid_event');
  const { original, commandReference } = projectPurposeCaseReferences(event);
  const policy = event.payload, proof = policy.purposeEvidence;
  const comparisons = { policyVersusChoice: compare(policy.libraryId, event.destination),
    originalVersusChoice: compare(original.libraryId, event.destination), policyVersusOriginal: compare(policy.libraryId, original.libraryId) };
  const milliseconds = new Date(event.at).toISOString();
  const observedAt = milliseconds.slice(0, -1) + String(event.order % 1000n).padStart(3, '0') + 'Z';
  return { classificationId, identity: { mediaType, tmdbId }, observedAt,
    source: { kind: event.sourceKind, referenceKind: event.sourceKind === 'history_review' ? 'feedback_receipt' : 'authorized_receipt', id: sourceId },
    action: { kind: event.action, reference: commandReference },
    policy: { policyId: policy.policyId, libraryId: policy.libraryId, score: policy.score,
      capturedAt: iso(policy.capturedAt), expiresAt: iso(policy.expiresAt),
      purposeEvidence: { version: proof.version, origin: proof.origin, declaredMatch: proof.declaredMatch,
        runtimeEligible: proof.runtimeEligible, specificity: proof.specificity } },
    assessment: { libraryId: event.destination }, original, comparisons,
    flags: Object.keys(comparisons).filter(key => comparisons[key] === 'differs') };
}
