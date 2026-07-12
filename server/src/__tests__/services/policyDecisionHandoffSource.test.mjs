import {
  POLICY_DECISION_HANDOFF_SOURCE_IDS,
  POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS,
  POLICY_DECISION_HANDOFF_SOURCE_VERSION,
  buildPolicyDecisionHandoffSource,
  getPolicyDecisionHandoffSource,
  listPolicyDecisionHandoffSources,
  validatePolicyDecisionHandoffAdmission,
  validatePolicyDecisionHandoffSource,
  validatePolicyDecisionHandoffSourceSummary,
} from '../../services/policyDecisionHandoffSource.mjs';

function buildRequestLearningResult(overrides = {}) {
  return {
    decisionSource: buildPolicyDecisionHandoffSource(
      POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING
    ),
    decision: {
      version: 'policy.learning_guard.v1',
      learning: {
        writesPerformed: false,
      },
      profileRefresh: {
        queue: false,
      },
    },
    ...overrides,
  };
}

function buildLibraryRebuildResult(overrides = {}) {
  return {
    decisionSource: buildPolicyDecisionHandoffSource(
      POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD
    ),
    decision: {
      version: 'policy.library_rebuild_readiness_summary.v1',
      learning: {
        writesPerformed: false,
      },
      profileRefresh: {
        queue: false,
      },
    },
    sideEffects: {
      learningWritten: false,
      routingWritten: false,
      policyStorageMutated: false,
    },
    ...overrides,
  };
}

describe('policyDecisionHandoffSource', () => {
  test('lists and constructs only the two approved durable source contracts', () => {
    expect(listPolicyDecisionHandoffSources()).toEqual([
      expect.objectContaining({
        sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
        decisionVersion: 'policy.learning_guard.v1',
      }),
      expect.objectContaining({
        sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
        decisionVersion: 'policy.library_rebuild_readiness_summary.v1',
      }),
    ]);
    expect(buildPolicyDecisionHandoffSource(
      POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING
    )).toEqual({
      version: POLICY_DECISION_HANDOFF_SOURCE_VERSION,
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
      decisionVersion: 'policy.learning_guard.v1',
    });
    expect(getPolicyDecisionHandoffSource('unapproved_source')).toBeNull();
    expect(() => buildPolicyDecisionHandoffSource('unapproved_source'))
      .toThrow('must be allowlisted');
  });

  test('admits valid request-time learning and library rebuild handoffs', () => {
    expect(validatePolicyDecisionHandoffSource({
      boundedDecisionResult: buildRequestLearningResult(),
    })).toEqual({
      version: `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.audit`,
      ok: true,
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
      decisionVersion: 'policy.learning_guard.v1',
      issueCount: 0,
      issues: [],
    });

    expect(validatePolicyDecisionHandoffSource({
      boundedDecisionResult: buildLibraryRebuildResult(),
    })).toEqual(expect.objectContaining({
      ok: true,
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
      decisionVersion: 'policy.library_rebuild_readiness_summary.v1',
    }));
  });

  test('rejects unknown source IDs, version drift, writes, and rebuild side effects', () => {
    const unknownSource = buildRequestLearningResult({
      decisionSource: {
        version: POLICY_DECISION_HANDOFF_SOURCE_VERSION,
        sourceId: 'unapproved_source',
        decisionVersion: 'unknown.v1',
      },
    });
    const unknownAudit = validatePolicyDecisionHandoffSource({
      boundedDecisionResult: unknownSource,
    });

    expect(unknownAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.UNSUPPORTED_SOURCE,
      }),
    ]));

    const noncanonicalSource = buildRequestLearningResult({
      decisionSource: {
        ...buildPolicyDecisionHandoffSource(
          POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING
        ),
        sourceId: ` ${POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING}`,
      },
    });

    expect(validatePolicyDecisionHandoffSource({
      boundedDecisionResult: noncanonicalSource,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.UNSUPPORTED_SOURCE,
      }),
    ]));

    const outdatedDescriptor = buildRequestLearningResult({
      decisionSource: {
        ...buildPolicyDecisionHandoffSource(
          POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING
        ),
        version: 'policy.decision_handoff_source.v0',
      },
    });

    expect(validatePolicyDecisionHandoffSource({
      boundedDecisionResult: outdatedDescriptor,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.INVALID_SOURCE_VERSION,
      }),
    ]));

    const unsafeRebuild = buildLibraryRebuildResult({
      decision: {
        version: 'policy.learning_guard.v1',
        learning: {
          writesPerformed: true,
        },
        profileRefresh: {
          queue: true,
        },
      },
      sideEffects: {
        learningWritten: false,
        routingWritten: false,
      },
    });
    const unsafeAudit = validatePolicyDecisionHandoffSource({
      boundedDecisionResult: unsafeRebuild,
    });

    expect(unsafeAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.DECISION_VERSION_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.DECISION_WRITE_PERFORMED,
      }),
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.REBUILD_PROFILE_REFRESH_QUEUED,
      }),
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.REBUILD_SIDE_EFFECT_STATE_INVALID,
      }),
    ]));
  });

  test('admits matching sanitized source summaries and rejects missing or mismatched provenance', () => {
    const admission = validatePolicyDecisionHandoffSource({
      boundedDecisionResult: buildRequestLearningResult(),
    });
    const summary = {
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
      decisionVersion: 'policy.learning_guard.v1',
      admitted: true,
    };

    expect(validatePolicyDecisionHandoffSourceSummary(summary)).toEqual(expect.objectContaining({
      ok: true,
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
    }));
    expect(validatePolicyDecisionHandoffAdmission({
      decisionSourceAdmission: admission,
      readinessBoundaryDecisionSource: summary,
      embeddedReadinessDecisionSource: summary,
    })).toEqual(expect.objectContaining({
      ok: true,
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
    }));

    const mismatchedAdmission = validatePolicyDecisionHandoffAdmission({
      decisionSourceAdmission: admission,
      readinessBoundaryDecisionSource: summary,
      embeddedReadinessDecisionSource: {
        sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
        decisionVersion: 'policy.library_rebuild_readiness_summary.v1',
        admitted: true,
      },
    });

    expect(mismatchedAdmission).toEqual(expect.objectContaining({
      ok: false,
      sourceId: null,
    }));
    expect(mismatchedAdmission.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.SOURCE_SUMMARY_MISMATCH,
      }),
    ]));
    expect(validatePolicyDecisionHandoffSourceSummary({
      sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
      decisionVersion: 'policy.learning_guard.v1',
      admitted: false,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.SOURCE_SUMMARY_NOT_ADMITTED,
      }),
    ]));
  });
});
