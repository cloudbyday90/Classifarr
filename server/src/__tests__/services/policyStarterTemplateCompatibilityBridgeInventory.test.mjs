/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS,
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS,
  POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS,
  buildPolicyStarterTemplateCompatibilityBridgeAudit,
  listPolicyStarterTemplateCompatibilityBridgeArtifacts,
  listPolicyStarterTemplateRetiredMechanicPaths,
  summarizePolicyStarterTemplateCompatibilityBridgeInventory,
  validatePolicyStarterTemplateCompatibilityBridgeArtifact,
} from '../../services/policyStarterTemplateCompatibilityBridgeInventory.mjs';
import {
  LEGACY_COMPATIBILITY_ARTIFACT_IDS,
  LEGACY_COMPATIBILITY_DELETION_GATE_IDS,
} from '../../services/policyBuilderLegacyCompatibilityBoundary.mjs';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../../../..');

describe('policyStarterTemplateCompatibilityBridgeInventory', () => {
  test('records every retained attachment reader, round-trip bridge, and compatibility component', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts();

    expect(artifacts.map(artifact => artifact.id)).toEqual(expect.arrayContaining([
      'preset_attachment_query_helper',
      'policy_read_attachment_projection',
      'policy_write_attachment_round_trip',
      'policy_preset_attachment_routes',
      'preset_attachment_migration_routes',
      'legacy_bridge_policyIntentDraftBridge',
      'legacy_bridge_usePolicyIntentDraft',
      'legacy_bridge_usePolicyBuilderState',
      'compatibility_component_policy_compatibility_maintenance_surface',
      'compatibility_component_policy_intent_editor',
      'compatibility_component_policy_preset_migration_notice',
    ]));
    expect(artifacts.every(artifact => artifact.deletionGateIds.length === 7)).toBe(true);
    expect(artifacts.every(artifact => artifact.replacementTarget)).toBe(true);
  });

  test('keeps all inventory paths present for the deletion audit', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts();

    artifacts.forEach((artifact) => {
      const sourcePath = resolve(REPOSITORY_ROOT, artifact.sourcePath);
      expect(existsSync(sourcePath)).toBe(true);

      expect(readFileSync(sourcePath, 'utf8').length).toBeGreaterThan(0);
    });
  });

  test('keeps only non-normal compatibility components in the inventory', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts()
      .filter(artifact => artifact.kindId === POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT);

    expect(artifacts.length).toBeGreaterThan(0);
    expect(artifacts.every(artifact => artifact.normalAuthoringAllowed === false)).toBe(true);
    expect(artifacts.every(artifact => artifact.rawPayloadMutationAllowed === false)).toBe(true);
  });

  test('records the former raw template mechanics surface as retired rather than active', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts();
    const retiredPaths = listPolicyStarterTemplateRetiredMechanicPaths();

    expect(retiredPaths).toEqual([
      'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
    ]);
    expect(retiredPaths.every(path => !existsSync(resolve(REPOSITORY_ROOT, path)))).toBe(true);
    expect(artifacts.map(artifact => artifact.sourcePath)).not.toEqual(expect.arrayContaining(retiredPaths));
  });

  test('summarizes the active bridge without admitting compatibility UI to normal authoring', () => {
    expect(summarizePolicyStarterTemplateCompatibilityBridgeInventory()).toEqual({
      activeArtifactCount: listPolicyStarterTemplateCompatibilityBridgeArtifacts().length,
      countsByKind: {
        [POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_READER]: 2,
        [POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.ATTACHMENT_ROUND_TRIP]: 6,
        [POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT]: 12,
      },
      deletionGateIds: [
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LOSSLESS_CONVERSION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.ROLLBACK_SNAPSHOT,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_READ_WRITE_PARITY,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.LEGACY_WRITE_SHUTDOWN,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.BACKUP_RESTORE_VERIFICATION,
        LEGACY_COMPATIBILITY_DELETION_GATE_IDS.REGRESSION_COVERAGE,
      ],
      retiredMechanicPaths: [
        'client/src/components/policies/PolicyStarterTemplateMechanics.vue',
      ],
      normalAuthoringCompatibilityArtifactIds: [],
    });
  });

  test('passes the default exhaustive compatibility audit', () => {
    expect(buildPolicyStarterTemplateCompatibilityBridgeAudit()).toEqual(expect.objectContaining({
      ok: true,
      checkedArtifactCount: 20,
      checkedBridgeModuleCount: 3,
      checkedCompatibilityComponentCount: 12,
      duplicateIds: [],
      duplicatePaths: [],
      missingBridgeModulePaths: [],
      missingCompatibilityComponentPaths: [],
      issues: [],
    }));
  });

  test('rejects a retained artifact without all deletion gates or a native successor', () => {
    expect(validatePolicyStarterTemplateCompatibilityBridgeArtifact({
      id: 'unsafe-component',
      kindId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_KIND_IDS.COMPATIBILITY_COMPONENT,
      sourcePath: 'client/src/components/policies/Unsafe.vue',
      entryPoint: 'unsafe',
      artifactIds: [LEGACY_COMPATIBILITY_ARTIFACT_IDS.PRESET_ATTACHMENTS],
      deletionGateIds: [LEGACY_COMPATIBILITY_DELETION_GATE_IDS.NATIVE_INTENT_SCHEMA],
      replacementTarget: '',
      normalAuthoringAllowed: true,
      rawPayloadMutationAllowed: true,
    })).toEqual({
      valid: false,
      artifactId: 'unsafe-component',
      issues: expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_DELETION_GATE,
        }),
        expect.objectContaining({
          riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_REPLACEMENT_TARGET,
        }),
        expect.objectContaining({
          riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.NORMAL_AUTHORING_COMPONENT,
        }),
        expect.objectContaining({
          riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.RAW_PAYLOAD_COMPONENT,
        }),
      ]),
    });
  });

  test('rejects missing compatibility component coverage from an altered inventory', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts()
      .filter(artifact => artifact.id !== 'compatibility_component_policy_intent_editor');

    expect(buildPolicyStarterTemplateCompatibilityBridgeAudit({ artifacts })).toEqual(expect.objectContaining({
      ok: false,
      missingCompatibilityComponentPaths: [
        'client/src/components/policies/PolicyIntentEditor.vue',
      ],
      issues: expect.arrayContaining([
        expect.objectContaining({
          riskId: POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_RISK_IDS.MISSING_COMPATIBILITY_COMPONENT_COVERAGE,
        }),
      ]),
    }));
  });

  test('exposes immutable audit records', () => {
    const artifacts = listPolicyStarterTemplateCompatibilityBridgeArtifacts();

    expect(Object.isFrozen(artifacts)).toBe(true);
    expect(Object.isFrozen(artifacts[0])).toBe(true);
    expect(Object.isFrozen(artifacts[0].artifactIds)).toBe(true);
    expect(Object.isFrozen(artifacts[0].deletionGateIds)).toBe(true);
    expect(Object.values(POLICY_STARTER_TEMPLATE_COMPATIBILITY_BRIDGE_DISPOSITION_IDS))
      .toEqual(['delete_after_native_storage', 'replace_after_native_storage']);
  });
});
