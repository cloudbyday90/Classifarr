/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { describeInventorySnapshotDigests } from './inventoryDescriptionSnapshotDigests.mjs';
import { evaluateSourceDescriptionPair } from './sourceDescriptionPairedEvaluation.mjs';
import { freezeAutomaticSourcePairCohort, AUTOMATIC_SOURCE_PAIR_OPTIONS } from './automaticSourcePairCohort.mjs';
import { projectAutomaticSourcePairReport, readAutomaticSourcePairReport } from './automaticSourcePairReport.mjs';

/** Private input stays within this fixed computation; only bounded aggregate output escapes. */
export function computeAutomaticSourcePair(snapshot, state, { evaluate = evaluateSourceDescriptionPair } = {}) {
  const started = performance.now();
  const { source, identity, configuration } = snapshot.inputs;
  const frozen = freezeAutomaticSourcePairCohort(source, state, snapshot.observedAt);
  const hash = createHash('sha256').update(JSON.stringify({ revision: 'automatic_source_pair.v2:policy_replay_v1',
    identity, configuration, cohort: frozen.cohort, cohortCreatedAt: frozen.cohortCreatedAt,
    policies: source.policies, policySourceRevisions: source.policySourceRevisionRows,
    snapshot: describeInventorySnapshotDigests(source, source.vectors) }));
  for (const row of source.rows) hash.update(JSON.stringify(row)).update('\n');
  for (const row of source.operatorFeedbackRows) hash.update(JSON.stringify(row)).update('\n');
  const fingerprint = hash.digest('hex');
  const unchanged = frozen.reason === 'reused' && state?.status === 'complete' && state.input_fingerprint === fingerprint &&
    readAutomaticSourcePairReport(state.report) !== null && (!source.policies || state.report.version === 'automatic_source_pair.v2');
  const report = unchanged ? state.report : projectAutomaticSourcePairReport(
    evaluate(source, identity, AUTOMATIC_SOURCE_PAIR_OPTIONS, { fixedSampleKeys: frozen.fixedSampleKeys }),
    frozen.reason, Math.ceil(performance.now() - started));
  return { fingerprint, report, unchanged, cohort: frozen.cohort, cohortCreatedAt: frozen.cohortCreatedAt };
}
