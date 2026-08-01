/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS,
  POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS,
  REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS,
  buildPolicyCompatibilityMaintenanceTestOwnershipAudit,
  buildPolicyCompatibilityMaintenanceTestSourceAudit,
  getPolicyCompatibilityMaintenanceTestRecord,
  listPolicyCompatibilityMaintenanceTestRecords,
  listPolicyCompatibilityMaintenanceTestSourcePaths,
  summarizePolicyCompatibilityMaintenanceTestOwnership,
  validatePolicyCompatibilityMaintenanceTestRecord,
} from '../../services/policyCompatibilityMaintenanceTestOwnership.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');

async function readCompatibilityMaintenanceTestSources() {
  const entries = await Promise.all(
    listPolicyCompatibilityMaintenanceTestSourcePaths().map(async sourceTestPath => [
      sourceTestPath,
      await readFile(resolve(repoRoot, sourceTestPath), 'utf8'),
    ])
  );

  return Object.fromEntries(entries);
}

describe('policyCompatibilityMaintenanceTestOwnership', () => {
  test('separates retained maintenance scopes from normal authoring by observable behavior', () => {
    expect(REQUIRED_POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS).toEqual([
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.CONTEXT_PRECEDES_EDITABLE_CONTROLS,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.TYPED_DRAFT_COMMANDS_FORWARDED,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.NATIVE_STORAGE_REMOVAL_READY,
    ]);

    expect(listPolicyCompatibilityMaintenanceTestSourcePaths()).toEqual([
      'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
      'client/src/__tests__/PolicyIntentEditor.test.js',
      'client/src/__tests__/PolicyBuilderModal.test.js',
      'client/src/__tests__/PolicyPresetMigrationNotice.test.js',
    ]);

    listPolicyCompatibilityMaintenanceTestRecords().forEach(record => {
      expect(record.normalAuthoringPath).toBe(false);
      expect(record.preservesLegacyLayout).toBe(false);
      expect(record.protectsDiagnosticBehavior).toBe(false);
      expect(record.nativeStorageRemovalReady).toBe(true);
    });
  });

  test('maps every retained compatibility component to the native-storage deletion gate', () => {
    const audit = buildPolicyCompatibilityMaintenanceTestOwnershipAudit();

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      checkedRecordCount: 4,
      requiredBehaviorCount: 3,
      missingRequiredBehaviorIds: [],
      issues: [],
    }));
  });

  test('points each ownership scope at named observable-behavior tests', async () => {
    const audit = buildPolicyCompatibilityMaintenanceTestSourceAudit(
      await readCompatibilityMaintenanceTestSources()
    );

    expect(audit).toEqual({
      ok: true,
      checkedRecordCount: 4,
      issues: [],
    });
  });

  test('fails closed when maintenance coverage becomes normal authoring, legacy layout, or diagnostic coverage', () => {
    const record = getPolicyCompatibilityMaintenanceTestRecord('compatibility_maintenance_surface');
    const result = validatePolicyCompatibilityMaintenanceTestRecord({
      ...record,
      normalAuthoringPath: true,
      preservesLegacyLayout: true,
      protectsDiagnosticBehavior: true,
      nativeStorageRemovalReady: false,
    });

    expect(result.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.NORMAL_AUTHORING_OWNERSHIP,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.LEGACY_LAYOUT_FROZEN,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.DIAGNOSTIC_BEHAVIOR_PROTECTED,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.REMOVAL_READINESS_NOT_DECLARED,
    ]));
  });

  test('fails closed for missing behavior coverage, duplicate ownership, and unknown scopes', () => {
    const records = listPolicyCompatibilityMaintenanceTestRecords();
    const missingBehaviorAudit = buildPolicyCompatibilityMaintenanceTestOwnershipAudit(
      records.map(record => ({
        ...record,
        protectedBehaviorIds: record.protectedBehaviorIds.filter(behaviorId => (
          behaviorId !== POLICY_COMPATIBILITY_MAINTENANCE_TEST_BEHAVIOR_IDS.NATIVE_STORAGE_REMOVAL_READY
        )),
      }))
    );

    expect(missingBehaviorAudit.issues.map(issue => issue.riskId))
      .toContain(POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_REQUIRED_BEHAVIOR_COVERAGE);

    const duplicateAudit = buildPolicyCompatibilityMaintenanceTestOwnershipAudit([
      ...records,
      records[0],
    ]);

    expect(duplicateAudit.issues.map(issue => issue.riskId))
      .toContain(POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.DUPLICATE_TEST_SCOPE);

    expect(validatePolicyCompatibilityMaintenanceTestRecord({
      id: 'unknown_scope',
      protectedBehaviorIds: ['unknown_behavior'],
      componentPaths: [],
    }).issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.UNKNOWN_TEST_SCOPE,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.UNKNOWN_BEHAVIOR,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_COMPONENT_PATH,
    ]));
  });

  test('fails source verification when a named observable-behavior test disappears', () => {
    const audit = buildPolicyCompatibilityMaintenanceTestSourceAudit({});

    expect(audit.issues).toHaveLength(4);
    expect(audit.issues.map(issue => issue.riskId)).toEqual([
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_SOURCE_TEST_TEXT,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_SOURCE_TEST_TEXT,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_SOURCE_TEST_TEXT,
      POLICY_COMPATIBILITY_MAINTENANCE_TEST_RISK_IDS.MISSING_SOURCE_TEST_TEXT,
    ]);
  });

  test('summarizes removable compatibility maintenance coverage without freezing legacy UI', () => {
    expect(summarizePolicyCompatibilityMaintenanceTestOwnership()).toEqual({
      recordCount: 4,
      sourceTestPathCount: 4,
      requiredBehaviorCount: 3,
      normalAuthoringPathRecordCount: 0,
      legacyLayoutFreezeRecordCount: 0,
      diagnosticProtectionRecordCount: 0,
      missingRequiredBehaviorIds: [],
      nativeStorageRemovalReady: true,
    });
  });

  test('returns immutable known records and null for unknown ownership scopes', () => {
    const records = listPolicyCompatibilityMaintenanceTestRecords();

    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0].componentPaths)).toBe(true);
    expect(Object.isFrozen(records[0].protectedBehaviorIds)).toBe(true);
    expect(getPolicyCompatibilityMaintenanceTestRecord('unknown')).toBeNull();
  });
});
