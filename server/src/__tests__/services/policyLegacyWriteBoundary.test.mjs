import {
  POLICY_LEGACY_WRITE_OPERATION_IDS,
  POLICY_LEGACY_WRITE_RISK_IDS,
  POLICY_LEGACY_WRITE_STATUS_IDS,
  buildPolicyLegacyWriteBoundary,
  buildPolicyLegacyWriteBoundaryAudit,
  validatePolicyLegacyWriteBoundary,
} from '../../services/policyLegacyWriteBoundary.mjs';

function policy(overrides = {}) {
  return {
    id: 44,
    library_id: 6,
    name: 'Animated Movies Policy',
    native_intent_active: true,
    native_intent_version: 2,
    ...overrides,
  };
}

describe('policyLegacyWriteBoundary', () => {
  test('blocks legacy preset and custom-signal writes for converted policies', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      payload: {
        presets: [
          {
            preset_id: 7,
            weight: 1,
            customSignals: {
              genres: {
                require_any: ['Animation'],
              },
            },
          },
        ],
        preset_weight: 0.35,
        trust_rag: true,
      },
    });

    expect(boundary.validation.ok).toBe(true);
    expect(boundary.allowed).toBe(false);
    expect(boundary.statusId)
      .toBe(POLICY_LEGACY_WRITE_STATUS_IDS.CONVERTED_LEGACY_WRITE_BLOCKED);
    expect(boundary.detectedFields.legacyBehavior.map(field => field.field))
      .toEqual(expect.arrayContaining([
        'presets',
        'presets[0].customSignals',
        'preset_weight',
        'trust_rag',
      ]));
    expect(boundary.migrationBlockers).toHaveLength(1);
    expect(boundary.sideEffects).toEqual({
      routeWritePerformed: false,
      nativeRowsWritten: false,
      legacyRowsWritten: false,
      legacyRowsDeleted: false,
      draftSidecarPersisted: false,
    });
  });

  test('allows converted metadata-only policy edits', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      payload: {
        name: 'Animated Movies',
        description: 'Destination for animated movies',
        enabled: true,
      },
    });

    expect(boundary.validation.ok).toBe(true);
    expect(boundary.allowed).toBe(true);
    expect(boundary.statusId)
      .toBe(POLICY_LEGACY_WRITE_STATUS_IDS.CONVERTED_METADATA_WRITE_ALLOWED);
    expect(boundary.detectedFields.legacyBehavior).toHaveLength(0);
    expect(boundary.detectedFields.metadata.map(field => field.field))
      .toEqual(expect.arrayContaining(['name', 'description', 'enabled']));
  });

  test('keeps unconverted compatibility writes allowed with warning and removal checklist', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: policy({
        native_intent_active: false,
        native_intent_version: null,
      }),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.ATTACH_PRESET,
      payload: {
        preset_id: 11,
        weight: 0.8,
      },
    });

    expect(boundary.validation.ok).toBe(true);
    expect(boundary.allowed).toBe(true);
    expect(boundary.statusId)
      .toBe(POLICY_LEGACY_WRITE_STATUS_IDS.UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED);
    expect(boundary.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        warningId: 'compatibility_write_time_bounded',
      }),
    ]));
    expect(boundary.removalChecklist.map(item => item.itemId)).toEqual(expect.arrayContaining([
      'guard_policy_update_route_for_converted_policies',
      'guard_policy_preset_attach_route_for_converted_policies',
      'guard_auto_learning_custom_signal_writers_for_converted_policies',
      'route_native_intent_writes_to_native_storage',
    ]));
  });

  test('requires native write readiness before allowing converted native intent writes', () => {
    const blocked = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.NATIVE_INTENT_WRITE,
      payload: {
        policy_intent_contract: {
          source: 'native_intent',
        },
      },
      nativeWriteReady: false,
    });
    const allowed = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.NATIVE_INTENT_WRITE,
      payload: {
        policy_intent_contract: {
          source: 'native_intent',
        },
      },
      nativeWriteReady: true,
    });

    expect(blocked.validation.ok).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.statusId)
      .toBe(POLICY_LEGACY_WRITE_STATUS_IDS.NATIVE_WRITE_PATH_REQUIRED);
    expect(allowed.validation.ok).toBe(true);
    expect(allowed.allowed).toBe(true);
    expect(allowed.statusId).toBe(POLICY_LEGACY_WRITE_STATUS_IDS.NATIVE_WRITE_ALLOWED);
  });

  test('blocks legacy defaults for new policies once native default gates are ready', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: {},
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.CREATE_POLICY,
      nativeDefaultReady: true,
      payload: {
        name: 'Movies',
        library_id: 4,
        presets: [
          {
            preset_id: 7,
            weight: 1,
          },
        ],
      },
    });

    expect(boundary.validation.ok).toBe(true);
    expect(boundary.allowed).toBe(false);
    expect(boundary.statusId)
      .toBe(POLICY_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_NATIVE_DEFAULT_REQUIRED);
  });

  test('validation rejects weakened converted legacy allowance and missing shutdown checklist', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.RESET_POLICY,
      payload: {},
    });
    const weakened = {
      ...boundary,
      allowed: true,
      removalChecklist: [],
      warnings: [],
      sideEffects: {
        ...boundary.sideEffects,
        legacyRowsWritten: true,
      },
    };
    const riskIds = validatePolicyLegacyWriteBoundary(weakened)
      .issues
      .map(issue => issue.riskId);

    expect(riskIds).toEqual(expect.arrayContaining([
      POLICY_LEGACY_WRITE_RISK_IDS.CONVERTED_RESET_TO_LEGACY_ALLOWED,
      POLICY_LEGACY_WRITE_RISK_IDS.MISSING_REMOVAL_CHECKLIST,
      POLICY_LEGACY_WRITE_RISK_IDS.SIDE_EFFECT_PERFORMED,
    ]));
  });

  test('audits cleanly and points to deletion gates next', () => {
    const boundary = buildPolicyLegacyWriteBoundary({
      policy: policy(),
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      payload: {
        name: 'Animated Movies',
      },
    });
    const audit = buildPolicyLegacyWriteBoundaryAudit(boundary);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
      statusId: POLICY_LEGACY_WRITE_STATUS_IDS.CONVERTED_METADATA_WRITE_ALLOWED,
      allowed: true,
      convertedPolicy: true,
      legacyFieldCount: 0,
      nextStep: expect.objectContaining({
        stepId: 'legacy_code_deletion_gates',
      }),
    }));
    expect(audit.nextPhase).toBeUndefined();
  });
});
