/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPolicyCandidateAdjudicationPresentation } from './policyCandidateAdjudicationPresentation.mjs';

const array = value => Array.isArray(value) ? value : [];
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const id = value => (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) &&
  Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647 ? Number(value) : null;
const score = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
const libraryId = value => id(value?.library_id ?? value?.libraryId ?? value?.id);
const policyId = value => id(value?.policy_id ?? value?.policyId);
function name(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return text && text.length <= 160 ? text : null;
}

export function readReviewMetadata(value) {
  if (typeof value !== 'string') return record(value);
  try { return record(JSON.parse(value)); } catch { return {}; }
}

/** Pure presentation reference. It never authorizes a route or interprets AI prose. */
export function buildPolicyRuntimeReviewReference({ classification = {}, question = {}, candidateDestinations = [] } = {}) {
  const destinations = new Map();
  let invalid = array(candidateDestinations).length > 64;
  for (const source of array(candidateDestinations).slice(0, 64)) {
    const library = libraryId(source), label = name(source?.library_name ?? source?.libraryName ?? source?.name);
    if (!library || !label || destinations.has(library)) { invalid = true; continue; }
    destinations.set(library, { library_id: library, library_name: label });
  }
  const metadata = readReviewMetadata(classification.metadata);
  const policy = record(metadata.policyResult);
  if (Object.hasOwn(policy, 'ranked') && !Array.isArray(policy.ranked)) invalid = true;
  const ranked = array(policy.ranked);
  const sources = ranked.length ? ranked : array(question?.meta?.candidates);
  if (sources.length > 64) invalid = true;
  const rows = new Map();
  for (const candidate of sources.slice(0, 64)) {
    const library = libraryId(candidate);
    if (!destinations.has(library)) continue;
    if (rows.has(library) || score(candidate?.score) === null) { invalid = true; continue; }
    rows.set(library, { destination: destinations.get(library), candidate });
  }
  const values = [...rows.values()];
  // Conservative stale protection can survive an incoherent display reference.
  // It cannot identify a destination, grant an action or supply display numbers.
  const hasUnboundAutomaticScore = values.some(row => score(row.candidate.auto_classify_threshold) !== null &&
    row.candidate.score >= row.candidate.auto_classify_threshold);
  const highest = Math.max(...values.map(row => Math.round(row.candidate.score)));
  const leaders = values.filter(row => Math.round(row.candidate.score) === highest);
  let policyReference = !invalid && leaders.length === 1 ? leaders[0] : null;
  const top = record(policy.topCandidate);
  const coherentTop = candidate => candidate && score(top.score) !== null && top.score === candidate.candidate.score &&
    (!Object.hasOwn(top, 'policy_id') && !Object.hasOwn(top, 'policyId') ||
      policyId(top) !== null && policyId(top) === policyId(candidate.candidate));
  if (Object.keys(top).length && (!coherentTop(rows.get(libraryId(top))) ||
      !leaders.includes(rows.get(libraryId(top))))) {
    invalid = true;
    policyReference = null;
  }
  if (!invalid && leaders.length > 1 && libraryId(top)) {
    const retained = rows.get(libraryId(top));
    if (leaders.includes(retained) && coherentTop(retained) && policyId(top) !== null &&
        policyId(top) === policyId(retained.candidate)) policyReference = retained;
  }
  const rawAdjudication = record(record(metadata.classification_details).candidate_adjudication);
  let adjudication;
  try { adjudication = buildPolicyCandidateAdjudicationPresentation(rawAdjudication); } catch { adjudication = null; }
  const proposed = rawAdjudication.version === 'policy.candidate_adjudication.v1' &&
    (rawAdjudication.status_id ?? rawAdjudication.statusId) === 'proposed';
  const proposedId = libraryId(rawAdjudication.proposed_destination ?? rawAdjudication.proposedDestination);
  const advisoryDestination = proposed && adjudication && proposedId !== null && proposedId === libraryId(adjudication.proposed_destination)
    ? destinations.get(proposedId) ?? null : null;
  const invalidProposal = proposed && !advisoryDestination;
  if (proposed) adjudication = advisoryDestination ? { ...adjudication, proposed_destination: advisoryDestination } : null;
  // Non-proposal records cannot smuggle an unrelated optional destination into the UI.
  else if (adjudication) adjudication = { ...adjudication, proposed_destination: null };
  const disagreement = Boolean(policyReference && advisoryDestination &&
    policyReference.destination.library_id !== advisoryDestination.library_id);
  const reason = invalidProposal ? 'invalid_advisory_proposal' : disagreement ? 'advisory_disagreement' :
    !policyReference ? (leaders.length > 1 && !invalid ? 'policy_tie' : 'policy_reference_unavailable') :
      leaders.length > 1 ? 'policy_tie' : policyReference.candidate.score <= 0 ? 'no_positive_evidence' : null;
  return { policyReference, primaryDestination: reason ? null : policyReference?.destination ?? null,
    advisoryDestination, adjudication, reason, hasUnboundAutomaticScore, rankedDestinations: invalid ? [] : values
      .sort((left, right) => right.candidate.score - left.candidate.score || left.destination.library_id - right.destination.library_id)
      .map(row => row.destination) };
}
