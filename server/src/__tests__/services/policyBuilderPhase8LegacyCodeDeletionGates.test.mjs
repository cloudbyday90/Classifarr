import {
  PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS,
  PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS,
  PHASE8R_LEGACY_CODE_DELETION_RISK_IDS,
  PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS,
  PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyBuilderPhase8LegacyCodeDeletionGates,
  buildPolicyBuilderPhase8LegacyCodeDeletionGatesAudit,
  validatePolicyBuilderPhase8LegacyCodeDeletionGates,
} from '../../services/policyBuilderPhase8LegacyCodeDeletionGates.mjs';

function buildCompleteCoverage() {
  return Object.fromEntries(
    Object.values(PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS)
      .map(coverageId => [coverageId, true])
  );
}

describe('policyBuilderPhase8LegacyCodeDeletionGates', () => {
  test('defines required deletion categories and coverage while defaulting to blocked', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates();

    expect(plan.statusId)
      .toBe(PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_UNCONVERTED_POLICIES);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.validation.ok).toBe(true);
    expect(plan.categories.map(category => category.categoryId)).toEqual([
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.LEGACY_SERIALIZER_DESERIALIZER,
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.CUSTOM_SIGNAL_MUTATION_HELPERS,
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.PRESET_AS_POLICY_RUNTIME,
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.OLD_PREVIEW_REPLAY_DIAGNOSTICS,
      PHASE8R_LEGACY_CODE_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS,
    ]);
    expect(plan.coverageRequirements.map(requirement => requirement.coverageId)).toEqual(
      Object.values(PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS)
    );
    expect(plan.sideEffects).toEqual({
      filesDeleted: false,
      filesArchived: false,
      routesRemoved: false,
      testsRemoved: false,
      storageChanged: false,
    });
  });

  test('blocks deletion while unconverted policies remain', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.COMPATIBILITY_UNTIL_CONVERTED,
      unconvertedPolicyCount: 2,
    });

    expect(plan.statusId)
      .toBe(PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_UNCONVERTED_POLICIES);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'unconverted_policies_remaining',
        count: 2,
      }),
    ]));
  });

  test('requires an explicit support stance after all policies are converted', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates({
      coverage: buildCompleteCoverage(),
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId)
      .toBe(PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_SUPPORT_STANCE);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'support_stance_not_explicit',
      }),
    ]));
  });

  test('requires all replacement coverage before deletion readiness', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates({
      coverage: {
        [PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS.NATIVE_READ_WRITE_TESTS]: true,
      },
      supportStanceId:
        PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId)
      .toBe(PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.BLOCKED_BY_MISSING_COVERAGE);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.blockers.filter(blocker => blocker.blockerId === 'missing_coverage'))
      .toHaveLength(Object.values(PHASE8R_LEGACY_CODE_DELETION_COVERAGE_IDS).length - 1);
  });

  test('marks replaced code ready for deletion only when gates, coverage, and stance pass', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId).toBe(PHASE8R_LEGACY_CODE_DELETION_STATUS_IDS.READY_TO_DELETE);
    expect(plan.readyToDelete).toBe(true);
    expect(plan.deletionPolicy).toEqual(expect.objectContaining({
      deleteReplacedCode: true,
      hideOrArchiveReplacedCode: false,
      allowPermanentDualModel: false,
    }));
    expect(plan.nextPhase).toEqual(expect.objectContaining({
      phaseId: '8r_8',
      label: 'Backup, Restore, And Post-Upgrade Safety',
    }));
  });

  test('rejects weakened deletion plans that hide code or perform side effects', () => {
    const plan = buildPolicyBuilderPhase8LegacyCodeDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });
    const validation = validatePolicyBuilderPhase8LegacyCodeDeletionGates({
      ...plan,
      categories: plan.categories.slice(1).map((category, index) => ({
        ...category,
        preservePermanently: index === 0,
      })),
      compatibilityDeletionGates: [],
      coverageRequirements: plan.coverageRequirements.slice(1),
      sideEffects: {
        ...plan.sideEffects,
        filesDeleted: true,
      },
      reasons: [],
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_DELETION_CATEGORY,
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_COVERAGE_REQUIREMENT,
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_COMPATIBILITY_INVENTORY,
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.PRESERVE_REPLACED_CODE_PERMANENTLY,
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      PHASE8R_LEGACY_CODE_DELETION_RISK_IDS.MISSING_REASON,
    ]));
  });

  test('summarizes deletion readiness for the Phase 8R audit chain', () => {
    const audit = buildPolicyBuilderPhase8LegacyCodeDeletionGatesAudit(
      buildPolicyBuilderPhase8LegacyCodeDeletionGates({
        coverage: buildCompleteCoverage(),
        supportStanceId:
          PHASE8R_LEGACY_CODE_DELETION_SUPPORT_STANCE_IDS.SUPPORTED_TIME_BOUND,
        unconvertedPolicyCount: 0,
      })
    );

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      readyToDelete: true,
      categoryCount: 6,
      coverageRequirementCount: 6,
      missingCoverageIds: [],
      nextPhase: expect.objectContaining({
        phaseId: '8r_8',
      }),
    }));
  });
});
