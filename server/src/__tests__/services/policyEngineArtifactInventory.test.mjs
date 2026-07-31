import {
  POLICY_ENGINE_ARTIFACT_CATEGORY_IDS,
  POLICY_ENGINE_ARTIFACT_DECISION_IDS,
  POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS,
  POLICY_ENGINE_ARTIFACT_TYPE_IDS,
  buildPolicyEngineArtifactInventoryAudit,
  classifyPolicyEngineArtifactPath,
  listPolicyEngineArtifactInventoryArtifacts,
  listPolicyEngineArtifactInventoryGroups,
  listPolicyEngineLegacySurfaceCoverage,
} from '../../services/policyEngineArtifactInventory.mjs';

describe('policyEngineArtifactInventory', () => {
  test('classifies active policy-engine artifacts across every required source layer', () => {
    const audit = buildPolicyEngineArtifactInventoryAudit();

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
    expect(audit.groupCount).toBeGreaterThanOrEqual(6);
    expect(audit.artifactCount).toBeGreaterThanOrEqual(38);
    expect(audit.coveredCategoryIds).toEqual(expect.arrayContaining([
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.IMPACT_PREVIEW,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.REPRESENTATIVE_REPLAY,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.TMDB_LIVE_PREVIEW,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PROVIDER_READINESS,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.INTERNAL_SUMMARY,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.STARTER_TEMPLATE_COMPATIBILITY,
    ]));
    expect(audit.artifactTypeIds).toEqual(expect.arrayContaining([
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPOSABLE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_UTILITY,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_ROUTE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_SERVICE,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.TEST,
      POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION,
    ]));
    expect(audit.decisionCounts).toEqual(expect.objectContaining({
      [POLICY_ENGINE_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE]: expect.any(Number),
      [POLICY_ENGINE_ARTIFACT_DECISION_IDS.REWRITE_FOR_ENGINE]: expect.any(Number),
      [POLICY_ENGINE_ARTIFACT_DECISION_IDS.REPLACE_WITH_ENGINE]: expect.any(Number),
      [POLICY_ENGINE_ARTIFACT_DECISION_IDS.DELETE_AFTER_CUTOVER]: expect.any(Number),
    }));
    expect(audit.nextStep).toEqual(expect.objectContaining({
      stepId: 'evidence_engine',
    }));
  });

  test('records retired preview and provider surfaces separately from active checkout artifacts', () => {
    const coverage = listPolicyEngineLegacySurfaceCoverage();
    const artifacts = listPolicyEngineArtifactInventoryArtifacts();
    const retiredCategoryIds = coverage
      .filter(record => record.statusId === 'retired')
      .map(record => record.categoryId);

    expect(retiredCategoryIds).toEqual(expect.arrayContaining([
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.IMPACT_PREVIEW,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.REPRESENTATIVE_REPLAY,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.TMDB_LIVE_PREVIEW,
      POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PROVIDER_READINESS,
    ]));
    expect(artifacts.some(artifact =>
      retiredCategoryIds.includes(artifact.categoryId)
    )).toBe(false);
  });

  test('records retired advanced scoring and bounded template intent surfaces explicitly', () => {
    const artifacts = listPolicyEngineArtifactInventoryArtifacts();
    const byPath = new Map(artifacts.map(artifact => [artifact.path, artifact]));

    expect(byPath.get('client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.DELETE_AFTER_CUTOVER,
      }));
    expect(byPath.has('client/src/components/policies/PolicyBuilderAdvancedSettings.vue')).toBe(false);
    expect(byPath.has('client/src/components/policies/PolicyIntentReadinessSummary.vue')).toBe(false);
    expect(byPath.get('server/src/services/policyIntentSignalOptionProjection.mjs'))
      .toEqual(expect.objectContaining({
        decisionId: POLICY_ENGINE_ARTIFACT_DECISION_IDS.KEEP_ENGINE_PRIMITIVE,
      }));
    expect(byPath.has('client/src/components/policies/PolicyStarterTemplateAccelerator.vue'))
      .toBe(false);
    expect(byPath.has('client/src/components/policies/PresetSelectionModal.vue'))
      .toBe(false);
  });

  test('identifies source layers without exposing a filesystem dependency to callers', () => {
    expect(classifyPolicyEngineArtifactPath('client/src/components/policies/PolicyBuilderModal.vue'))
      .toBe(POLICY_ENGINE_ARTIFACT_TYPE_IDS.CLIENT_COMPONENT);
    expect(classifyPolicyEngineArtifactPath('server/src/routes/policiesRoutePresets.mjs'))
      .toBe(POLICY_ENGINE_ARTIFACT_TYPE_IDS.SERVER_ROUTE);
    expect(classifyPolicyEngineArtifactPath('docs/architecture/policy-engine.md'))
      .toBe(POLICY_ENGINE_ARTIFACT_TYPE_IDS.DOCUMENTATION);
  });

  test('rejects ambiguous decisions, normal-workflow diagnostics, duplicates, and missing paths', () => {
    const [firstGroup] = listPolicyEngineArtifactInventoryGroups();
    const malformedGroup = {
      ...firstGroup,
      id: '',
      owner: '',
      decisionId: 'unsafe_decision',
      replacement: '',
      testDispositionId: 'unknown_test_disposition',
      normalWorkflowAllowed: true,
      artifactPaths: [
        firstGroup.artifactPaths[0],
        firstGroup.artifactPaths[0],
        'server/src/services/missingPolicyEngineArtifact.mjs',
      ],
    };
    const audit = buildPolicyEngineArtifactInventoryAudit({
      groups: [malformedGroup],
      surfaceCoverage: [],
      pathExists: path => path !== 'server/src/services/missingPolicyEngineArtifact.mjs',
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_GROUP_ID,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_OWNER,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_DECISION,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.UNKNOWN_TEST_DISPOSITION,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.LEGACY_SURFACE_IN_NORMAL_WORKFLOW,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.DUPLICATE_ARTIFACT_PATH,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.ARTIFACT_PATH_NOT_FOUND,
      }),
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.MISSING_SURFACE_COVERAGE,
      }),
    ]));
  });

  test('rejects active categories without artifacts and retired categories with active artifacts', () => {
    const groups = listPolicyEngineArtifactInventoryGroups();
    const coverage = listPolicyEngineLegacySurfaceCoverage().map(record =>
      record.categoryId === POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA
        ? { ...record, statusId: 'retired', retirementLedgerPath: 'server/src/services/policyMigrationDeletionPath.mjs' }
        : record
    );
    const audit = buildPolicyEngineArtifactInventoryAudit({
      groups,
      surfaceCoverage: coverage,
    });

    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_ENGINE_ARTIFACT_INVENTORY_RISK_IDS.RETIRED_SURFACE_WITH_ACTIVE_ARTIFACTS,
        categoryId: POLICY_ENGINE_ARTIFACT_CATEGORY_IDS.PARITY_DELTA,
      }),
    ]));
  });
});
