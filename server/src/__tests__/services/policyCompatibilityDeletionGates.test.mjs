import {
  POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS,
  POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS,
  POLICY_COMPATIBILITY_DELETION_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS,
  buildPolicyCompatibilityDeletionGates,
  buildPolicyCompatibilityDeletionGatesAudit,
  validatePolicyCompatibilityDeletionGates,
} from '../../services/policyCompatibilityDeletionGates.mjs';

function buildCompleteCoverage() {
  return Object.fromEntries(
    Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
      .map(coverageId => [coverageId, true])
  );
}

describe('policyCompatibilityDeletionGates', () => {
  test('defines required deletion categories and coverage while defaulting to blocked', () => {
    const plan = buildPolicyCompatibilityDeletionGates();

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_STATUS_IDS.BLOCKED_BY_UNCONVERTED_POLICIES);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.validation.ok).toBe(true);
    expect(plan.categories.map(category => category.categoryId)).toEqual([
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CLIENT_BRIDGE_UI,
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.LEGACY_SERIALIZER_DESERIALIZER,
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.CUSTOM_SIGNAL_MUTATION_HELPERS,
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.PRESET_AS_POLICY_RUNTIME,
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.OLD_PREVIEW_REPLAY_DIAGNOSTICS,
      POLICY_COMPATIBILITY_DELETION_CATEGORY_IDS.STALE_COMPATIBILITY_TESTS,
    ]);
    expect(plan.coverageRequirements.map(requirement => requirement.coverageId)).toEqual(
      Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS)
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
    const plan = buildPolicyCompatibilityDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.COMPATIBILITY_UNTIL_CONVERTED,
      unconvertedPolicyCount: 2,
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_STATUS_IDS.BLOCKED_BY_UNCONVERTED_POLICIES);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'unconverted_policies_remaining',
        count: 2,
      }),
    ]));
  });

  test('requires an explicit support stance after all policies are converted', () => {
    const plan = buildPolicyCompatibilityDeletionGates({
      coverage: buildCompleteCoverage(),
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_STATUS_IDS.BLOCKED_BY_SUPPORT_STANCE);
    expect(plan.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockerId: 'support_stance_not_explicit',
      }),
    ]));
  });

  test('requires all replacement coverage before deletion readiness', () => {
    const plan = buildPolicyCompatibilityDeletionGates({
      coverage: {
        [POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS.NATIVE_READ_WRITE_TESTS]: true,
      },
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_STATUS_IDS.BLOCKED_BY_MISSING_COVERAGE);
    expect(plan.readyToDelete).toBe(false);
    expect(plan.blockers.filter(blocker => blocker.blockerId === 'missing_coverage'))
      .toHaveLength(Object.values(POLICY_COMPATIBILITY_DELETION_COVERAGE_IDS).length - 1);
  });

  test('marks replaced code ready for deletion only when gates, coverage, and stance pass', () => {
    const plan = buildPolicyCompatibilityDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });

    expect(plan.statusId).toBe(POLICY_COMPATIBILITY_DELETION_STATUS_IDS.READY_TO_DELETE);
    expect(plan.readyToDelete).toBe(true);
    expect(plan.deletionPolicy).toEqual(expect.objectContaining({
      deleteReplacedCode: true,
      hideOrArchiveReplacedCode: false,
      allowPermanentDualModel: false,
    }));
    expect(plan.nextStep).toEqual(expect.objectContaining({
      stepId: 'backup_restore_post_upgrade_safety',
      label: 'Backup, Restore, And Post-Upgrade Safety',
    }));
    expect(plan.nextPhase).toBeUndefined();
  });

  test('rejects weakened deletion plans that hide code or perform side effects', () => {
    const plan = buildPolicyCompatibilityDeletionGates({
      coverage: buildCompleteCoverage(),
      supportStanceId:
        POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.UNSUPPORTED_AFTER_WINDOW,
      unconvertedPolicyCount: 0,
    });
    const validation = validatePolicyCompatibilityDeletionGates({
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
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.MISSING_DELETION_CATEGORY,
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.MISSING_COVERAGE_REQUIREMENT,
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.MISSING_COMPATIBILITY_INVENTORY,
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.PRESERVE_REPLACED_CODE_PERMANENTLY,
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.SIDE_EFFECT_PERFORMED,
      POLICY_COMPATIBILITY_DELETION_RISK_IDS.MISSING_REASON,
    ]));
  });

  test('summarizes deletion readiness for the compatibility audit chain', () => {
    const audit = buildPolicyCompatibilityDeletionGatesAudit(
      buildPolicyCompatibilityDeletionGates({
        coverage: buildCompleteCoverage(),
        supportStanceId:
          POLICY_COMPATIBILITY_DELETION_SUPPORT_STANCE_IDS.SUPPORTED_TIME_BOUND,
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
      nextStep: expect.objectContaining({
        stepId: 'backup_restore_post_upgrade_safety',
      }),
    }));
    expect(audit.nextPhase).toBeUndefined();
  });
});
