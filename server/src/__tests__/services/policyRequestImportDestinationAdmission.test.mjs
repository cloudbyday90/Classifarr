/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS,
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS,
  POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS,
  buildPolicyRequestImportDestinationAdmission,
  buildPolicyRequestImportDestinationAdmissionAudit,
} from '../../services/policyRequestImportDestinationAdmission.mjs';
import {
  buildPolicyRuntimeQueueAutomationDecision,
} from '../../services/policyRuntimeQueueAutomationDecision.mjs';
import {
  buildPolicyRuntimeQueueEvidenceAdmission,
} from '../../services/policyRuntimeQueueEvidenceAdmission.mjs';
import {
  buildPolicyRuntimeQueueQuestionReduction,
} from '../../services/policyRuntimeQueueQuestionReduction.mjs';
import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
} from '../../services/policyRequestTimeLearning.mjs';
import {
  buildPolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';

function task(overrides = {}) {
  return {
    id: 41,
    source: 'webhook',
    task_type: 'classification',
    attempts: 0,
    ...overrides,
  };
}

function classification(overrides = {}) {
  return {
    classification_id: 87,
    destination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
    },
    routingOutcome: {
      shouldRoute: true,
      reason: 'policy_auto',
      routeResult: {
        attempted: true,
        routed: true,
        reason: 'routed',
      },
    },
    ...overrides,
  };
}

function queueQuestionReduction(overrides = {}) {
  const queueTask = task(overrides.task);
  const evidenceAdmission = buildPolicyRuntimeQueueEvidenceAdmission({
    task: queueTask,
    runtimeEvidenceInput: {
      libraryProfile: {
        identityCandidates: [
          { label: 'Animated Movies', count: 8, confidence: 0.9, trusted: true },
        ],
      },
      operatorIntent: {
        belongsHere: [{ key: 'genre:animated', label: 'Animated Movies' }],
        routingTargets: ['Radarr Animated Movies'],
      },
      routingOutcomes: [{ label: 'Radarr route mapped', routed: true }],
      profileFreshness: {
        key: 'profile',
        label: 'Profile is current',
        updatedAt: '2026-07-30T00:00:00.000Z',
        stale: false,
      },
    },
  });
  const automationDecision = buildPolicyRuntimeQueueAutomationDecision({
    evidenceAdmission,
    routing: { mapped: true, targetName: 'Radarr Animated Movies' },
  });

  return buildPolicyRuntimeQueueQuestionReduction({
    queueAutomationDecision: automationDecision,
  });
}

describe('policyRequestImportDestinationAdmission', () => {
  test('records successful request routing from queue-bound proof without inferring a requester choice', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
      queueQuestionReduction: queueQuestionReduction(),
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.OUTCOME_ONLY,
      event: expect.objectContaining({
        eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
        sourceEventId: 'classification:87',
        finalDestination: {
          libraryId: 6,
          libraryName: 'Animated Movies',
        },
      }),
      finalOutcome: expect.objectContaining({
        status: 'routed',
        destinationLibraryId: 6,
      }),
      learningIntake: {
        version: 'policy.learning_intake.v1',
        sourceId: 'arr_routing_outcome',
        sourceEventId: 'classification:87',
        answerOutcomeId: 'resolve_current_item',
      },
      learning: {
        decisionId: 'outcome_only',
        canWriteLearning: false,
        profileRefreshQueued: false,
      },
      questionReduction: expect.objectContaining({
        statusId: 'valid',
      }),
    }));
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.ROUTE_SUCCEEDED_RECORDED
    );
    expect(result.requestTimeDecision).toEqual({
      validationOk: true,
      dispositionId: 'outcome_only',
    });
    expect(result.audit.ok).toBe(true);
    expect(buildPolicyRequestImportDestinationAdmissionAudit(result).ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain('requestDestinationChoice');
  });

  test('records missing Arr mapping as a failed route without positive destination evidence', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task({ source: 'manual' }),
      classification: classification({
        routingOutcome: {
          shouldRoute: true,
          reason: 'policy_auto',
          routeResult: {
            attempted: false,
            routed: false,
            reason: 'no_mapping',
          },
        },
      }),
    });

    expect(result.event).toEqual(expect.objectContaining({
      eventTypeId: POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
      routeResult: expect.objectContaining({
        attempted: true,
        succeeded: false,
        missingMapping: true,
        reasonCode: 'missing_mapping',
      }),
    }));
    expect(result.finalOutcome).toEqual(expect.objectContaining({
      status: 'route_failed_missing_mapping',
      route: expect.objectContaining({
        attempted: true,
        succeeded: false,
        missingMapping: true,
      }),
    }));
    expect(result.learningIntake).toEqual({
      version: 'policy.learning_intake.v1',
      sourceId: 'arr_routing_outcome',
      sourceEventId: 'classification:87',
      answerOutcomeId: 'do_not_learn',
    });
    expect(result.learning).toEqual(expect.objectContaining({
      canWriteLearning: false,
      profileRefreshQueued: false,
    }));
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_MAPPING_RECORDED,
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_QUESTION_REDUCTION_PROOF,
    ]));
    expect(result.audit.ok).toBe(true);
  });

  test('admits matching queue question-reduction proof only through the request-time bridge', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
      queueQuestionReduction: queueQuestionReduction(),
    });

    expect(result.questionReduction).toEqual({
      statusId: 'valid',
      evidenceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.requestTimeDecision).toEqual({
      validationOk: true,
      dispositionId: 'outcome_only',
    });
    expect(result.learning).toEqual(expect.objectContaining({
      canWriteLearning: false,
      profileRefreshQueued: false,
    }));
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.VALID_QUESTION_REDUCTION_PROOF
    );
    expect(result.audit.ok).toBe(true);
  });

  test('keeps a cross-attempt queue proof outcome-only', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task({ attempts: 1 }),
      classification: classification(),
      queueQuestionReduction: queueQuestionReduction(),
    });

    expect(result.questionReduction).toEqual({
      statusId: 'invalid',
      evidenceFingerprint: null,
    });
    expect(result.requestTimeDecision).toBeNull();
    expect(result.learning).toEqual(expect.objectContaining({
      canWriteLearning: false,
      profileRefreshQueued: false,
    }));
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.INVALID_QUESTION_REDUCTION_PROOF
    );
    expect(result.audit.ok).toBe(true);
  });

  test('ignores a retired direct proof property when queue-bound proof is valid', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
      questionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
      queueQuestionReduction: queueQuestionReduction(),
    });

    expect(result.questionReduction).toEqual(expect.objectContaining({ statusId: 'valid' }));
    expect(result.requestTimeDecision).toEqual({
      validationOk: true,
      dispositionId: 'outcome_only',
    });
    expect(result.learning.canWriteLearning).toBe(false);
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.VALID_QUESTION_REDUCTION_PROOF
    );
    expect(result.audit.ok).toBe(true);
  });

  test('does not admit a retired direct proof property without queue-bound proof', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
      questionReductionPlan: { version: 'policy.runtime_question_reduction.v1' },
    });

    expect(result.questionReduction).toEqual({
      statusId: 'missing',
      evidenceFingerprint: null,
    });
    expect(result.requestTimeDecision).toBeNull();
    expect(result.learning.canWriteLearning).toBe(false);
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS
        .MISSING_QUESTION_REDUCTION_PROOF
    );
    expect(result.audit.ok).toBe(true);
  });

  test('stays outcome-only when legacy classification has no native question-reduction proof', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task({
        payload: {
          title: 'Must not leave the adapter',
          requester: { email: 'operator@example.test' },
        },
      }),
      classification: classification({
        rawRequestTitle: 'Must not leave the adapter',
        requesterEmail: 'operator@example.test',
      }),
    });

    expect(result.questionReduction).toEqual({
      statusId: 'missing',
      evidenceFingerprint: null,
    });
    expect(result.requestTimeDecision).toBeNull();
    expect(result.learningIntake).toEqual({
      version: 'policy.learning_intake.v1',
      sourceId: 'arr_routing_outcome',
      sourceEventId: 'classification:87',
      answerOutcomeId: 'do_not_learn',
    });
    expect(result.learning.canWriteLearning).toBe(false);
    expect(result.reasonCodes).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_QUESTION_REDUCTION_PROOF
    );
    expect(JSON.stringify(result)).not.toContain('operator@example.test');
    expect(JSON.stringify(result)).not.toContain('Must not leave the adapter');
    expect(result.audit.ok).toBe(true);
  });

  test('flags an invalid fallback intake in the admission audit', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
    });
    const audit = buildPolicyRequestImportDestinationAdmissionAudit(result, {
      learningIntake: {},
    });

    expect(audit).toEqual(expect.objectContaining({ ok: false }));
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INVALID_LEARNING_INTAKE,
    );
  });

  test('rejects a final outcome that is detached from canonical fallback intake', () => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: task(),
      classification: classification(),
    });
    const detachedIntake = buildPolicyLearningIntakeEvent({
      sourceId: 'arr_routing_outcome',
      sourceEventId: 'classification:87',
      itemId: 87,
      answerOutcomeId: 'do_not_learn',
      question: { frameId: 'destination_fit', stale: false },
      answer: {
        label: 'Animated Movies',
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
        ambiguous: false,
      },
      finalOutcome: result.finalOutcome,
    });
    const audit = buildPolicyRequestImportDestinationAdmissionAudit(result, {
      learningIntake: detachedIntake,
    });

    expect(audit).toEqual(expect.objectContaining({ ok: false }));
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_AUDIT_RISK_IDS.INTAKE_OUTCOME_MISMATCH,
    );
  });

  test.each([
    ['a non-request task source', task({ source: 'media_server' }), classification(),
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.NON_REQUEST_IMPORT_SOURCE],
    ['a classification without a destination', task(), classification({ destination: {} }),
      POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.MISSING_FINAL_DESTINATION],
    ['an unfinished routing result', task(), classification({
      routingOutcome: {
        shouldRoute: false,
        reason: 'threshold_not_met',
      },
    }), POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_REASON_IDS.ROUTING_NOT_TERMINAL],
  ])('is not applicable for %s', (_, inputTask, inputClassification, reasonCode) => {
    const result = buildPolicyRequestImportDestinationAdmission({
      task: inputTask,
      classification: inputClassification,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_REQUEST_IMPORT_DESTINATION_ADMISSION_STATUS_IDS.NOT_APPLICABLE,
      reasonCodes: [reasonCode],
      event: null,
      finalOutcome: null,
      learning: null,
    }));
    expect(result.audit.ok).toBe(true);
  });
});
