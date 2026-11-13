/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readCurrentPolicyReviewFrame } from './currentPolicyReviewFrameContract.mjs';

/** Review-only resolution. A present invalid frame is never legacy first-pass evidence. */
export function resolveCurrentPolicyReviewSource(classification, metadata, candidateDestinations) {
  const details = metadata?.classification_details;
  if (!details || !Object.hasOwn(details, 'current_policy_review')) {
    return { current: false, valid: true, policy: metadata?.policyResult ?? {}, detail: () => null };
  }
  const frame = readCurrentPolicyReviewFrame(details.current_policy_review, classification);
  const leader = frame?.policy?.ranked?.[0];
  const valid = frame?.status === 'recorded' && Array.isArray(candidateDestinations) &&
    candidateDestinations.some(destination => destination.library_id === leader?.library_id);
  if (!valid) return { current: true, valid: false, policy: { ranked: [] }, detail: () => null };
  return { current: true, valid: true, policy: { ...frame.policy, topCandidate: leader },
    detail: candidate => frame.policy.ranked.find(row => row.policy_id === candidate?.policy_id && row.library_id === candidate?.library_id)?.detail ?? null };
}

export function currentReviewEvidenceFacts(detail, destinationName) {
  if (!detail) return [];
  const purpose = detail.card.purpose_evidence;
  const label = purpose.origin === 'profile_derived' ? `Purpose inferred from library observations provides context for ${destinationName}.` :
    purpose.origin === 'mixed' ? `Mixed purpose origins were retained for ${destinationName}; a declared-subset match ${purpose.declaredMatch === 'matched' ? 'was established' : 'is not established'}.` :
      purpose.origin === 'declared_native' ? purpose.declaredMatch === 'matched' && purpose.runtimeEligible === true && purpose.specificity === 'positive_specialized_evidence'
        ? `A matched declared purpose distinguishes ${destinationName} from the other destinations.`
        : `Declared purpose was retained for ${destinationName}, but specialized matching support is not established.` :
        `Purpose origin and declared-rule matching evidence are unavailable for ${destinationName}.`;
  const labels = {
    similar_items: `Similar items already associated with ${destinationName} support this match.`,
    observed_profile: `Observed contents of ${destinationName} support this match.`,
    observed_profile_difference: `Observed library history differs; it does not change the retained policy decision for ${destinationName}.`,
    learned_pattern: `A confirmed classification pattern supports ${destinationName}.`,
    prior_outcomes: `Prior confirmed outcomes support ${destinationName}.`,
  };
  return [{ id: `purpose_${purpose.origin}`, label }, ...detail.facts.map(id => ({ id, label: labels[id] }))].slice(0, 4);
}
