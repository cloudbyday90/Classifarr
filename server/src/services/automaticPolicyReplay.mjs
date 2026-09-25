/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createFreshInventoryPolicyEvidence } from './freshInventoryPolicyEvidence.mjs';
import { evaluateFreshInventoryPolicyCase } from './freshInventoryPolicyPreparation.mjs';
import { withoutInferredProfileSources } from './heldOutSemanticStudyPreparation.mjs';
import { screenCorrectionsAfterPolicySources } from './operatorCorrectionPolicyProvenance.mjs';
import { createAutomaticPolicyMetrics, addAutomaticPolicyMetrics, projectAutomaticPolicyOutcome,
  createAutomaticPolicyReport } from './automaticPolicyReplayReport.mjs';

/** Both arms reuse the captured production preparation; labels are available only to the reducer. */
export async function evaluateAutomaticPolicyReplay(source, arms, retrievalReport,
  { evaluate = evaluateFreshInventoryPolicyCase } = {}) {
  if (retrievalReport.status !== 'complete') return createAutomaticPolicyReport(retrievalReport.status);
  if (!source.policies.length) return createAutomaticPolicyReport('no_policies');
  if (arms.length !== 2) throw new Error('automatic_policy_arms_invalid');
  const { corrections } = screenCorrectionsAfterPolicySources({ corrections: arms[0].corrections,
    feedbackRows: source.operatorFeedbackRows, policies: source.policies, policySourceRevisionRows: source.policySourceRevisionRows });
  const outcomes = [];
  for (const arm of arms) {
    const { operatorFeedbackRows: _labels, policySourceRevisionRows: _revisions, ...unlabeled } = arm.source;
    const policySource = { ...unlabeled, fingerprint: retrievalReport.snapshotFingerprint,
      policies: source.policies.map(withoutInferredProfileSources) };
    const evidence = createFreshInventoryPolicyEvidence(policySource, arm.prepared, { trainingExcludedKeys: arm.trainingExcludedKeys });
    const rows = new Map();
    for (const entry of arm.prepared.cases) {
      const runtime = evidence.forCase(entry), retrieval = { requested: false, unavailable: false };
      let failed = false;
      const retriever = { async retrieve(request) {
        retrieval.requested = true;
        try {
          const result = await runtime.retrieve(request);
          retrieval.unavailable = result?.statusId !== 'available';
          return result;
        } catch (error) { failed = true; throw error; }
      } };
      const { common } = await evaluate(entry, policySource, evidence, undefined, { retriever });
      if (failed) throw new Error('automatic_policy_retrieval_failed');
      const key = entry.itemIdentity.tmdbId === null ? entry.itemIdentity.sourceKey : `${entry.mediaType}:${entry.itemIdentity.tmdbId}`;
      rows.set(entry.descriptionHash, { key, mediaType: entry.mediaType,
        outcome: projectAutomaticPolicyOutcome(common, retrieval, source.libraries, entry.mediaType) });
    }
    outcomes.push(rows);
  }
  const [baseline, sourceAware] = outcomes, metrics = createAutomaticPolicyMetrics();
  const byMedia = { movie: createAutomaticPolicyMetrics(), tv: createAutomaticPolicyMetrics() };
  if (baseline.size !== retrievalReport.sampled || sourceAware.size !== baseline.size) throw new Error('automatic_policy_cohort_mismatch');
  for (const [hash, a] of baseline) {
    const b = sourceAware.get(hash);
    if (!b || a.key !== b.key || a.mediaType !== b.mediaType) throw new Error('automatic_policy_cohort_mismatch');
    for (const target of [metrics, byMedia[a.mediaType]]) addAutomaticPolicyMetrics(target, a.outcome, b.outcome, corrections.get(a.key));
  }
  return createAutomaticPolicyReport('complete', { metrics, byMedia, correctionLabels: arms[0].corrections.size, eligibleLabels: corrections.size });
}
