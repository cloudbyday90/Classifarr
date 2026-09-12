/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { summarizeLearnedEvidenceReviews } from './learnedEvidenceReviewReport.mjs';
export const countFreshPolicyValues = values => Object.fromEntries([...new Set(values)].sort()
  .map(value => [value, values.filter(item => item === value).length]));
const sum = values => values.reduce((total, value) => total + value, 0);
const mean = values => values.length ? Number((sum(values) / values.length).toFixed(2)) : null;

/** IDs and content are used only for private comparisons; output contains aggregate counts. */
export function summarizeFreshPolicyCases(rows) {
  const evaluated = rows.filter(row => row.prepared.policyResult);
  const admitted = rows.filter(row => row.prepared.status === 'ready');
  const finished = rows.filter(row => row.generated);
  const proposals = finished.filter(row => row.generated.status === 'proposed');
  const measured = finished.filter(row => Number.isFinite(row.generated.latencyMs));
  return { sampled: rows.length, policyEvaluated: evaluated.length,
    preparation: countFreshPolicyValues(rows.map(row => row.prepared.status)),
    actions: countFreshPolicyValues(evaluated.map(row => row.prepared.policyResult.action)),
    modes: countFreshPolicyValues(evaluated.map(row => row.prepared.mode)),
    modeReasons: countFreshPolicyValues(evaluated.map(row => row.prepared.modeReason)),
    missingMetadata: countFreshPolicyValues(evaluated.flatMap(row => row.prepared.missingMetadata)),
    policyScore: mean(evaluated.map(row => row.prepared.policyResult.confidence)),
    policyLeaderPlacementAgreement: evaluated.filter(row => row.sample.observedLibraryIds.includes(row.prepared.policyResult.ranked[0]?.library_id)).length,
    policyPoolPlacementMisses: evaluated.filter(row => !row.prepared.policyResult.ranked.some(candidate => row.sample.observedLibraryIds.includes(candidate.library_id))).length,
    adjudicationReady: admitted.length,
    shortlistPlacementMisses: admitted.filter(row => !row.prepared.arms.protected.contract.candidates.some(candidate => row.sample.observedLibraryIds.includes(candidate.libraryId))).length,
    finishedGenerations: finished.length, responseStatuses: countFreshPolicyValues(finished.map(row => row.generated.status)),
    proposals: proposals.length,
    proposalPlacementAgreement: proposals.filter(row => row.sample.observedLibraryIds.includes(row.generated.destinationId)).length,
    proposalPolicyDisagreements: proposals.filter(row => row.generated.destinationId !== row.prepared.policyResult.ranked[0]?.library_id).length,
    consensusEligible: finished.filter(row => row.generated.consensusEligible).length,
    consensusReasons: countFreshPolicyValues(finished.flatMap(row => row.generated.consensusReason ? [row.generated.consensusReason] : [])),
    routeSafetyAllowed: finished.filter(row => row.generated.automaticRouteAllowed).length,
    learnedReview: summarizeLearnedEvidenceReviews(rows),
    blockingGates: countFreshPolicyValues(finished.flatMap(row => row.generated.blockingGates ?? [])),
    measuredCalls: measured.length, meanLatencyMs: mean(measured.map(row => row.generated.latencyMs)),
    totalPromptTokens: sum(measured.map(row => row.generated.promptTokens)),
    totalOutputTokens: sum(measured.map(row => row.generated.outputTokens)) };
}

export function buildFreshPolicyReport({ source, prepared, rows, options, calls, identity, representation, interrupted, verificationFailure, changedComponents }) {
  const errors = rows.some(row => (row.generated && !['proposed', 'abstained'].includes(row.generated.status)) ||
    !['ready', 'mode_not_adjudication'].includes(row.prepared.status));
  return { version: 1, protocol: 'fresh_inventory_policy_evaluation_v1',
    status: interrupted ? 'interrupted' : verificationFailure ? 'invalidated' : errors ? 'completed_with_errors' : options.generateCases ? 'complete' : 'preflight',
    sourceVerified: !interrupted && !verificationFailure && !changedComponents?.length,
    evaluationSnapshotValid: !interrupted && !verificationFailure,
    snapshotScope: 'frozen_at_start', liveMetadataRefreshed: changedComponents?.includes('metadata') || changedComponents?.includes('observedTraits') || false,
    verificationFailure, changedComponents,
    sourceFingerprint: source.fingerprint, sampleFingerprint: prepared.sampleFingerprint,
    evidenceFingerprint: prepared.fingerprint, evaluation: prepared.evaluation,
    requested: options.size, sampleShortfall: options.size - rows.length, calls,
    requestedGenerationCases: options.generateCases, maximumCalls: options.generateCases,
    ...summarizeFreshPolicyCases(rows),
    media: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarizeFreshPolicyCases(rows.filter(row => row.sample.mediaType === mediaType)) })),
    libraries: [...source.libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1,
      mediaType: library.media_type, ...summarizeFreshPolicyCases(rows.filter(row => row.sample.observedLibraryIds.includes(library.id))) })),
    embedding: { model: representation.model, digest: representation.digest, dimensions: representation.dimensions },
    generation: identity ? { ...identity, context: options.context, temperature: 0, seed: 42, thinking: false } : null,
    unavailableSources: ['historical_rag', 'outcome_history', 'learned_patterns', 'source_library_shortcut', 'exact_inventory_identity'],
    unevaluatedAiModes: ['verify', 'classify'], policyConfigurationRetrained: false,
    independentLabels: 0, accuracy: null, inputTruncation: 'unknown', freshPolicyEvaluation: true,
    liveRoutingChanged: false, routingReceiptsCreated: 0, userQuestionsCreated: 0, learningRecordsCreated: 0,
    arms: [] };
}
