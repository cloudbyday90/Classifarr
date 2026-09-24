/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { BASELINE_COMMIT } from '../scripts/pinnedReleaseSchema.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const tokenPattern = /^[a-f0-9]{32}$/;
const statuses = new Set(['destination', 'abstained', 'safety_blocked', 'failed']);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const byToken = (a, b) => a.token < b.token ? -1 : a.token > b.token ? 1 : 0;

function validateCase(row) {
  if (!exactKeys(row, ['token', 'mediaType', 'labelLibraryId', 'statusId', 'destinationLibraryId']) ||
      !tokenPattern.test(row.token) || !['movie', 'tv'].includes(row.mediaType) ||
      !Number.isInteger(row.labelLibraryId) || row.labelLibraryId <= 0 || !statuses.has(row.statusId) ||
      (row.statusId === 'destination' ? !Number.isInteger(row.destinationLibraryId) || row.destinationLibraryId <= 0
        : row.destinationLibraryId !== null)) throw new Error('release_pair_case_invalid');
}

function validateBundle(bundle, role, commit) {
  if (!exactKeys(bundle, ['version', 'role', 'commit', 'frozenInputFingerprint', 'cohortFingerprint', 'cases']) ||
      bundle.version !== 1 || bundle.role !== role || bundle.commit !== commit ||
      !digestPattern.test(bundle.frozenInputFingerprint) || !digestPattern.test(bundle.cohortFingerprint) ||
      !Array.isArray(bundle.cases) || bundle.cases.length < 1 || bundle.cases.length > 300) {
    throw new Error('release_pair_bundle_invalid');
  }
  for (const row of bundle.cases) validateCase(row);
  const tokens = new Set(bundle.cases.map(row => row.token));
  if (tokens.size !== bundle.cases.length) throw new Error('release_pair_duplicate_case');
  const cohort = bundle.cases.map(({ token, mediaType, labelLibraryId }) => ({ token, mediaType, labelLibraryId })).sort(byToken);
  if (hash(cohort) !== bundle.cohortFingerprint) throw new Error('release_pair_cohort_fingerprint_invalid');
  return bundle.cases.slice().sort(byToken);
}

const empty = () => ({ sampled: 0, pairedDestinations: 0, baselineMatches: 0, candidateMatches: 0,
  gains: 0, regressions: 0, changedDestinations: 0, baselineAbstentions: 0, candidateAbstentions: 0,
  baselineSafetyBlocks: 0, candidateSafetyBlocks: 0, baselineFailures: 0, candidateFailures: 0 });

function record(target, baseline, candidate) {
  const baselineDestination = baseline.statusId === 'destination' ? baseline.destinationLibraryId : null;
  const candidateDestination = candidate.statusId === 'destination' ? candidate.destinationLibraryId : null;
  target.sampled++;
  target.baselineAbstentions += Number(baseline.statusId === 'abstained');
  target.candidateAbstentions += Number(candidate.statusId === 'abstained');
  target.baselineSafetyBlocks += Number(baseline.statusId === 'safety_blocked');
  target.candidateSafetyBlocks += Number(candidate.statusId === 'safety_blocked');
  target.baselineFailures += Number(baseline.statusId === 'failed');
  target.candidateFailures += Number(candidate.statusId === 'failed');
  target.baselineMatches += Number(baselineDestination === baseline.labelLibraryId);
  target.candidateMatches += Number(candidateDestination === candidate.labelLibraryId);
  if (baselineDestination !== null && candidateDestination !== null) {
    target.pairedDestinations++;
    target.gains += Number(baselineDestination !== baseline.labelLibraryId && candidateDestination === candidate.labelLibraryId);
    target.regressions += Number(baselineDestination === baseline.labelLibraryId && candidateDestination !== candidate.labelLibraryId);
    target.changedDestinations += Number(baselineDestination !== candidateDestination);
  }
}

/** Structure-only comparison: a file cannot attest that either release actually ran. */
export function compareOperatorCorrectionReleasePair({ baseline, candidate, candidateCommit }) {
  if (typeof candidateCommit !== 'string' || !commitPattern.test(candidateCommit) || candidateCommit === BASELINE_COMMIT) {
    throw new Error('release_pair_candidate_commit_invalid');
  }
  const left = validateBundle(baseline, 'baseline', BASELINE_COMMIT);
  const right = validateBundle(candidate, 'candidate', candidateCommit);
  if (baseline.frozenInputFingerprint !== candidate.frozenInputFingerprint ||
      baseline.cohortFingerprint !== candidate.cohortFingerprint || left.length !== right.length ||
      left.some((row, index) => row.token !== right[index].token || row.mediaType !== right[index].mediaType ||
        row.labelLibraryId !== right[index].labelLibraryId)) throw new Error('release_pair_input_mismatch');
  const media = { movie: empty(), tv: empty() };
  for (let index = 0; index < left.length; index++) record(media[left[index].mediaType], left[index], right[index]);
  return { protocol: 'operator_correction_release_pair_structure_v1', status: 'structurally_comparable',
    baselineCommit: BASELINE_COMMIT, candidateCommit, frozenInputFingerprint: baseline.frozenInputFingerprint,
    cohortFingerprint: baseline.cohortFingerprint, sampled: left.length, media,
    releaseCodeExecutionVerified: false, policyAndTrainingProvenanceVerified: false,
    independentBlindLabels: 0, fullPipelineAccuracy: null, promotionAllowed: false };
}

export const fingerprintOperatorCorrectionPairCohort = cases => hash(cases
  .map(({ token, mediaType, labelLibraryId }) => ({ token, mediaType, labelLibraryId })).sort(byToken));
