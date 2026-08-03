import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS,
  POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS,
  POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS,
  auditPolicyAuthoringComponentInventory,
  classifyPolicyAuthoringComponent,
  getPolicyAuthoringTargetImplementation,
  listPolicyAuthoringComponentInventory,
  listPolicyAuthoringTargetImplementations,
  summarizePolicyAuthoringComponentInventory,
} from '../../services/policyAuthoringComponentInventory.mjs';
import {
  POLICY_AUTHORING_COMPONENT_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const policyComponentRoot = resolve(repoRoot, 'client/src/components/policies');
const policyComponentPaths = readdirSync(policyComponentRoot, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.vue'))
  .map(entry => `client/src/components/policies/${entry.name}`)
  .sort();

describe('policyAuthoringComponentInventory', () => {
  test('classifies every current policy component exactly once', () => {
    const audit = auditPolicyAuthoringComponentInventory(policyComponentPaths);

    expect(audit).toEqual(expect.objectContaining({
      ok: true,
      checkedComponentCount: policyComponentPaths.length,
      checkedTargetImplementationCount: 10,
      issues: [],
      nextTargetImplementation: null,
    }));
  });

  test('records normal authoring, compatibility-only, and out-of-scope ownership explicitly', () => {
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/PolicyDestinationProposalCard.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_PROPOSAL,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/PolicyDestinationProposalAdjustmentDisclosure.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.DESTINATION_PROPOSAL,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/IntentSignalPicker.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_PICKER,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/IntentSignalChipList.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.INTENT_SIGNAL_CHIP_RENDERING,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/HardLimitControl.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.HARD_LIMIT_CONTROL,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/AvoidControl.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.AVOID_CONTROL,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/ReviewTriggerControl.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.REVIEW_TRIGGER_CONTROL,
      normalAuthoringAllowed: true,
      targetComponentIds: [POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL],
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/PolicyCompatibilityMaintenanceSurface.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.COMPATIBILITY_MAINTENANCE,
      normalAuthoringAllowed: false,
    }));
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/PolicyCard.vue',
    )).toEqual(expect.objectContaining({
      roleId: POLICY_AUTHORING_COMPONENT_INVENTORY_ROLE_IDS.POLICY_LIST_CARD,
      normalAuthoringAllowed: false,
    }));
  });

  test('records completed native constraint-control extractions', () => {
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.DESTINATION_PROPOSAL_CARD,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
      sourcePaths: [
        'client/src/components/policies/PolicyDestinationProposalCard.vue',
        'client/src/components/policies/PolicyDestinationProposalAdjustmentDisclosure.vue',
      ],
    }));
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_CHIP_LIST,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
      sourcePaths: ['client/src/components/policies/IntentSignalChipList.vue'],
    }));
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.HARD_LIMIT_CONTROL,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
      sourcePaths: ['client/src/components/policies/HardLimitControl.vue'],
    }));
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.AVOID_CONTROL,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
      sourcePaths: ['client/src/components/policies/AvoidControl.vue'],
    }));
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.REVIEW_TRIGGER_CONTROL,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED,
      sourcePaths: ['client/src/components/policies/ReviewTriggerControl.vue'],
    }));
  });

  test('keeps starter-template UI optional until it adds value beyond server-projected evidence', () => {
    expect(getPolicyAuthoringTargetImplementation(
      POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
    )).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.OPTIONAL_DEFERRED,
      sourcePaths: [],
    }));
  });

  test('reports unknown component paths without treating them as normal authoring', () => {
    expect(classifyPolicyAuthoringComponent(
      'client/src/components/policies/UnclassifiedPolicyControl.vue',
    )).toEqual(expect.objectContaining({
      id: null,
      normalAuthoringAllowed: false,
      riskIds: [POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.UNCLASSIFIED_COMPONENT],
    }));
  });

  test('reports missing and unclassified source paths in the audit', () => {
    const audit = auditPolicyAuthoringComponentInventory([
      'client/src/components/policies/IntentSignalPicker.vue',
      'client/src/components/policies/UnclassifiedPolicyControl.vue',
    ]);

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.UNCLASSIFIED_COMPONENT,
        path: 'client/src/components/policies/UnclassifiedPolicyControl.vue',
      }),
      expect.objectContaining({
        riskId: POLICY_AUTHORING_COMPONENT_INVENTORY_RISK_IDS.MISSING_COMPONENT_PATH,
        path: 'client/src/components/policies/PolicyBuilderModal.vue',
      }),
    ]));
  });

  test('returns immutable component and target implementation records', () => {
    const componentRecords = listPolicyAuthoringComponentInventory();
    const targetImplementations = listPolicyAuthoringTargetImplementations();

    expect(componentRecords).toHaveLength(policyComponentPaths.length);
    expect(Object.isFrozen(componentRecords)).toBe(true);
    expect(Object.isFrozen(componentRecords[0].targetComponentIds)).toBe(true);
    expect(Object.isFrozen(targetImplementations)).toBe(true);
    expect(Object.isFrozen(targetImplementations[0].sourcePaths)).toBe(true);
  });

  test('summarizes completed target-component ownership', () => {
    expect(summarizePolicyAuthoringComponentInventory(policyComponentPaths)).toEqual(
      expect.objectContaining({
        total: policyComponentPaths.length,
        unclassifiedPaths: [],
        implementationStatusCounts: {
          [POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.IMPLEMENTED]: 9,
          [POLICY_AUTHORING_TARGET_IMPLEMENTATION_STATUS_IDS.OPTIONAL_DEFERRED]: 1,
        },
        nextTargetImplementation: null,
      }),
    );
  });
});
