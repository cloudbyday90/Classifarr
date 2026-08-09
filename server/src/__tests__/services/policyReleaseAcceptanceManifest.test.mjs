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
  buildPolicyOperatorDecisionMetric,
} from '../../services/policyOperatorDecisionMetric.mjs';
import {
  buildPolicyReleaseAcceptanceReadout,
  POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS,
  POLICY_RELEASE_ACCEPTANCE_MODE_IDS,
  POLICY_RELEASE_ACCEPTANCE_STATUS_IDS,
} from '../../services/policyReleaseAcceptanceManifest.mjs';
import {
  buildPolicyReleaseInstallationEvidence,
} from '../../services/policyReleaseInstallationEvidence.mjs';

const SOURCE_REVISION = 'a'.repeat(40);
const GENERATED_AT = '2026-08-03T00:00:00.000Z';
const WINDOW_STARTED_AT = '2026-08-01T00:00:00.000Z';
const WINDOW_ENDED_AT = '2026-08-02T00:00:00.000Z';

function buildMetric(openOperatorReviewCount) {
  return buildPolicyOperatorDecisionMetric({
    measurementScopeId: 'all_classification_history',
    windowStartedAt: WINDOW_STARTED_AT,
    windowEndedAt: WINDOW_ENDED_AT,
    generatedAt: GENERATED_AT,
    counts: {
      classifiedOutcomeCount: 100,
      openOperatorReviewCount,
      pendingRetryCount: 0,
      automaticallyRoutedCount: 50,
      policyAutomaticOutcomeCount: 60,
    },
  });
}

function buildCiReadout(overrides = {}) {
  return buildPolicyReleaseAcceptanceReadout({
    modeId: POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI,
    sourceRevision: SOURCE_REVISION,
    repositoryValidationStatusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
    isolatedRuntimeAcceptanceStatusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
    generatedAt: GENERATED_AT,
    ...overrides,
  });
}

function buildInstallationEvidence() {
  return buildPolicyReleaseInstallationEvidence({
    deploymentFingerprint: 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    sourceRevision: SOURCE_REVISION,
    approvalWorkflow: {
      environmentName: 'release-acceptance',
      workflowRunUrl: 'https://github.com/cloudbyday90/Classifarr/actions/runs/31285274283',
      changeReference: 'release-0.47.5',
      attestedAt: GENERATED_AT,
    },
    generatedAt: GENERATED_AT,
  });
}

describe('policy release acceptance manifest', () => {
  test('records a passing CI acceptance without claiming installation evidence', () => {
    const readout = buildCiReadout();
    const installationComponent = readout.components.find(component =>
      component.componentId === POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.INSTALLATION_EVIDENCE
    );

    expect(readout).toEqual(expect.objectContaining({
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(installationComponent).toEqual(expect.objectContaining({
      required: false,
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE,
    }));
  });

  test('blocks CI acceptance if a required component is not passed', () => {
    const readout = buildCiReadout({
      isolatedRuntimeAcceptanceStatusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE,
    });

    expect(readout).toEqual(expect.objectContaining({
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED,
      complete: false,
      validation: expect.objectContaining({ ok: true }),
    }));
  });

  test('binds installation acceptance to matching CI and protected-workflow evidence', () => {
    const readout = buildPolicyReleaseAcceptanceReadout({
      modeId: POLICY_RELEASE_ACCEPTANCE_MODE_IDS.INSTALLATION,
      sourceRevision: SOURCE_REVISION,
      ciReadout: buildCiReadout(),
      installationEvidence: buildInstallationEvidence(),
      operatorDecisionMetric: buildMetric(10),
      baselineOperatorDecisionMetric: buildMetric(20),
      generatedAt: GENERATED_AT,
    });

    expect(readout).toEqual(expect.objectContaining({
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
      complete: true,
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(readout.components).toEqual(expect.arrayContaining([
      expect.objectContaining({
        componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.OPERATOR_DECISION_SIGNAL,
        statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
        evidence: expect.objectContaining({ statusId: 'improved' }),
      }),
    ]));
  });

  test('blocks installation acceptance when the source revision does not match the evidence', () => {
    const readout = buildPolicyReleaseAcceptanceReadout({
      modeId: POLICY_RELEASE_ACCEPTANCE_MODE_IDS.INSTALLATION,
      sourceRevision: 'b'.repeat(40),
      ciReadout: buildCiReadout(),
      installationEvidence: buildInstallationEvidence(),
      generatedAt: GENERATED_AT,
    });

    expect(readout).toEqual(expect.objectContaining({
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED,
      complete: false,
      validation: expect.objectContaining({ ok: true }),
    }));
  });
});
