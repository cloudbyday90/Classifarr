import {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
  buildPolicyActiveIntentIntegrityReport,
} from '../../services/policyActiveIntentIntegrity.mjs';
import {
  POLICY_INTENT_MIGRATION_AUTOMATION_REASON_IDS,
  POLICY_INTENT_MIGRATION_AUTOMATION_STATUS_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS,
  POLICY_INTENT_MIGRATION_CANDIDATE_REPORT_VERSION,
  POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS,
  POLICY_INTENT_MIGRATION_LEGACY_CONFIGURATION_STATUS_IDS,
  buildPolicyIntentMigrationCandidateReport,
  buildPolicyIntentMigrationCandidateReportAudit,
  validatePolicyIntentMigrationCandidateReport,
} from '../../services/policyIntentMigrationCandidateReport.mjs';

function preset(overrides = {}) {
  return {
    id: 7,
    key: 'family',
    name: 'Family',
    source: 'builtin',
    weight: 1,
    signals: {
      genres: { require_any: ['Family'] },
    },
    custom_signals: null,
    ...overrides,
  };
}

function policy(overrides = {}) {
  return {
    id: 14,
    library_id: 4,
    library_name: 'Movies',
    name: 'Movies Policy',
    auto_classify_threshold: 85,
    prompt_threshold: 60,
    require_ai_validation: true,
    trust_patterns: true,
    trust_rag: true,
    trust_history: true,
    combination_mode: 'best_match',
    presets: [preset()],
    routingTarget: {
      arr_type: 'radarr',
      arr_config_id: 1,
      arr_root_folder_path: '/media/Movies',
    },
    profileFreshness: {
      state: 'fresh',
      stale: false,
    },
    ...overrides,
  };
}

function candidateByPolicyId(report, policyId) {
  return report.candidates.find(candidate => candidate.policyId === policyId);
}

describe('policyIntentMigrationCandidateReport', () => {
  test('reports ready-to-convert policies without mutating storage', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
    });

    expect(report.mode).toBe('dry_run');
    expect(report.version).toBe(POLICY_INTENT_MIGRATION_CANDIDATE_REPORT_VERSION);
    expect(report.validation.ok).toBe(true);
    expect(report.sideEffects).toEqual({
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    });
    expect(report.summary).toEqual(expect.objectContaining({
      totalPolicyCount: 1,
      convertibleCount: 1,
      reviewRequiredCount: 0,
    }));
    expect(report.candidates[0]).toEqual(expect.objectContaining({
      policyId: 14,
      policyName: 'Movies Policy',
      statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT,
      canConvert: true,
      requiresOperatorReview: false,
      rawLegacyJson: undefined,
    }));
    expect(report.candidates[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.READY_TO_CONVERT,
      }),
      expect.objectContaining({
        reasonId: POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.RAW_LEGACY_JSON_SUPPRESSED,
      }),
    ]));
  });

  test('classifies conversion eligibility separately from automation readiness', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [
        policy({ id: 1, name: 'Ready' }),
        policy({
          id: 2,
          name: 'Review',
          intentContract: {
            schema_version: 1,
            source: 'legacy_presets',
            inference_state: 'inferred',
            purpose: [{
              intent_role: 'purpose',
              collection: 'purpose',
              signal_type: 'genres',
              operator: 'require_any',
              values: { require_any: ['Family'] },
              inference_state: 'inferred',
            }],
            hard_limits: [],
            helpful_hints: [],
            avoid: [],
            template_links: [],
            warnings: [],
            unsupported_signals: [],
            validation: {
              valid: true,
              error_count: 0,
              warning_count: 1,
              errors: [],
              warnings: [{ code: 'operator_review_recommended' }],
            },
          },
        }),
        policy({
          id: 3,
          name: 'Partial',
          presets: [preset({
            signals: {
              genres: { require_any: ['Comedy'], unsupported_operator: ['x'] },
            },
          })],
        }),
        policy({
          id: 4,
          name: 'Unsupported',
          presets: [preset({
            signals: {
              experimental_signal: { require_any: ['unknown'] },
            },
          })],
        }),
        policy({
          id: 5,
          name: 'No Route',
          routingTarget: {},
        }),
        policy({
          id: 6,
          name: 'Stale Profile',
          profileFreshness: {
            state: 'stale',
            stale: true,
          },
        }),
        policy({
          id: 7,
          name: 'Validation Blocked',
          intentContract: {
            schema_version: 1,
            source: 'legacy_presets',
            inference_state: 'inferred',
            purpose: [],
            hard_limits: [],
            helpful_hints: [],
            avoid: [],
            template_links: [],
            warnings: [],
            unsupported_signals: [],
            validation: {
              valid: false,
              error_count: 1,
              warning_count: 0,
              errors: [{ code: 'bad_contract' }],
              warnings: [],
            },
          },
        }),
      ],
    });

    expect(report.validation.ok).toBe(true);
    expect(candidateByPolicyId(report, 1).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT);
    expect(candidateByPolicyId(report, 2).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.NEEDS_OPERATOR_REVIEW);
    expect(candidateByPolicyId(report, 3).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.PARTIAL_LEGACY_INFERENCE);
    expect(candidateByPolicyId(report, 4).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.UNSUPPORTED_LEGACY_SHAPE);
    expect(candidateByPolicyId(report, 5).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT);
    expect(candidateByPolicyId(report, 5).automationReadiness).toEqual(expect.objectContaining({
      statusId: POLICY_INTENT_MIGRATION_AUTOMATION_STATUS_IDS.NEEDS_ROUTING_TARGET,
      canAutomate: false,
      blockerIds: [POLICY_INTENT_MIGRATION_AUTOMATION_REASON_IDS.ROUTING_TARGET_MISSING],
    }));
    expect(candidateByPolicyId(report, 6).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT);
    expect(candidateByPolicyId(report, 6).automationReadiness).toEqual(expect.objectContaining({
      statusId: POLICY_INTENT_MIGRATION_AUTOMATION_STATUS_IDS.NEEDS_PROFILE_REFRESH,
      canAutomate: false,
      blockerIds: [POLICY_INTENT_MIGRATION_AUTOMATION_REASON_IDS.PROFILE_REFRESH_REQUIRED],
    }));
    expect(candidateByPolicyId(report, 7).statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_SERVER_CONTRACT_VALIDATION);
  });

  test('defers empty legacy policy configuration for automatic library-profile establishment', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy({
        id: 81,
        presets: [],
        intentContract: {
          schema_version: 1,
          source: 'empty',
          inference_state: 'empty',
          purpose: [],
          hard_limits: [],
          helpful_hints: [],
          avoid: [],
          template_links: [],
          warnings: [],
          unsupported_signals: [],
          validation: {
            valid: true,
            error_count: 0,
            warning_count: 0,
            errors: [],
            warnings: [],
          },
        },
      })],
    });

    expect(report.candidates[0]).toEqual(expect.objectContaining({
      statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.AWAITING_LIBRARY_PROFILE,
      canConvert: false,
      legacyConfiguration: {
        statusId: POLICY_INTENT_MIGRATION_LEGACY_CONFIGURATION_STATUS_IDS.EMPTY,
        attachedPresetCount: 0,
      },
    }));
    expect(report.candidates[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.LIBRARY_PROFILE_INITIALIZATION_DEFERRED,
        message: expect.stringContaining('retry automatically'),
      }),
    ]));
    expect(report.validation.ok).toBe(true);
  });

  test('keeps configured legacy policies without a materializable purpose distinct from initial establishment', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy({
        id: 82,
        presets: [preset()],
        intentContract: {
          schema_version: 1,
          source: 'legacy_presets',
          inference_state: 'inferred',
          purpose: [],
          hard_limits: [],
          helpful_hints: [],
          avoid: [],
          template_links: [],
          warnings: [],
          unsupported_signals: [],
          validation: {
            valid: true,
            error_count: 0,
            warning_count: 0,
            errors: [],
            warnings: [],
          },
        },
      })],
    });

    expect(report.candidates[0]).toEqual(expect.objectContaining({
      statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.NO_CONVERTIBLE_INTENT,
      canConvert: false,
      legacyConfiguration: {
        statusId: POLICY_INTENT_MIGRATION_LEGACY_CONFIGURATION_STATUS_IDS.PRESENT,
        attachedPresetCount: 1,
      },
    }));
    expect(report.candidates[0].reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.NO_CONVERTIBLE_INTENT,
      }),
    ]));
  });

  test('rejects an initial-establishment candidate that does not wait for profile evidence', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy({ id: 83, presets: [] })],
    });
    const downgraded = {
      ...report,
      candidates: report.candidates.map(candidate => ({
        ...candidate,
        statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.NO_CONVERTIBLE_INTENT,
        reasons: candidate.reasons,
      })),
    };

    const validation = validatePolicyIntentMigrationCandidateReport(downgraded);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.INITIALIZATION_STATUS_MISMATCH,
      }),
    ]));
  });

  test('blocks ambiguous active authority before calculating conversion readiness', () => {
    const activeIntentIntegrityReport = buildPolicyActiveIntentIntegrityReport({
      activeIntents: [
        {
          id: 41,
          policyId: 14,
          intentVersion: 1,
          validationStatus: 'valid',
          updatedAt: '2026-07-01T12:00:00.000Z',
        },
        {
          id: 42,
          policyId: 14,
          intentVersion: 2,
          validationStatus: 'warning',
          updatedAt: '2026-07-02T12:00:00.000Z',
        },
      ],
    });
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
      activeIntentIntegrityReport,
    });
    const candidate = candidateByPolicyId(report, 14);

    expect(report.validation.ok).toBe(true);
    expect(candidate).toEqual(expect.objectContaining({
      statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY,
      canConvert: false,
      requiresOperatorReview: true,
      authorityEligibility: {
        stateId: 'active_intent_authority_conflict',
        integrityStatusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE,
        activeIntentCount: 2,
      },
    }));
    expect(candidate.authorityEligibility).not.toHaveProperty('activeIntentIds');
    expect(candidate.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonId: POLICY_INTENT_MIGRATION_CANDIDATE_REASON_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT,
        severity: 'blocker',
      }),
    ]));
  });

  test('requires operator resolution for invalid-only duplicate authority', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
      activeIntentIntegrityReport: buildPolicyActiveIntentIntegrityReport({
        activeIntents: [
          { id: 51, policyId: 14, intentVersion: 1, validationStatus: 'invalid' },
          { id: 52, policyId: 14, intentVersion: 2, validationStatus: 'rejected' },
        ],
      }),
    });
    const candidate = candidateByPolicyId(report, 14);

    expect(report.validation.ok).toBe(true);
    expect(candidate.statusId)
      .toBe(POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.BLOCKED_BY_ACTIVE_INTENT_AUTHORITY);
    expect(candidate.authorityEligibility).toEqual(expect.objectContaining({
      integrityStatusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE,
    }));
    expect(candidate.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        message: expect.stringContaining('requires operator resolution'),
      }),
    ]));
  });

  test('keeps clean candidate shape unchanged when the integrity report has no affected policy', () => {
    const baseline = buildPolicyIntentMigrationCandidateReport({ policies: [policy()] });
    const withCleanAuthority = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
      activeIntentIntegrityReport: buildPolicyActiveIntentIntegrityReport({
        activeIntents: [
          { id: 61, policyId: 99, intentVersion: 1, validationStatus: 'valid' },
          { id: 62, policyId: 99, intentVersion: 2, validationStatus: 'valid' },
        ],
      }),
    });

    expect(withCleanAuthority.validation.ok).toBe(true);
    expect(withCleanAuthority.candidates[0]).toEqual(baseline.candidates[0]);
    expect(withCleanAuthority.candidates[0]).not.toHaveProperty('authorityEligibility');
  });

  test('includes explainable affected policy details and deletion impact estimates', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
    });
    const candidate = report.candidates[0];

    expect(candidate).toEqual(expect.objectContaining({
      policyId: 14,
      policyName: 'Movies Policy',
      libraryId: 4,
      libraryName: 'Movies',
    }));
    expect(candidate.deletionImpact).toEqual(expect.arrayContaining([
      expect.objectContaining({
        impactId: 'policy_presets',
      }),
      expect.objectContaining({
        impactId: 'custom_signals',
      }),
      expect.objectContaining({
        impactId: 'compatibility_bridge_read',
        eligibleAfterConversion: false,
      }),
    ]));
    expect(candidate.deletionImpact).toHaveLength(4);
  });

  test('bounds output and suppresses raw legacy JSON unless maintainer mode explicitly requests it', () => {
    const policies = [
      policy({ id: 1, name: 'One', legacyJson: { customSignals: { secret: true } } }),
      policy({ id: 2, name: 'Two', legacyJson: { customSignals: { secret: true } } }),
      policy({ id: 3, name: 'Three', legacyJson: { customSignals: { secret: true } } }),
    ];
    const operatorReport = buildPolicyIntentMigrationCandidateReport({
      policies,
      maxPolicies: 2,
      includeRawLegacyJson: true,
    });
    const maintainerReport = buildPolicyIntentMigrationCandidateReport({
      policies: [policies[0]],
      maintainerMode: true,
      includeRawLegacyJson: true,
    });

    expect(operatorReport.bounded).toEqual(expect.objectContaining({
      truncated: true,
      sourcePolicyCount: 3,
      emittedPolicyCount: 2,
    }));
    operatorReport.candidates.forEach(candidate => {
      expect(candidate.rawLegacyJson).toBeUndefined();
    });
    expect(operatorReport.rawLegacyJsonIncluded).toBe(false);
    expect(maintainerReport.rawLegacyJsonIncluded).toBe(true);
    expect(maintainerReport.candidates[0].rawLegacyJson).toEqual({
      customSignals: { secret: true },
    });
  });

  test('rejects hidden conversion blockers or malformed automation readiness', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [
        policy({
          id: 4,
          name: 'Unsupported',
          presets: [preset({
            signals: {
              experimental_signal: { require_any: ['unknown'] },
            },
          })],
        }),
        policy({
          id: 5,
          name: 'No Route',
          routingTarget: {},
        }),
        policy({
          id: 6,
          name: 'Stale Profile',
          profileFreshness: {
            state: 'stale',
            stale: true,
          },
        }),
        policy({
          id: 7,
          name: 'Validation Blocked',
          intentContract: {
            validation: {
              valid: false,
              error_count: 1,
              warning_count: 0,
            },
            unsupported_signals: [],
          },
        }),
      ],
    });
    const weakened = {
      ...report,
      candidates: report.candidates.map(candidate => ({
        ...candidate,
        statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.NEEDS_OPERATOR_REVIEW,
        automationReadiness: {
          ...candidate.automationReadiness,
          canAutomate: true,
          blockerIds: [],
        },
      })),
    };
    const validation = validatePolicyIntentMigrationCandidateReport(weakened);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.UNSUPPORTED_POLICY_NOT_EXPLICIT,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.AUTOMATION_ROUTING_NOT_EXPLICIT,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.AUTOMATION_PROFILE_NOT_EXPLICIT,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.AUTOMATION_READY_STATE_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.SERVER_VALIDATION_FAILURE_NOT_BLOCKED,
      }),
    ]));
  });

  test('rejects an active-authority conflict that is downgraded to ready', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
      activeIntentIntegrityReport: buildPolicyActiveIntentIntegrityReport({
        activeIntents: [
          { id: 71, policyId: 14, intentVersion: 1, validationStatus: 'valid' },
          { id: 72, policyId: 14, intentVersion: 2, validationStatus: 'valid' },
        ],
      }),
    });
    const downgraded = {
      ...report,
      candidates: report.candidates.map(candidate => ({
        ...candidate,
        statusId: POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT,
        canConvert: true,
        requiresOperatorReview: false,
      })),
    };
    const validation = validatePolicyIntentMigrationCandidateReport(downgraded);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.ACTIVE_AUTHORITY_CONFLICT_NOT_BLOCKED,
      }),
    ]));
  });

  test('rejects reports that mutate storage, omit reasons, omit deletion impact, or leak raw legacy JSON', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
    });
    const mutated = {
      ...report,
      rawLegacyJsonIncluded: false,
      sideEffects: {
        ...report.sideEffects,
        nativeRowsInserted: true,
      },
      candidates: report.candidates.map(candidate => ({
        ...candidate,
        reasons: [],
        deletionImpact: [],
        rawLegacyJson: { customSignals: { leaked: true } },
      })),
    };
    const validation = validatePolicyIntentMigrationCandidateReport(mutated);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.REPORT_MUTATED_STORAGE,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_REASON,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.MISSING_DELETION_IMPACT,
      }),
      expect.objectContaining({
        riskId: POLICY_INTENT_MIGRATION_CANDIDATE_AUDIT_RISK_IDS.RAW_LEGACY_JSON_EXPOSED,
      }),
    ]));
  });

  test('audits cleanly and points to the explicit conversion workflow', () => {
    const report = buildPolicyIntentMigrationCandidateReport({
      policies: [policy()],
    });
    const audit = buildPolicyIntentMigrationCandidateReportAudit(report);

    expect(validatePolicyIntentMigrationCandidateReport(report).ok).toBe(true);
    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      issueCount: 0,
      emittedPolicyCount: 1,
      nextStep: expect.objectContaining({
        stepId: 'explicit_conversion_workflow',
      }),
    }));
    expect(audit.nextPhase).toBeUndefined();
  });
});
