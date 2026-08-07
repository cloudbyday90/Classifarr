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
  POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS,
  POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_VERSION,
  RETIRED_DIAGNOSTIC_ARTIFACTS,
  buildPolicyLegacyBuilderCutoverAudit,
} from '../../services/policyLegacyBuilderCutoverAudit.mjs';

describe('policyLegacyBuilderCutoverAudit', () => {
  test('passes a clean current-state audit with no violations', () => {
    const audit = buildPolicyLegacyBuilderCutoverAudit();

    expect(audit).toEqual(expect.objectContaining({
      version: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_VERSION,
      ok: true,
      issueCount: 0,
      issues: [],
    }));
    expect(audit.retiredArtifactCount).toBe(RETIRED_DIAGNOSTIC_ARTIFACTS.length);
    expect(audit.retiredArtifactsVerified.every(a => a.exists === false)).toBe(true);
    expect(audit.nextStep.stepId).toBe('accessibility_responsive_e2e_tests');
  });

  test('fails when a retired diagnostic component is reintroduced', () => {
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      exists: (path) => {
        const normalized = path.replaceAll('\\', '/');
        return RETIRED_DIAGNOSTIC_ARTIFACTS.some(artifact =>
          normalized.endsWith(artifact));
      },
      vueFiles: [],
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RETIRED_COMPONENT_REINTRODUCED,
      }),
    ]));
  });

  test('fails when alert() appears in a policy authoring component', () => {
    const fakeVueFile = 'C:/fake/path/PolicyBuilderModal.vue';
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      vueFiles: [fakeVueFile],
      sourceReader: () => 'alert("error");',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.ALERT_IN_POLICY_AUTHORING,
      }),
    ]));
  });

  test('fails when a reset/recreate control appears in normal path', () => {
    const fakeVueFile = 'C:/fake/path/PolicyList.vue';
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      vueFiles: [fakeVueFile],
      sourceReader: () => 'function resetPolicy() { return true; }',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RESET_RECREATE_IN_NORMAL_PATH,
      }),
    ]));
  });

  test('fails when a reconciliation maintenance link appears in normal path', () => {
    const fakeVueFile = 'C:/fake/path/PolicyBuilder.vue';
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      vueFiles: [fakeVueFile],
      sourceReader: () => '<a href="/api/policies/reconciliation">Reconcile</a>',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RECONCILIATION_LINK_IN_NORMAL_PATH,
      }),
    ]));
  });

  test('fails when the retired migration verifier visibility prop appears', () => {
    const fakeVueFile = 'C:/fake/path/PolicyBuilderModal.vue';
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      vueFiles: [fakeVueFile],
      sourceReader: () => 'showMigrationVerifierPanels: true',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.MIGRATION_VERIFIER_VISIBILITY,
      }),
    ]));
  });

  test('fails when raw threshold controls appear in normal authoring', () => {
    const fakeVueFile = 'C:/fake/path/PolicyAdvancedSettings.vue';
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      vueFiles: [fakeVueFile],
      sourceReader: () => 'const decisionThreshold = 0.75;',
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_LEGACY_BUILDER_CUTOVER_AUDIT_RISK_IDS.RAW_THRESHOLD_CONTROLS,
      }),
    ]));
  });

  test('default scan only covers the policy components directory', () => {
    const audit = buildPolicyLegacyBuilderCutoverAudit({
      exists: () => false,
    });

    expect(audit.ok).toBe(true);
    expect(audit.issueCount).toBe(0);
  });

  test('all side effects remain false in a clean audit', () => {
    const audit = buildPolicyLegacyBuilderCutoverAudit();

    expect(Object.values(audit.sideEffects).every(v => v === false)).toBe(true);
  });
});
