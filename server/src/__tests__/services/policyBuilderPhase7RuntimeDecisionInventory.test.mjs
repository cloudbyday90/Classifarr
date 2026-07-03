import {
  AUTHORITY_SOURCE_IDS,
} from '../../services/policyAuthorityVocabulary.mjs';
import {
  PHASE7R_BAD_QUESTION_PATH_IDS,
  PHASE7R_RUNTIME_DECISION_IDS,
  PHASE7R_RUNTIME_RISK_IDS,
  PHASE7R_RUNTIME_STAGE_IDS,
  buildPolicyBuilderPhase7RuntimeDecisionInventory,
  listPolicyBuilderPhase7BadQuestionPaths,
  listPolicyBuilderPhase7RequiredRuntimeSurfacePaths,
  listPolicyBuilderPhase7RuntimeArtifacts,
  validateRuntimeArtifact,
} from '../../services/policyBuilderPhase7RuntimeDecisionInventory.mjs';

describe('policyBuilderPhase7RuntimeDecisionInventory', () => {
  test('inventories runtime classification, question, learning, routing, profile, queue, and retry paths', () => {
    const inventory = buildPolicyBuilderPhase7RuntimeDecisionInventory();

    expect(inventory.ok).toBe(true);
    expect(inventory.artifactCount).toBeGreaterThanOrEqual(30);
    expect(inventory.byStage).toEqual(expect.objectContaining({
      [PHASE7R_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.SIGNAL_CALCULATION]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.AI_ANALYSIS_VERIFICATION]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.RAG_DECISION]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.QUESTION_GENERATION]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.MANUAL_RESOLUTION]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.LEARNING_SIDE_EFFECT]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.ARR_ROUTING]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.MEDIA_PROFILE_REFRESH]: expect.any(Number),
      [PHASE7R_RUNTIME_STAGE_IDS.QUEUE_RETRY]: expect.any(Number),
    }));
  });

  test('classifies runtime artifacts into keep, rewrite, replace, and delete decisions', () => {
    const inventory = buildPolicyBuilderPhase7RuntimeDecisionInventory();

    expect(inventory.byDecision).toEqual(expect.objectContaining({
      [PHASE7R_RUNTIME_DECISION_IDS.KEEP_RUNTIME_ENGINE_PRIMITIVE]: expect.any(Number),
      [PHASE7R_RUNTIME_DECISION_IDS.REWRITE_AROUND_PHASE5_6_CONTRACTS]: expect.any(Number),
      [PHASE7R_RUNTIME_DECISION_IDS.REPLACE_WITH_READINESS_QUESTION_CONTRACT]: expect.any(Number),
      [PHASE7R_RUNTIME_DECISION_IDS.DELETE_AFTER_MIGRATION]: expect.any(Number),
    }));
    Object.values(inventory.byDecision).forEach(count => {
      expect(count).toBeGreaterThan(0);
    });
  });

  test('requires every runtime artifact to name an authority source before behavior changes', () => {
    const artifacts = listPolicyBuilderPhase7RuntimeArtifacts();

    expect(artifacts.every(artifact => artifact.authoritySourceId)).toBe(true);
    expect(artifacts.map(artifact => artifact.authoritySourceId)).toEqual(expect.arrayContaining([
      AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
      AUTHORITY_SOURCE_IDS.OPERATOR_DECLARED_INTENT,
      AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
      AUTHORITY_SOURCE_IDS.AI_OUTPUT,
      AUTHORITY_SOURCE_IDS.METADATA_PROVIDER,
      AUTHORITY_SOURCE_IDS.LEGACY_TEMPLATE,
    ]));
  });

  test('requires critical runtime route, metadata, and pending-notification surfaces to be inventoried', () => {
    const requiredPaths = listPolicyBuilderPhase7RequiredRuntimeSurfacePaths();
    const inventory = buildPolicyBuilderPhase7RuntimeDecisionInventory();

    expect(requiredPaths).toEqual(expect.arrayContaining([
      'server/src/routes/classification.mjs',
      'server/src/routes/classificationRouteShared.mjs',
      'server/src/routes/classificationRouteSecondPass.mjs',
      'server/src/services/classificationMetadataService.mjs',
      'server/src/services/classificationMetadataEnrichmentService.mjs',
      'server/src/services/discordPendingNotification.mjs',
    ]));
    expect(inventory.artifacts.map(artifact => artifact.path)).toEqual(
      expect.arrayContaining(requiredPaths)
    );
  });

  test('lists known bad question-generation paths for replacement', () => {
    const badQuestionPaths = listPolicyBuilderPhase7BadQuestionPaths();

    expect(badQuestionPaths.map(item => item.id)).toEqual([
      PHASE7R_BAD_QUESTION_PATH_IDS.GENRE_PRIORITY_QUESTION,
      PHASE7R_BAD_QUESTION_PATH_IDS.AI_INVALID_RESPONSE_QUESTION,
      PHASE7R_BAD_QUESTION_PATH_IDS.AI_DISAGREEMENT_QUESTION,
      PHASE7R_BAD_QUESTION_PATH_IDS.PENDING_GENERATE_RULE_FLAG,
    ]);
    badQuestionPaths.forEach(item => {
      expect(item).toEqual(expect.objectContaining({
        path: expect.any(String),
        replacementTarget: expect.any(String),
        reason: expect.any(String),
      }));
    });
  });

  test('flags broad genre authority and classification-routing conflation risks', () => {
    const inventory = buildPolicyBuilderPhase7RuntimeDecisionInventory();

    expect(inventory.issues).toEqual([]);
    expect(inventory.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'server/src/services/policyQuestionBuilderQuestions.mjs',
        riskIds: expect.arrayContaining([
          PHASE7R_BAD_QUESTION_PATH_IDS.GENRE_PRIORITY_QUESTION,
          'broad_genre_overlap_can_act_like_destination_authority',
        ]),
      }),
      expect.objectContaining({
        path: 'server/src/services/classificationRoutingService.mjs',
        riskIds: expect.arrayContaining([
          'classification_success_can_be_conflated_with_routing_success',
        ]),
      }),
      expect.objectContaining({
        path: 'server/src/services/classificationPersistenceService.mjs',
        riskIds: expect.arrayContaining([
          'classification_success_can_be_conflated_with_routing_success',
        ]),
      }),
    ]));
  });

  test('rejects runtime artifacts without owner, authority, risk reason, or known path', () => {
    const result = validateRuntimeArtifact({
      path: 'server/src/services/doesNotExist.mjs',
      stageId: PHASE7R_RUNTIME_STAGE_IDS.CLASSIFICATION_POLICY_PATH,
      decisionId: PHASE7R_RUNTIME_DECISION_IDS.REWRITE_AROUND_PHASE5_6_CONTRACTS,
      normalRuntimeAuthorityAllowed: true,
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.MISSING_OWNER,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.MISSING_AUTHORITY_SOURCE,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.MISSING_REPLACEMENT_TARGET,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.MISSING_RISK_REASON,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.NORMAL_RUNTIME_DIAGNOSTIC_AUTHORITY,
      }),
    ]));
  });

  test('rejects inventories missing required bad question and conflation records', () => {
    const inventory = buildPolicyBuilderPhase7RuntimeDecisionInventory({
      artifacts: listPolicyBuilderPhase7RuntimeArtifacts()
        .filter(artifact =>
          artifact.path !== 'server/src/services/classificationRoutingService.mjs' &&
          artifact.path !== 'server/src/services/discordPendingNotification.mjs'
        ),
      badQuestionPaths: listPolicyBuilderPhase7BadQuestionPaths()
        .filter(item => item.id !== PHASE7R_BAD_QUESTION_PATH_IDS.GENRE_PRIORITY_QUESTION),
      checkPathExists: false,
    });

    expect(inventory.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.CLASSIFICATION_ROUTING_CONFLATION_NOT_LISTED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.BAD_QUESTION_PATH_NOT_LISTED,
      }),
      expect.objectContaining({
        riskId: PHASE7R_RUNTIME_RISK_IDS.MISSING_RUNTIME_SURFACE_ARTIFACT,
      }),
    ]));
  });
});
