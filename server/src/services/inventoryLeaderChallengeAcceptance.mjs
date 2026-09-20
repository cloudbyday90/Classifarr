/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS as matchLimits } from './libraryMatchBaseline.mjs';
import { NEIGHBOR_CROSS_FIT_VERSION, NEIGHBOR_CROSS_FIT_LIMITS as neighborLimits } from './libraryNeighborCrossFit.mjs';
import { LIBRARY_MATCH_CROSS_FIT_VERSION } from './libraryMatchCrossFit.mjs';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const state = value => ['familiar', 'unusual', 'sparse', 'degenerate'].includes(value) ? value : 'unavailable';
const assessable = (value, crossFit) => ['familiar', 'unusual'].includes(value?.status) &&
  count(value.referenceDescriptions, matchLimits.minimum, matchLimits.references) &&
  count(value.calibrationDescriptions, matchLimits.minimum, matchLimits.calibration) &&
  (!crossFit || (value.minimumCalibrationReferences === value.referenceDescriptions &&
    value.calibrationDescriptions === Math.min(value.referenceDescriptions + 1, matchLimits.calibration))) &&
  Number.isFinite(value.empiricalRank) && value.empiricalRank > 0 && value.empiricalRank <= 1 &&
  (value.status === 'familiar') === (value.empiricalRank > matchLimits.tail);

export function leaderChallengeNomination(assessment) {
  return assessment.statusId === 'review_veto' ? assessment.blockedContent : assessment;
}

/** Empirical evidence, not a live receipt, confidence score or authority to bypass review. */
export function assessLeaderChallengeAcceptance(assessment, calibration, { crossFit = false } = {}) {
  if (typeof crossFit !== 'boolean') throw new Error('leader_acceptance_mode_invalid');
  const nomination = leaderChallengeNomination(assessment);
  const result = (reason, incumbent = null, challenger = null) => ({ reason, accepted: reason === 'accepted',
    incumbent: state(incumbent?.status), challenger: state(challenger?.status) });
  if (nomination?.statusId !== 'challenger') return result('not_nominated');
  const { match, neighbor } = calibration ?? {}, pool = assessment.candidateOrder;
  if (!Array.isArray(pool) || pool.length < 2 || pool.length > 64 || new Set(pool).size !== pool.length ||
      pool.some(id => !count(id, 1, 2147483647)) || !pool.includes(assessment.policyLeaderId) ||
      !pool.includes(nomination.challengerId) || assessment.policyLeaderId === nomination.challengerId ||
      match?.version !== (crossFit ? LIBRARY_MATCH_CROSS_FIT_VERSION : LIBRARY_MATCH_BASELINE_VERSION) ||
      neighbor?.version !== NEIGHBOR_CROSS_FIT_VERSION ||
      !hash(match.snapshotId) || !hash(neighbor.snapshotId) || neighbor.status !== 'evaluated' ||
      !Array.isArray(match.candidates) || !Array.isArray(neighbor.candidates) ||
      match.candidates.length < pool.length || match.candidates.length > 64 ||
      neighbor.candidates.length !== match.candidates.length) return result('calibration_unavailable');
  const ids = match.candidates.map(candidate => candidate?.libraryId);
  const neighborIds = neighbor.candidates.map(candidate => candidate?.libraryId);
  if (ids.some(id => !count(id, 1, 2147483647)) || new Set(ids).size !== ids.length ||
      new Set(neighborIds).size !== ids.length || neighborIds.some(id => !ids.includes(id)) ||
      pool.some(id => !ids.includes(id))) return result('calibration_scope_mismatch');
  const incumbent = match.candidates.find(candidate => candidate.libraryId === assessment.policyLeaderId);
  const challenger = match.candidates.find(candidate => candidate.libraryId === nomination.challengerId);
  if (!assessable(incumbent, crossFit)) return result('incumbent_unassessable', incumbent, challenger);
  if (!assessable(challenger, crossFit)) return result('challenger_unassessable', incumbent, challenger);
  if (challenger.status !== 'familiar') return result('challenger_unfamiliar', incumbent, challenger);
  if (neighbor.candidates.some(candidate => candidate.status !== 'available' || candidate.referenceComplete !== true ||
      !count(candidate.referenceDescriptions, neighborLimits.minimum, neighborLimits.references) ||
      !count(candidate.calibrationDescriptions, neighborLimits.minimum, neighborLimits.calibration) ||
      !count(candidate.minimumCalibrationReferences, neighborLimits.minimum, neighborLimits.references) ||
      typeof candidate.calibrated !== 'boolean')) return result('neighbor_unavailable', incumbent, challenger);
  const distinguished = neighbor.candidates.filter(candidate => candidate.calibrated);
  return result(distinguished.length === 1 && distinguished[0].libraryId === nomination.challengerId
    ? 'accepted' : 'not_distinguished', incumbent, challenger);
}

export function applyLeaderChallengeAcceptance(assessment, calibration, options) {
  const acceptance = assessLeaderChallengeAcceptance(assessment, calibration, options);
  if (acceptance.accepted || acceptance.reason === 'not_nominated') return { ...assessment, acceptance };
  if (assessment.statusId === 'review_veto') return { ...assessment, acceptance,
    blockedContent: { statusId: 'acceptance_withheld', challengerId: null } };
  return { ...assessment, acceptance, statusId: 'acceptance_withheld', challengerId: null,
    candidateOrder: [assessment.policyLeaderId, ...assessment.candidateOrder.filter(id => id !== assessment.policyLeaderId)] };
}
