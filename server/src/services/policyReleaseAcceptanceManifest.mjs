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
  asObject,
  isIsoTimestamp,
  normalizeString,
} from './policyReleaseAcceptanceShared.mjs';
import {
  buildPolicyOperatorDecisionSignal,
  POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS,
} from './policyOperatorDecisionMetric.mjs';
import {
  validatePolicyReleaseInstallationEvidence,
} from './policyReleaseInstallationEvidence.mjs';

const POLICY_RELEASE_ACCEPTANCE_MANIFEST_VERSION =
  'policy.release_acceptance_manifest.v1';

const POLICY_RELEASE_ACCEPTANCE_MODE_IDS = Object.freeze({
  CI: 'ci',
  INSTALLATION: 'installation',
});

const POLICY_RELEASE_ACCEPTANCE_STATUS_IDS = Object.freeze({
  BLOCKED: 'blocked',
  NOT_APPLICABLE: 'not_applicable',
  PASSED: 'passed',
});

const POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS = Object.freeze({
  REPOSITORY_VALIDATION: 'repository_validation',
  ISOLATED_RUNTIME_ACCEPTANCE: 'isolated_runtime_acceptance',
  INSTALLATION_EVIDENCE: 'installation_evidence',
  OPERATOR_DECISION_SIGNAL: 'operator_decision_signal',
});

const REQUIRED_ISOLATED_SUITES = Object.freeze([
  'server/src/__tests__/integration/ai-authority-pipeline-acceptance.test.mjs',
  'server/src/__tests__/integration/deterministic-policy-route-outcome-acceptance.test.mjs',
  'server/src/__tests__/integration/provider-failure-recovery-acceptance.test.mjs',
  'server/src/__tests__/integration/native-intent-installation-lifecycle-acceptance.test.mjs',
  'server/src/__tests__/integration/native-intent-lifecycle-diagnostics-release-evidence.test.mjs',
  'server/src/__tests__/integration/operational-recovery-privacy-acceptance.test.mjs',
  'server/src/__tests__/services/policyRuntimeQuestionRecommendationPresentation.test.mjs',
  'client/src/__tests__/commandCenterActionModules.test.js',
]);

const SOURCE_REVISION_PATTERN = /^[a-f0-9]{7,64}$/i;

function normalizeStatusId(value) {
  return Object.values(POLICY_RELEASE_ACCEPTANCE_STATUS_IDS).includes(value)
    ? value
    : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED;
}

function buildComponent({
  componentId,
  required,
  statusId,
  message,
  evidence = null,
} = {}) {
  return {
    componentId,
    required: required === true,
    statusId: normalizeStatusId(statusId),
    message,
    evidence,
  };
}

function buildCiComponents({
  repositoryValidationStatusId,
  isolatedRuntimeAcceptanceStatusId,
} = {}) {
  return [
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.REPOSITORY_VALIDATION,
      required: true,
      statusId: repositoryValidationStatusId,
      message: 'Repository validation includes the root type, coverage, policy-language, and runtime-maintenance gates.',
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.ISOLATED_RUNTIME_ACCEPTANCE,
      required: true,
      statusId: isolatedRuntimeAcceptanceStatusId,
      message: 'Required isolated acceptance suites exercise authority, deterministic routing, recovery, installation lifecycle, diagnostics, and bounded decision presentation.',
      evidence: { requiredSuites: REQUIRED_ISOLATED_SUITES },
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.INSTALLATION_EVIDENCE,
      required: false,
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE,
      message: 'CI does not attest an active installation or authorize a deployment.',
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.OPERATOR_DECISION_SIGNAL,
      required: false,
      statusId: POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE,
      message: 'CI has no installation aggregate metric and cannot claim an operator-decision reduction.',
    }),
  ];
}

function findComponent(readout, componentId) {
  return Array.isArray(readout?.components)
    ? readout.components.find(component => component?.componentId === componentId) || null
    : null;
}

function buildInstallationComponents({
  ciReadout,
  installationEvidence,
  operatorDecisionMetric,
  baselineOperatorDecisionMetric,
  sourceRevision,
} = {}) {
  const normalizedCiReadout = asObject(ciReadout);
  const ciRepositoryValidation = findComponent(
    normalizedCiReadout,
    POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.REPOSITORY_VALIDATION
  );
  const ciIsolatedAcceptance = findComponent(
    normalizedCiReadout,
    POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.ISOLATED_RUNTIME_ACCEPTANCE
  );
  const installationValidation = validatePolicyReleaseInstallationEvidence(installationEvidence);
  const sourceRevisionMatches = normalizeString(normalizedCiReadout.sourceRevision, 64).toLowerCase() ===
    normalizeString(installationEvidence?.sourceRevision, 64).toLowerCase();
  const requestedSourceRevisionMatches = normalizeString(sourceRevision, 64).toLowerCase() ===
    normalizeString(installationEvidence?.sourceRevision, 64).toLowerCase();
  const ciReadoutPassed = normalizedCiReadout.modeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI &&
    normalizedCiReadout.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED &&
    normalizedCiReadout.validation?.ok === true;
  const ciEvidenceValid = ciReadoutPassed && sourceRevisionMatches &&
    requestedSourceRevisionMatches &&
    ciRepositoryValidation?.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED &&
    ciIsolatedAcceptance?.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED;
  const operatorDecisionSignal = buildPolicyOperatorDecisionSignal({
    currentMetric: operatorDecisionMetric,
    baselineMetric: baselineOperatorDecisionMetric,
  });
  const operatorSignalComponentStatus = operatorDecisionSignal.statusId ===
      POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.BLOCKED
    ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED
    : operatorDecisionSignal.statusId === POLICY_OPERATOR_DECISION_SIGNAL_STATUS_IDS.NOT_APPLICABLE
      ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE
      : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED;

  return [
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.REPOSITORY_VALIDATION,
      required: true,
      statusId: ciEvidenceValid
        ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
        : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED,
      message: ciEvidenceValid
        ? 'The supplied CI readout passed repository validation for the installed source revision.'
        : 'A fingerprint-valid passed CI readout for the installed source revision is required.',
      evidence: ciEvidenceValid ? { sourceRevision: normalizedCiReadout.sourceRevision } : null,
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.ISOLATED_RUNTIME_ACCEPTANCE,
      required: true,
      statusId: ciEvidenceValid
        ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
        : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED,
      message: ciEvidenceValid
        ? 'The supplied CI readout passed the required isolated runtime acceptance suites.'
        : 'A fingerprint-valid passed CI readout for the installed source revision is required.',
      evidence: ciEvidenceValid ? { requiredSuites: REQUIRED_ISOLATED_SUITES } : null,
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.INSTALLATION_EVIDENCE,
      required: true,
      statusId: installationValidation.ok
        ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
        : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED,
      message: installationValidation.ok
        ? 'Installation evidence is bound to the deployment fingerprint, source revision, and protected-environment workflow run.'
        : 'Installation evidence is invalid or incomplete.',
      evidence: installationValidation.ok ? {
        deploymentFingerprint: installationEvidence.deploymentFingerprint,
        sourceRevision: installationEvidence.sourceRevision,
        approvalWorkflow: installationEvidence.approvalWorkflow,
        evidenceFingerprint: installationEvidence.evidenceFingerprint?.fingerprint || null,
      } : { validationIssues: installationValidation.issues },
    }),
    buildComponent({
      componentId: POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.OPERATOR_DECISION_SIGNAL,
      required: false,
      statusId: operatorSignalComponentStatus,
      message: operatorDecisionSignal.message,
      evidence: operatorDecisionSignal,
    }),
  ];
}

function buildOperatorSummary({ statusId, modeId, components }) {
  const blockedComponents = components.filter(component =>
    component.required && component.statusId !== POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
  );
  const notApplicableComponents = components.filter(component =>
    component.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE
  );

  if (statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED) {
    return {
      decision: 'blocked',
      message: 'Release acceptance is blocked by required evidence.',
      nextAction: blockedComponents[0]?.message || 'Resolve the blocked required component.',
      blockedComponentIds: blockedComponents.map(component => component.componentId),
    };
  }

  if (modeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI) {
    return {
      decision: 'repository_acceptance_passed',
      message: 'Repository and isolated-runtime acceptance passed. This result does not attest an active installation.',
      nextAction: 'Use the protected installation-evidence workflow only after deploying this source revision.',
      notApplicableComponentIds: notApplicableComponents.map(component => component.componentId),
    };
  }

  return {
    decision: 'installation_acceptance_passed',
    message: 'CI acceptance and fingerprint-bound installation evidence passed for the deployed source revision.',
    nextAction: notApplicableComponents.some(component =>
      component.componentId === POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.OPERATOR_DECISION_SIGNAL
    )
      ? 'Capture a comparable aggregate baseline and current metric before claiming an operator-decision reduction.'
      : 'Review the aggregate operator-decision signal; it is informational and never changes routing authority.',
    notApplicableComponentIds: notApplicableComponents.map(component => component.componentId),
  };
}

function buildPolicyReleaseAcceptanceReadout({
  modeId,
  sourceRevision,
  repositoryValidationStatusId,
  isolatedRuntimeAcceptanceStatusId,
  ciReadout = null,
  installationEvidence = null,
  operatorDecisionMetric = null,
  baselineOperatorDecisionMetric = null,
  generatedAt = null,
} = {}) {
  const normalizedModeId = Object.values(POLICY_RELEASE_ACCEPTANCE_MODE_IDS).includes(modeId)
    ? modeId
    : null;
  const components = normalizedModeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI
    ? buildCiComponents({ repositoryValidationStatusId, isolatedRuntimeAcceptanceStatusId })
    : normalizedModeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.INSTALLATION
      ? buildInstallationComponents({
        ciReadout,
        installationEvidence,
        operatorDecisionMetric,
        baselineOperatorDecisionMetric,
        sourceRevision,
      })
      : [];
  const statusId = components.some(component =>
    component.required && component.statusId !== POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
  )
    ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED
    : components.length > 0
      ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
      : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.NOT_APPLICABLE;
  const readout = {
    version: POLICY_RELEASE_ACCEPTANCE_MANIFEST_VERSION,
    modeId: normalizedModeId,
    generatedAt: generatedAt || new Date().toISOString(),
    sourceRevision: normalizeString(sourceRevision, 64).toLowerCase(),
    statusId,
    complete: statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED,
    components,
    executionPolicy: {
      requiresIsolatedProviderAndInstallationAcceptance: true,
      requiresFingerprintBoundInstallationEvidenceForInstallationReadout: true,
      keepsInstallationEvidenceOutOfOrdinaryCi: true,
      keepsOperatorDecisionSignalInformational: true,
      prohibitsRawClassificationIdentifiers: true,
      prohibitsRoutingAuthorityChanges: true,
    },
  };

  return {
    ...readout,
    operatorSummary: buildOperatorSummary({
      statusId,
      modeId: normalizedModeId,
      components,
    }),
    validation: validatePolicyReleaseAcceptanceReadout(readout),
  };
}

function validatePolicyReleaseAcceptanceReadout(readout = {}) {
  const source = asObject(readout);
  const issues = [];
  const components = Array.isArray(source.components) ? source.components : [];
  const expectedComponentIds = Object.values(POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS);
  const componentIds = components.map(component => component?.componentId);
  const requiredBlocked = components.some(component =>
    component?.required === true && component.statusId !== POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
  );

  if (source.version !== POLICY_RELEASE_ACCEPTANCE_MANIFEST_VERSION) {
    issues.push('unknown_release_acceptance_manifest_version');
  }
  if (!Object.values(POLICY_RELEASE_ACCEPTANCE_MODE_IDS).includes(source.modeId)) {
    issues.push('unknown_release_acceptance_mode');
  }
  if (!SOURCE_REVISION_PATTERN.test(normalizeString(source.sourceRevision, 64))) {
    issues.push('invalid_source_revision');
  }
  if (!isIsoTimestamp(source.generatedAt)) {
    issues.push('invalid_generated_at');
  }
  if (componentIds.length !== expectedComponentIds.length ||
    expectedComponentIds.some(componentId => !componentIds.includes(componentId))) {
    issues.push('incomplete_component_manifest');
  }
  if (components.some(component => !Object.values(POLICY_RELEASE_ACCEPTANCE_STATUS_IDS)
    .includes(component?.statusId))) {
    issues.push('invalid_component_status');
  }
  if (source.statusId !== (requiredBlocked
    ? POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.BLOCKED
    : POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED)) {
    issues.push('release_status_mismatch');
  }
  if (source.complete !== (source.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED)) {
    issues.push('complete_flag_mismatch');
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS,
  POLICY_RELEASE_ACCEPTANCE_MANIFEST_VERSION,
  POLICY_RELEASE_ACCEPTANCE_MODE_IDS,
  POLICY_RELEASE_ACCEPTANCE_STATUS_IDS,
  REQUIRED_ISOLATED_SUITES,
  buildPolicyReleaseAcceptanceReadout,
  validatePolicyReleaseAcceptanceReadout,
};
