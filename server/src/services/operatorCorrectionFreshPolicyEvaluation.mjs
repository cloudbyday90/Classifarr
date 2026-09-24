/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryOutcomeLabels } from './inventoryOutcomeLabels.mjs';
import { withoutInferredProfileSources } from './heldOutSemanticStudyPreparation.mjs';

/** Labels select cases only; neither the policy evaluator nor prompts receive them. */
export function prepareOperatorCorrectionFreshPolicySource(source) {
  if (!Array.isArray(source?.operatorFeedbackRows)) throw new Error('operator_correction_labels_unavailable');
  const { labels, coverage } = prepareInventoryOutcomeLabels(
    source.operatorFeedbackRows, source.corpus.documents, source.libraries,
  );
  const corrections = new Map([...labels].filter(([, label]) => label.kind === 'correction'));
  const { operatorFeedbackRows: _privateLabels, ...unlabeledSource } = source;
  return {
    source: { ...unlabeledSource, policies: source.policies.map(withoutInferredProfileSources) },
    eligibleSampleKeys: new Set(corrections.keys()),
    corrections,
    coverage,
  };
}

const empty = () => ({ sampled: 0, policyLeaders: 0, policyLeaderMatches: 0,
  policyAutomaticDecisions: 0, policyAutomaticMatches: 0, aiProposals: 0,
  aiProposalMatches: 0, aiAbstentions: 0, aiFailures: 0, paired: 0,
  gainsOverPolicyLeader: 0, regressionsFromPolicyLeader: 0, changedDestinations: 0 });

function record(target, row, label) {
  const policy = row.prepared.policyResult;
  const leader = Number.isInteger(policy?.ranked?.[0]?.library_id) ? policy.ranked[0].library_id : null;
  const automatic = policy?.action === 'auto_classify' && Number.isInteger(policy?.library?.library_id)
    ? policy.library.library_id : null;
  const proposal = row.generated?.status === 'proposed' && Number.isInteger(row.generated.destinationId)
    ? row.generated.destinationId : null;
  target.sampled++;
  target.policyLeaders += Number(leader !== null);
  target.policyLeaderMatches += Number(leader === label.libraryId);
  target.policyAutomaticDecisions += Number(automatic !== null);
  target.policyAutomaticMatches += Number(automatic === label.libraryId);
  target.aiProposals += Number(proposal !== null);
  target.aiProposalMatches += Number(proposal === label.libraryId);
  target.aiAbstentions += Number(row.generated?.status === 'abstained');
  target.aiFailures += Number(Boolean(row.generated) && !['proposed', 'abstained'].includes(row.generated.status));
  target.paired += Number(leader !== null && proposal !== null);
  target.gainsOverPolicyLeader += Number(leader !== null && proposal !== null &&
    leader !== label.libraryId && proposal === label.libraryId);
  target.regressionsFromPolicyLeader += Number(leader !== null && proposal !== null &&
    leader === label.libraryId && proposal !== label.libraryId);
  target.changedDestinations += Number(leader !== null && proposal !== null && leader !== proposal);
}

/** Aggregate diagnostic only: the baseline is this run's deterministic policy leader, not a prior release. */
export function summarizeOperatorCorrectionFreshPolicy({ rows, corrections, coverage, evaluationSnapshotValid }) {
  const byMedia = { movie: empty(), tv: empty() };
  if (!evaluationSnapshotValid) return { status: 'invalidated', labelCoverage: coverage,
    sampledCorrections: 0, byMedia, independentBlindLabels: 0, fullPipelineAccuracy: null,
    priorReleaseComparisonAvailable: false, promotionAllowed: false };
  for (const row of rows) {
    const label = corrections.get(`${row.sample.mediaType}:${row.sample.itemIdentity.tmdbId}`);
    if (!label || !Object.hasOwn(byMedia, row.sample.mediaType)) throw new Error('operator_correction_sample_mismatch');
    record(byMedia[row.sample.mediaType], row, label);
  }
  return {
    status: rows.length ? 'diagnostic_only' : 'no_eligible_corrections',
    labelCoverage: coverage,
    sampledCorrections: rows.length,
    byMedia,
    independentBlindLabels: 0,
    fullPipelineAccuracy: null,
    priorReleaseComparisonAvailable: false,
    omittedLiveSources: ['historical_rag', 'outcome_history', 'learned_patterns',
      'source_library_shortcut', 'exact_inventory_identity', 'inferred_profile_policy_rules'],
    promotionAllowed: false,
  };
}

const placementProxyFields = new Set([
  'policyLeaderPlacementAgreement', 'policyPoolPlacementMisses', 'shortlistPlacementMisses',
  'proposalPlacementAgreement', 'libraries', 'media', 'learnedReview', 'matchCalibration',
  'neighborFallback', 'evaluation',
]);

/** Do not present inventory-placement proxies as correction-label results. */
export function buildOperatorCorrectionFreshPolicyReport(report, correctionEvaluation) {
  const safe = Object.fromEntries(Object.entries(report).filter(([key]) => !placementProxyFields.has(key)));
  return { ...safe, protocol: 'operator_corrected_fresh_policy_v1',
    status: correctionEvaluation.status === 'no_eligible_corrections' ? 'no_eligible_corrections' : report.status,
    foldProtocol: report.evaluation?.protocol ?? null,
    folds: report.evaluation?.folds ?? null,
    correctionEvaluation };
}
