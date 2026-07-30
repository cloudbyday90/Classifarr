/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_REQUEST_TIME_PROOF_MODE_IDS,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_AUDIT_VERSION,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS,
  buildPolicyRequestTimeTerminalRouteIntegrationAudit,
  listPolicyRequestTimeTerminalRouteCallers,
} from '../../services/policyRequestTimeTerminalRouteIntegrationAudit.mjs';

describe('policyRequestTimeTerminalRouteIntegrationAudit', () => {
  test('covers every current terminal routing caller with a guarded proof or outcome-only fallback', () => {
    const audit = buildPolicyRequestTimeTerminalRouteIntegrationAudit();

    expect(audit).toEqual(expect.objectContaining({
      version: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_AUDIT_VERSION,
      stepId: 'request_time_terminal_route_integration_audit',
      ok: true,
      callerCount: 2,
      coveredCallerCount: 2,
      queueQuestionReduction: {
        adapterPath: 'server/src/services/policyRequestTimeQueueQuestionReduction.mjs',
        producerPath: 'server/src/services/policyRuntimeQueueQuestionReductionProducer.mjs',
        statusId: 'active',
        activeCallerIds: [POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE],
      },
      sideEffects: {
        filesRead: true,
        filesWritten: false,
        storageChanged: false,
        routingChanged: false,
        learningWritten: false,
        profileRefreshQueued: false,
      },
    }));
    expect(audit.callers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
        proofModeIds: [
          POLICY_REQUEST_TIME_PROOF_MODE_IDS.QUEUE_QUESTION_REDUCTION,
          POLICY_REQUEST_TIME_PROOF_MODE_IDS.OUTCOME_ONLY,
        ],
        outcomeOnlyFallbackRequired: true,
        directLearningAllowed: false,
      }),
      expect.objectContaining({
        id: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.NATIVE_PENDING_ROUTE,
        proofModeIds: [POLICY_REQUEST_TIME_PROOF_MODE_IDS.OUTCOME_ONLY],
        outcomeOnlyFallbackRequired: true,
        directLearningAllowed: false,
      }),
    ]));
    expect(audit.issues).toEqual([]);
  });

  test('rejects missing, duplicate, and altered caller records', () => {
    const callers = listPolicyRequestTimeTerminalRouteCallers();
    const requestImportCaller = callers.find(caller =>
      caller.id === POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE
    );
    const missingCallerAudit = buildPolicyRequestTimeTerminalRouteIntegrationAudit({
      callers: callers.filter(caller => caller.id !== requestImportCaller.id),
      checkPathExists: false,
      readSourceFile: () => '',
    });
    const duplicateAndUnsafeAudit = buildPolicyRequestTimeTerminalRouteIntegrationAudit({
      callers: [
        ...callers,
        {
          ...requestImportCaller,
          directLearningAllowed: true,
        },
      ],
      checkPathExists: false,
      readSourceFile: () => '',
    });

    expect(missingCallerAudit.ok).toBe(false);
    expect(missingCallerAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_REQUIRED_CALLER,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
    ]));
    expect(duplicateAndUnsafeAudit.ok).toBe(false);
    expect(duplicateAndUnsafeAudit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.DUPLICATE_CALLER,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.CALLER_CONFIGURATION_MISMATCH,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.DIRECT_LEARNING_ALLOWED,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
    ]));
  });

  test('rejects a missing guarded handoff in caller source', () => {
    const audit = buildPolicyRequestTimeTerminalRouteIntegrationAudit({
      checkPathExists: false,
      readSourceFile: () => 'export const unrelated = true;',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_REQUIRED_SOURCE_FRAGMENT,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_REQUIRED_SOURCE_FRAGMENT,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.NATIVE_PENDING_ROUTE,
      }),
    ]));
  });

  test('rejects caller proof modes outside the server-owned vocabulary', () => {
    const callers = listPolicyRequestTimeTerminalRouteCallers();
    const audit = buildPolicyRequestTimeTerminalRouteIntegrationAudit({
      callers: callers.map(caller =>
        caller.id === POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE
          ? {
            ...caller,
            proofModeIds: ['client_supplied_proof'],
          }
          : caller
      ),
      checkPathExists: false,
      readSourceFile: () => '',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.UNKNOWN_PROOF_MODE,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
        proofModeId: 'client_supplied_proof',
      }),
      expect.objectContaining({
        riskId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_OUTCOME_ONLY_FALLBACK,
        callerId: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
      }),
    ]));
  });
});
