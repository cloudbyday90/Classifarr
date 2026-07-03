import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_RUNTIME_DECISION_IDS = Object.freeze({
  KEEP_RUNTIME_ENGINE_PRIMITIVE: 'keep_runtime_engine_primitive',
  REWRITE_AROUND_POLICY_CONTRACTS: 'rewrite_around_policy_contracts',
  REPLACE_WITH_READINESS_QUESTION_CONTRACT: 'replace_with_readiness_question_contract',
  DELETE_AFTER_MIGRATION: 'delete_after_migration',
});

const POLICY_RUNTIME_STAGE_IDS = Object.freeze({
  CLASSIFICATION_POLICY_PATH: 'classification_policy_path',
  SIGNAL_CALCULATION: 'signal_calculation',
  AI_ANALYSIS_VERIFICATION: 'ai_analysis_verification',
  RAG_DECISION: 'rag_decision',
  QUESTION_GENERATION: 'question_generation',
  MANUAL_RESOLUTION: 'manual_resolution',
  LEARNING_SIDE_EFFECT: 'learning_side_effect',
  ARR_ROUTING: 'arr_routing',
  MEDIA_PROFILE_REFRESH: 'media_profile_refresh',
  QUEUE_RETRY: 'queue_retry',
  RUNTIME_ROUTE: 'runtime_route',
});

const POLICY_RUNTIME_RISK_IDS = Object.freeze({
  MISSING_ARTIFACT_PATH: 'missing_artifact_path',
  MISSING_OWNER: 'missing_owner',
  MISSING_REPLACEMENT_TARGET: 'missing_replacement_target',
  UNKNOWN_DECISION: 'unknown_decision',
  UNKNOWN_STAGE: 'unknown_stage',
  UNKNOWN_AUTHORITY_SOURCE: 'unknown_authority_source',
  MISSING_AUTHORITY_SOURCE: 'missing_authority_source',
  MISSING_RISK_REASON: 'missing_risk_reason',
  NORMAL_RUNTIME_DIAGNOSTIC_AUTHORITY: 'normal_runtime_diagnostic_authority',
  BROAD_GENRE_AUTHORITY_RISK_NOT_LISTED: 'broad_genre_authority_risk_not_listed',
  CLASSIFICATION_ROUTING_CONFLATION_NOT_LISTED: 'classification_routing_conflation_not_listed',
  BAD_QUESTION_PATH_NOT_LISTED: 'bad_question_path_not_listed',
  MISSING_RUNTIME_SURFACE_ARTIFACT: 'missing_runtime_surface_artifact',
  MISSING_RUNTIME_CONTRACT_SURFACE: 'missing_runtime_contract_surface',
  ARTIFACT_PATH_NOT_FOUND: 'artifact_path_not_found',
});

const POLICY_BAD_QUESTION_PATH_IDS = Object.freeze({
  GENRE_PRIORITY_QUESTION: 'genre_priority_question',
  AI_INVALID_RESPONSE_QUESTION: 'ai_invalid_response_question',
  AI_DISAGREEMENT_QUESTION: 'ai_disagreement_question',
  PENDING_GENERATE_RULE_FLAG: 'pending_generate_rule_flag',
});

const DECISION_IDS = Object.freeze(Object.values(POLICY_RUNTIME_DECISION_IDS));
const STAGE_IDS = Object.freeze(Object.values(POLICY_RUNTIME_STAGE_IDS));
const AUTHORITY_IDS = Object.freeze(Object.values(AUTHORITY_SOURCE_IDS));

const REQUIRED_STAGE_IDS = Object.freeze([
  POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
  POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
  POLICY_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION,
  POLICY_RUNTIME_STAGE_IDS.RAG_DECISION,
  POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
  POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
  POLICY_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT,
  POLICY_RUNTIME_STAGE_IDS.ARR_ROUTING,
  POLICY_RUNTIME_STAGE_IDS.MEDIA_PROFILE_REFRESH,
  POLICY_RUNTIME_STAGE_IDS.QUEUE_RETRY,
]);

const REQUIRED_CONFLATION_RISK_PATHS = Object.freeze([
  'server/src/services/classificationPersistenceService.mjs',
  'server/src/routes/classificationRoutePending.mjs',
  'server/src/services/classificationRoutingService.mjs',
]);

const REQUIRED_BROAD_GENRE_RISK_PATHS = Object.freeze([
  'server/src/services/policyQuestionBuilderQuestions.mjs',
  'server/src/services/classificationPolicyPathService.mjs',
  'server/src/services/classificationRagLoopService.mjs',
]);

const REQUIRED_BAD_QUESTION_PATH_IDS = Object.freeze(Object.values(POLICY_BAD_QUESTION_PATH_IDS));

const REQUIRED_RUNTIME_SURFACE_PATHS = Object.freeze([
  'server/src/routes/classification.mjs',
  'server/src/routes/classificationRouteShared.mjs',
  'server/src/routes/classificationRouteSecondPass.mjs',
  'server/src/routes/classificationRoutePending.mjs',
  'server/src/routes/classificationRouteCorrections.mjs',
  'server/src/services/classification.mjs',
  'server/src/services/classificationServiceCore.mjs',
  'server/src/services/classificationPolicyPathService.mjs',
  'server/src/services/classificationAiService.mjs',
  'server/src/services/classificationRagLoopService.mjs',
  'server/src/services/policyQuestionBuilderQuestions.mjs',
  'server/src/services/classificationRoutingService.mjs',
  'server/src/services/classificationPersistenceService.mjs',
  'server/src/services/classificationMetadataService.mjs',
  'server/src/services/classificationMetadataEnrichmentService.mjs',
  'server/src/services/discordPendingNotification.mjs',
]);

const REQUIRED_RUNTIME_CONTRACT_SURFACE_PATHS = Object.freeze([
  'server/src/services/policyRuntimeEvidenceProjection.mjs',
  'server/src/services/policyRuntimeEvidenceFingerprint.mjs',
  'server/src/services/policyAutomationDecisionContract.mjs',
  'server/src/services/policyRuntimeQuestionReduction.mjs',
  'server/src/services/policyRequestTimeLearning.mjs',
  'server/src/services/policyLibraryPolicyRebuild.mjs',
  'server/src/services/policyMigrationVerifierRollback.mjs',
  'server/src/services/policyRuntimeMetricsTrace.mjs',
]);

const RUNTIME_ARTIFACTS = Object.freeze([
  {
    path: 'server/src/routes/classification.mjs',
    owner: 'classification-route-entrypoint',
    stageId: POLICY_RUNTIME_STAGE_IDS.RUNTIME_ROUTE,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Authenticated classification route entrypoint delegating to policy runtime contracts',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/routes/classificationRouteShared.mjs',
    owner: 'classification-route-entrypoint',
    stageId: POLICY_RUNTIME_STAGE_IDS.RUNTIME_ROUTE,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy runtime orchestration entrypoint that separates classify, ask, route, retry, and learn states',
    riskIds: [
      'classification_route_entrypoint_can_bypass_runtime_decision_contract',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/routes/classificationRouteSecondPass.mjs',
    owner: 'classification-diagnostics',
    stageId: POLICY_RUNTIME_STAGE_IDS.RAG_DECISION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.DELETE_AFTER_MIGRATION,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'Bounded decision trace and evidence projection diagnostics',
    riskIds: [
      'second_pass_diagnostic_can_preserve_old_rag_loop_authority',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classification.mjs',
    owner: 'classification-runtime',
    stageId: POLICY_RUNTIME_STAGE_IDS.RUNTIME_ROUTE,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Runtime orchestration over policy evidence, intent, readiness, and learning contracts',
    riskIds: [
      'runtime_orchestrator_can_bypass_policy_contracts_without_cutline',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationServiceCore.mjs',
    owner: 'classification-runtime',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy automation decision contract',
    riskIds: [
      'classification_core_can_mix_classify_ask_route_and_learn_states',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationPolicyPathService.mjs',
    owner: 'classification-policy-path',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    replacementTarget: 'policy runtime evidence projection and automation decision contract',
    riskIds: [
      'broad_genre_overlap_can_act_like_destination_authority',
      'legacy_template_can_obscure_policy_intent',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationLegacySignalPathService.mjs',
    owner: 'classification-policy-path',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.DELETE_AFTER_MIGRATION,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    replacementTarget: 'native intent storage after runtime parity',
    riskIds: [
      'legacy_signal_scoring_not_destination_intent',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationAuthoritativeSignalService.mjs',
    owner: 'classification-signals',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy evidence source adapter',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/classificationAuthoritativeSignalShared.mjs',
    owner: 'classification-signals',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy evidence source adapter',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyEngine.mjs',
    owner: 'policy-runtime',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    replacementTarget: 'policy runtime evidence projection and native intent evaluator',
    riskIds: [
      'legacy_policy_engine_can_score_without_policy_intent_contract',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/policyDecisionBuilder.mjs',
    owner: 'policy-runtime',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    replacementTarget: 'policy automation decision builder',
    riskIds: [
      'legacy_decision_builder_can_emit_decisions_without_policy_readiness',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/policyCandidateRanker.mjs',
    owner: 'policy-runtime',
    stageId: POLICY_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    replacementTarget: 'policy runtime evidence projection with policy bucket semantics',
    riskIds: [
      'compatibility_signals_can_outweigh_identity_evidence',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationAiService.mjs',
    owner: 'classification-ai',
    stageId: POLICY_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    replacementTarget: 'bounded AI suggestion normalizer and question contract',
    riskIds: [
      'ai_output_not_final_authority',
      'ai_explanation_cannot_learn_directly',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationAiRepair.mjs',
    owner: 'classification-ai',
    stageId: POLICY_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    replacementTarget: 'structured AI response normalizer',
    riskIds: [
      'ai_response_repair_can_mask_contract_violation',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/aiResponseParserResults.mjs',
    owner: 'classification-ai',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    replacementTarget: 'policy question contract and runtime question reduction',
    riskIds: [
      POLICY_BAD_QUESTION_PATH_IDS.AI_INVALID_RESPONSE_QUESTION,
      POLICY_BAD_QUESTION_PATH_IDS.AI_DISAGREEMENT_QUESTION,
      'ai_disagreement_can_become_operator_question_without_intent_context',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationRagLoopService.mjs',
    owner: 'classification-rag',
    stageId: POLICY_RUNTIME_STAGE_IDS.RAG_DECISION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'policy evidence projection that demotes weak RAG neighbors',
    riskIds: [
      'unknown_library_neighbors_can_act_like_destination_authority',
      'broad_genre_overlap_can_act_like_destination_authority',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationMetadataService.mjs',
    owner: 'classification-metadata',
    stageId: POLICY_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'policy evidence projection adapter that treats metadata as bounded evidence',
    riskIds: [
      'metadata_provider_payload_can_be_overweighted_without_evidence_boundary',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationMetadataEnrichmentService.mjs',
    owner: 'classification-metadata',
    stageId: POLICY_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'policy metadata evidence source with bounded provider provenance and no final authority',
    riskIds: [
      'metadata_enrichment_can_trigger_provider_weight_without_readiness_gate',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationRagLoopPhases.mjs',
    owner: 'classification-rag',
    stageId: POLICY_RUNTIME_STAGE_IDS.RAG_DECISION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'policy evidence projection stages',
    riskIds: [
      'rag_stage_output_must_be_demoted_to_evidence_source',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/policyQuestionBuilder.mjs',
    owner: 'runtime-questions',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy question contract and runtime question reduction',
    riskIds: [
      'question_generation_not_bound_to_policy_readiness',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/policyQuestionBuilderQuestions.mjs',
    owner: 'runtime-questions',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Destination-fit question normalizer with learning eligibility metadata',
    riskIds: [
      POLICY_BAD_QUESTION_PATH_IDS.GENRE_PRIORITY_QUESTION,
      'broad_genre_overlap_can_act_like_destination_authority',
      'candidate_question_can_ask_best_library_without_readiness_reason',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/clarificationService.mjs',
    owner: 'runtime-questions',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'pending answer resolver plus policy learning guard',
    riskIds: [
      'manual_resolution_can_create_learning_side_effect',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/clarificationQuestionManager.mjs',
    owner: 'runtime-questions',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy question contract with stale-question metadata',
    riskIds: [
      'question_manager_must_reject_stale_or_non_learning_question_shapes',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/routes/classificationRoutePending.mjs',
    owner: 'runtime-questions',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'pending resolver that separates outcome, learning, and routing',
    riskIds: [
      POLICY_BAD_QUESTION_PATH_IDS.PENDING_GENERATE_RULE_FLAG,
      'classification_success_can_be_conflated_with_routing_success',
      'manual_answer_can_generate_rule_without_learning_guard',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/routes/classificationRouteCorrections.mjs',
    owner: 'runtime-corrections',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy learning guard for correction-derived evidence',
    riskIds: [
      'correction_can_remember_exact_match_directly',
      'pattern_reinforcement_can_bypass_learning_guard',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationOutcomeService.mjs',
    owner: 'runtime-outcomes',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'final outcome ledger feeding policy learning guard',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/classificationEvidenceService.mjs',
    owner: 'runtime-learning',
    stageId: POLICY_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy learning guard writes guarded evidence only',
    riskIds: [
      'evidence_write_can_bypass_learning_guard',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationEvidenceReinforcementService.mjs',
    owner: 'runtime-learning',
    stageId: POLICY_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy learning guard reinforcement adapter',
    riskIds: [
      'reinforcement_can_convert_single_outcome_into_broad_rule',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationLearnedCorrectionsService.mjs',
    owner: 'runtime-learning',
    stageId: POLICY_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'Guarded exact-item memory and compatibility evidence service',
    riskIds: [
      'learned_correction_can_outweigh_current_intent_without_freshness',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationRoutingService.mjs',
    owner: 'runtime-routing',
    stageId: POLICY_RUNTIME_STAGE_IDS.ARR_ROUTING,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy automation decision contract with classified-not-routed state',
    riskIds: [
      'classification_success_can_be_conflated_with_routing_success',
      'missing_arr_mapping_can_look_like_completed_classification',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationRoutingArrRadarr.mjs',
    owner: 'runtime-routing',
    stageId: POLICY_RUNTIME_STAGE_IDS.ARR_ROUTING,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Arr route executor behind policy automation decision gate',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/classificationRoutingArrSonarr.mjs',
    owner: 'runtime-routing',
    stageId: POLICY_RUNTIME_STAGE_IDS.ARR_ROUTING,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Arr route executor behind policy automation decision gate',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/classificationPersistenceService.mjs',
    owner: 'runtime-persistence',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy decision-state persistence that separates classify, route, ask, and block',
    riskIds: [
      'classification_success_can_be_conflated_with_routing_success',
      'final_outcome_can_be_mistaken_for_learning',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationPersistenceRagEvents.mjs',
    owner: 'runtime-persistence',
    stageId: POLICY_RUNTIME_STAGE_IDS.RAG_DECISION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
    replacementTarget: 'Bounded decision trace events with no raw provider payloads',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/mediaServerLibrarySync.mjs',
    owner: 'runtime-profile',
    stageId: POLICY_RUNTIME_STAGE_IDS.MEDIA_PROFILE_REFRESH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    replacementTarget: 'observed application profile source for policy evidence projection',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/classificationRetryService.mjs',
    owner: 'runtime-retry',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUEUE_RETRY,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy retry state machine over decision states',
    riskIds: [
      'retry_can_repeat_stale_question_or_stale_profile_decision',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationRetryFollowupService.mjs',
    owner: 'runtime-retry',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUEUE_RETRY,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'policy stale-profile retry and question-reduction contract',
    riskIds: [
      'retry_followup_must_not_reask_stale_or_low_quality_questions',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/classificationProgressStageService.mjs',
    owner: 'runtime-progress',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUEUE_RETRY,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.AI_OUTPUT,
    replacementTarget: 'Runtime progress telemetry without policy authority',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/reclassificationService.mjs',
    owner: 'runtime-reclassification',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'final outcome and policy learning guard boundary',
    riskIds: [
      'manual_reclassification_can_bypass_learning_guard',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/discordClarificationHandler.mjs',
    owner: 'runtime-discord',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REWRITE_AROUND_POLICY_CONTRACTS,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy question contract and learning guard',
    riskIds: [
      'discord_answer_can_resolve_outcome_without_question_freshness',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/discordPendingNotification.mjs',
    owner: 'runtime-discord',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'policy question contract renderer with stale-question and learning-eligibility metadata',
    riskIds: [
      'pending_discord_notification_can_render_stale_or_unbounded_question',
    ],
    normalRuntimeAuthorityAllowed: false,
  },
  {
    path: 'server/src/services/policyRuntimeEvidenceProjection.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    replacementTarget: 'Runtime evidence projection contract consumed by automation decisions',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyRuntimeEvidenceFingerprint.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    replacementTarget: 'Sanitized runtime evidence fingerprint contract',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyAutomationDecisionContract.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Server-owned automation decision contract over runtime evidence',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyRuntimeQuestionReduction.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.QUESTION_GENERATION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Runtime question reduction contract consuming automation decisions',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyRequestTimeLearning.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'Request-time learning eligibility contract behind the learning guard',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyLibraryPolicyRebuild.mjs',
    owner: 'policy-rebuild-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.MEDIA_PROFILE_REFRESH,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    replacementTarget: 'Library-derived policy rebuild proposal contract',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyMigrationVerifierRollback.mjs',
    owner: 'policy-rebuild-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
    replacementTarget: 'Migration verifier and rollback contract for operator-accepted rebuilds',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
  {
    path: 'server/src/services/policyRuntimeMetricsTrace.mjs',
    owner: 'policy-runtime-contract',
    stageId: POLICY_RUNTIME_STAGE_IDS.RUNTIME_ROUTE,
    decisionId: POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE,
    authoritySourceId: AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
    replacementTarget: 'Bounded runtime metrics and decision trace projection',
    riskIds: [],
    normalRuntimeAuthorityAllowed: true,
  },
]);

const BAD_QUESTION_PATHS = Object.freeze([
  {
    id: POLICY_BAD_QUESTION_PATH_IDS.GENRE_PRIORITY_QUESTION,
    path: 'server/src/services/policyQuestionBuilderQuestions.mjs',
    replacementTarget: 'destination-fit question normalizer',
    reason: 'Genre priority framing can make broad overlap look like destination authority.',
  },
  {
    id: POLICY_BAD_QUESTION_PATH_IDS.AI_INVALID_RESPONSE_QUESTION,
    path: 'server/src/services/aiResponseParserResults.mjs',
    replacementTarget: 'bounded AI-response clarification contract',
    reason: 'Invalid AI response questions should ask for destination-fit resolution, not validate AI output.',
  },
  {
    id: POLICY_BAD_QUESTION_PATH_IDS.AI_DISAGREEMENT_QUESTION,
    path: 'server/src/services/aiResponseParserResults.mjs',
    replacementTarget: 'bounded AI-response clarification contract',
    reason: 'AI disagreement is a suggestion conflict, not a policy authority question.',
  },
  {
    id: POLICY_BAD_QUESTION_PATH_IDS.PENDING_GENERATE_RULE_FLAG,
    path: 'server/src/routes/classificationRoutePending.mjs',
    replacementTarget: 'policy learning guard plus pending resolver',
    reason: 'Resolving an item and generating durable learning must be separate decisions.',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pathExists(relativePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- inventory paths are repo-owned constants.
  return existsSync(resolve(REPO_ROOT, relativePath));
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function listPolicyRuntimeArtifacts() {
  return RUNTIME_ARTIFACTS;
}

function listPolicyBadQuestionPaths() {
  return BAD_QUESTION_PATHS;
}

function listPolicyRequiredRuntimeSurfacePaths() {
  return REQUIRED_RUNTIME_SURFACE_PATHS;
}

function listPolicyRequiredRuntimeContractSurfacePaths() {
  return REQUIRED_RUNTIME_CONTRACT_SURFACE_PATHS;
}

function normalizeRuntimeArtifact(artifact = {}) {
  return {
    path: normalizeString(artifact.path),
    owner: normalizeString(artifact.owner),
    stageId: normalizeString(artifact.stageId),
    decisionId: normalizeString(artifact.decisionId),
    authoritySourceId: normalizeString(artifact.authoritySourceId),
    replacementTarget: normalizeString(artifact.replacementTarget),
    riskIds: asArray(artifact.riskIds),
    normalRuntimeAuthorityAllowed: artifact.normalRuntimeAuthorityAllowed === true,
  };
}

function validateRuntimeArtifact(artifact = {}, {
  checkPathExists = true,
} = {}) {
  const candidate = normalizeRuntimeArtifact(artifact);
  const issues = [];

  if (!candidate.path) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.MISSING_ARTIFACT_PATH,
      'Runtime artifacts must include a path.'
    ));
  } else if (checkPathExists && !pathExists(candidate.path)) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
      `Runtime artifact path does not exist: ${candidate.path}.`,
      { path: candidate.path }
    ));
  }

  if (!candidate.owner) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.MISSING_OWNER,
      'Runtime artifacts must include an owner.',
      { path: candidate.path || null }
    ));
  }

  if (!STAGE_IDS.includes(candidate.stageId)) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.UNKNOWN_STAGE,
      'Runtime artifacts must use a supported runtime stage.',
      { path: candidate.path || null, stageId: candidate.stageId || null }
    ));
  }

  if (!DECISION_IDS.includes(candidate.decisionId)) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.UNKNOWN_DECISION,
      'Runtime artifacts must use a supported cutline decision.',
      { path: candidate.path || null, decisionId: candidate.decisionId || null }
    ));
  }

  if (!candidate.authoritySourceId) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      'Runtime artifacts must identify an authority source before behavior changes.',
      { path: candidate.path || null }
    ));
  } else if (!AUTHORITY_IDS.includes(candidate.authoritySourceId)) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
      'Runtime artifacts must use an approved authority source.',
      { path: candidate.path || null, authoritySourceId: candidate.authoritySourceId }
    ));
  }

  if (!candidate.replacementTarget) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.MISSING_REPLACEMENT_TARGET,
      'Runtime artifacts must name their policy replacement target or keep reason.',
      { path: candidate.path || null }
    ));
  }

  if (
    candidate.decisionId !== POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE &&
    candidate.riskIds.length === 0
  ) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.MISSING_RISK_REASON,
      'Runtime artifacts that need rewrite, replacement, or deletion must include risk reasons.',
      { path: candidate.path || null }
    ));
  }

  if (
    candidate.normalRuntimeAuthorityAllowed === true &&
    candidate.decisionId !== POLICY_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE
  ) {
    issues.push(buildIssue(
      POLICY_RUNTIME_RISK_IDS.NORMAL_RUNTIME_DIAGNOSTIC_AUTHORITY,
      'Rewrite, replacement, and deletion targets cannot keep normal runtime authority.',
      { path: candidate.path || null }
    ));
  }

  return {
    ok: issues.length === 0,
    artifact: candidate,
    issues,
  };
}

function buildPolicyRuntimeDecisionInventory({
  artifacts = RUNTIME_ARTIFACTS,
  badQuestionPaths = BAD_QUESTION_PATHS,
  checkPathExists = true,
} = {}) {
  const artifactResults = asArray(artifacts).map(artifact =>
    validateRuntimeArtifact(artifact, { checkPathExists })
  );
  const normalizedArtifacts = artifactResults.map(result => result.artifact);
  const artifactByPath = new Map(normalizedArtifacts.map(artifact => [artifact.path, artifact]));
  const issues = artifactResults.flatMap(result => result.issues);

  REQUIRED_STAGE_IDS
    .filter(stageId => !normalizedArtifacts.some(artifact => artifact.stageId === stageId))
    .forEach(stageId => {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.UNKNOWN_STAGE,
        `Policy runtime inventory is missing required stage "${stageId}".`,
        { stageId }
      ));
    });

  REQUIRED_BROAD_GENRE_RISK_PATHS.forEach(path => {
    const artifact = artifactByPath.get(path);
    if (!artifact || !artifact.riskIds.some(riskId => String(riskId).includes('broad_genre'))) {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.BROAD_GENRE_AUTHORITY_RISK_NOT_LISTED,
        `Runtime artifact must list broad-genre authority risk: ${path}.`,
        { path }
      ));
    }
  });

  REQUIRED_CONFLATION_RISK_PATHS.forEach(path => {
    const artifact = artifactByPath.get(path);
    if (!artifact || !artifact.riskIds.some(riskId => String(riskId).includes('routing_success'))) {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.CLASSIFICATION_ROUTING_CONFLATION_NOT_LISTED,
        `Runtime artifact must list classification/routing conflation risk: ${path}.`,
        { path }
      ));
    }
  });

  const badQuestionIds = new Set(asArray(badQuestionPaths).map(path => path.id));
  REQUIRED_BAD_QUESTION_PATH_IDS
    .filter(questionPathId => !badQuestionIds.has(questionPathId))
    .forEach(questionPathId => {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.BAD_QUESTION_PATH_NOT_LISTED,
        `Known bad question path is missing from the policy runtime inventory: ${questionPathId}.`,
        { questionPathId }
      ));
    });

  REQUIRED_RUNTIME_SURFACE_PATHS
    .filter(path => !artifactByPath.has(path))
    .forEach(path => {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.MISSING_RUNTIME_SURFACE_ARTIFACT,
        `Critical runtime surface path is missing from the policy runtime inventory: ${path}.`,
        { path }
      ));
    });

  REQUIRED_RUNTIME_CONTRACT_SURFACE_PATHS
    .filter(path => !artifactByPath.has(path))
    .forEach(path => {
      issues.push(buildIssue(
        POLICY_RUNTIME_RISK_IDS.MISSING_RUNTIME_CONTRACT_SURFACE,
        `Policy contract surface path is missing from the runtime inventory: ${path}.`,
        { path }
      ));
    });

  const byDecision = DECISION_IDS.reduce((acc, decisionId) => ({
    ...acc,
    [decisionId]: normalizedArtifacts.filter(artifact => artifact.decisionId === decisionId).length,
  }), {});
  const byStage = STAGE_IDS.reduce((acc, stageId) => ({
    ...acc,
    [stageId]: normalizedArtifacts.filter(artifact => artifact.stageId === stageId).length,
  }), {});

  return {
    version: 'policy.runtime_decision_inventory.v1',
    stepId: 'runtime_decision_inventory',
    ok: issues.length === 0,
    issueCount: issues.length,
    artifactCount: normalizedArtifacts.length,
    badQuestionPathCount: asArray(badQuestionPaths).length,
    artifacts: normalizedArtifacts,
    badQuestionPaths: asArray(badQuestionPaths),
    byDecision,
    byStage,
    issues,
    nextStep: {
      stepId: 'runtime_evidence_projection',
      label: 'Runtime Evidence Projection',
      reason: 'Runtime artifacts now have authority sources and cutline decisions, so evidence can be projected through policy evidence buckets.',
    },
  };
}

export {
  POLICY_BAD_QUESTION_PATH_IDS,
  POLICY_RUNTIME_DECISION_IDS,
  POLICY_RUNTIME_RISK_IDS,
  POLICY_RUNTIME_STAGE_IDS,
  buildPolicyRuntimeDecisionInventory,
  listPolicyBadQuestionPaths,
  listPolicyRequiredRuntimeContractSurfacePaths,
  listPolicyRequiredRuntimeSurfacePaths,
  listPolicyRuntimeArtifacts,
  validateRuntimeArtifact,
};
