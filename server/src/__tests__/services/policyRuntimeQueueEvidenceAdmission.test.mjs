import {
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS,
  buildPolicyRuntimeQueueEvidenceAdmission,
  buildPolicyRuntimeQueueEvidenceAdmissionAudit,
} from '../../services/policyRuntimeQueueEvidenceAdmission.mjs';

function buildQueueTask(overrides = {}) {
  return {
    id: 'queue-task-42',
    task_type: 'classification',
    attempts: 1,
    payload: {
      title: 'Raw task title must remain transport data',
      providerPayload: {
        token: 'must-not-be-exposed',
      },
    },
    ...overrides,
  };
}

function buildRuntimeEvidenceInput(overrides = {}) {
  return {
    libraryProfile: {
      identityCandidates: [{ label: 'Anime', count: 8, trusted: true }],
    },
    operatorIntent: {
      belongsHere: [{ key: 'genre:anime', label: 'Anime' }],
    },
    profileFreshness: {
      key: 'profile',
      label: 'Profile is current',
      updatedAt: '2026-07-30T00:00:00.000Z',
      stale: false,
    },
    ...overrides,
  };
}

describe('policyRuntimeQueueEvidenceAdmission', () => {
  test('builds fresh bounded runtime evidence for a classification task without exposing queue payload', () => {
    const result = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY,
      queueContext: expect.objectContaining({
        taskType: 'classification',
        attempt: 1,
        taskFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      evidence: expect.objectContaining({
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        executionFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(result.audit.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('queue-task-42');
    expect(JSON.stringify(result)).not.toContain('Raw task title must remain transport data');
    expect(JSON.stringify(result)).not.toContain('must-not-be-exposed');
  });

  test('rebuilds evidence and execution fingerprints when current evidence changes', () => {
    const first = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput(),
    });
    const second = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput({
        profileFreshness: {
          key: 'profile',
          label: 'Profile is stale',
          updatedAt: '2026-07-30T00:05:00.000Z',
          stale: true,
        },
      }),
    });

    expect(second.evidence.fingerprint).not.toBe(first.evidence.fingerprint);
    expect(second.evidence.executionFingerprint).not.toBe(first.evidence.executionFingerprint);
  });

  test('blocks cached projections and unrecognized evidence fields', () => {
    const cached = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput({
        evidenceProjection: { fingerprint: 'cached' },
      }),
    });
    const unsupported = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput({
        queuePayload: { title: 'must not become evidence' },
      }),
    });
    const nonObject = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: ['not-an-evidence-object'],
    });

    expect(cached).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_CACHED_PROJECTION,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.CACHED_EVIDENCE_PROJECTION,
      evidence: null,
    }));
    expect(cached.audit.ok).toBe(true);
    expect(unsupported).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS
        .BLOCKED_UNSUPPORTED_EVIDENCE_INPUT,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSUPPORTED_EVIDENCE_INPUT,
      evidence: null,
    }));
    expect(unsupported.audit.ok).toBe(true);
    expect(nonObject).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS
        .BLOCKED_UNSUPPORTED_EVIDENCE_INPUT,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSUPPORTED_EVIDENCE_INPUT,
      evidence: null,
    }));
    expect(nonObject.audit.ok).toBe(true);
  });

  test('blocks non-classification queue work before it can enter the evidence boundary', () => {
    const result = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask({ task_type: 'metadata_enrichment' }),
      runtimeEvidenceInput: buildRuntimeEvidenceInput(),
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_INVALID_QUEUE_TASK,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSUPPORTED_QUEUE_TASK_TYPE,
      evidence: null,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('rejects altered execution fingerprints and raw queue payload exposure', () => {
    const result = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput(),
    });
    const invalid = {
      ...result,
      queueContext: {
        ...result.queueContext,
        payload: { title: 'do not expose' },
      },
      evidence: {
        ...result.evidence,
        executionFingerprint: 'altered',
      },
    };

    const audit = buildPolicyRuntimeQueueEvidenceAdmissionAudit(invalid);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_EXECUTION_FINGERPRINT,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.RAW_QUEUE_PAYLOAD_EXPOSED,
      }),
    ]));
  });

  test('rejects an evidence fingerprint that does not match its fresh projection', () => {
    const result = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput(),
    });
    const audit = buildPolicyRuntimeQueueEvidenceAdmissionAudit({
      ...result,
      evidence: {
        ...result.evidence,
        fingerprint: 'b'.repeat(64),
        executionFingerprint: 'c'.repeat(64),
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.READY_WITHOUT_VALID_EVIDENCE,
      }),
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_EXECUTION_FINGERPRINT,
      }),
    ]));
  });

  test('rejects blocked results that expose a usable evidence fingerprint', () => {
    const blocked = buildPolicyRuntimeQueueEvidenceAdmission({
      task: buildQueueTask(),
      runtimeEvidenceInput: buildRuntimeEvidenceInput({
        evidenceProjection: { fingerprint: 'cached' },
      }),
    });
    const audit = buildPolicyRuntimeQueueEvidenceAdmissionAudit({
      ...blocked,
      evidence: {
        fingerprint: 'a'.repeat(64),
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.BLOCKED_WITH_EVIDENCE,
      }),
    ]));
  });
});
