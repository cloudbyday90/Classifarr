import {
  POLICY_AUTHORING_DRAFT_COMMAND_IDS as POLICY_DRAFT_COMMAND_IDS,
} from '../../services/policyAuthoringDraftCommandBoundary.mjs';
import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_WORKFLOW_DECISION_IDS,
  POLICY_AUTHORING_WORKFLOW_ROLE_IDS,
} from '../../services/policyAuthoringWorkflowInventory.mjs';
import {
  POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS,
  POLICY_AUTHORING_TEMPLATE_RISK_IDS,
  POLICY_AUTHORING_TEMPLATE_ROLE_IDS,
  POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS,
  buildPolicyAuthoringTemplateApplicationCommands,
  getPolicyAuthoringStarterTemplateMechanicRecord,
  getPolicyAuthoringStarterTemplateRoleRecord,
  listPolicyAuthoringStarterTemplateMechanicRecords,
  listPolicyAuthoringStarterTemplateRoleRecords,
  normalizePolicyAuthoringTemplateSuggestion,
  summarizePolicyAuthoringStarterTemplates,
  validatePolicyAuthoringStarterTemplatePlacement,
  validatePolicyAuthoringTemplateMechanicSurface,
  validatePolicyAuthoringTemplateSuggestion,
} from '../../services/policyAuthoringStarterTemplates.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';

describe('policyAuthoringStarterTemplates', () => {
  test('defines starter templates as optional accelerators with secondary provenance', () => {
    expect(listPolicyAuthoringStarterTemplateRoleRecords().map(record => record.roleId)).toEqual([
      POLICY_AUTHORING_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
      POLICY_AUTHORING_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
      POLICY_AUTHORING_TEMPLATE_ROLE_IDS.BRIDGE_ONLY_MECHANIC,
      POLICY_AUTHORING_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);

    expect(getPolicyAuthoringStarterTemplateRoleRecord(POLICY_AUTHORING_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR))
      .toEqual(expect.objectContaining({
        normalAuthoringAllowed: true,
        requiresDestinationContext: true,
        canBeRequiredToSave: false,
        componentId: POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      }));
  });

  test('maps template suggestions into product vocabulary buckets', () => {
    expect(Object.values(POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS)).toEqual([
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ]);

    expect(normalizePolicyAuthoringTemplateSuggestion({
      templateId: 'template-1',
      templateName: 'Animated starter',
      bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
      value: 'Animation',
      explanation: 'Starter template commonly uses Animation as identity.',
    })).toEqual(expect.objectContaining({
      templateId: 'template-1',
      templateName: 'Animated starter',
      bucketId: POLICY_UX_TERM_IDS.BELONGS_HERE,
      value: 'Animation',
      label: 'Animation',
      provenanceRoleId: POLICY_AUTHORING_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
      sourceLabel: 'Starter template suggestion',
      signalType: 'genres',
      key: 'require_any',
    }));
  });

  test('validates template placement after destination context and never as save requirement', () => {
    expect(validatePolicyAuthoringStarterTemplatePlacement({
      destinationContextVisible: false,
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.TEMPLATE_BEFORE_DESTINATION_CONTEXT,
      reason: 'Starter templates can appear only after destination context is visible.',
    });

    expect(validatePolicyAuthoringStarterTemplatePlacement({
      destinationContextVisible: true,
      templateRequiredToSave: true,
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.TEMPLATE_REQUIRED_FOR_POLICY,
      reason: 'Users must be able to build and save a policy without selecting a starter template.',
    });

    expect(validatePolicyAuthoringStarterTemplatePlacement({
      destinationContextVisible: true,
      provenancePrimary: true,
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.TEMPLATE_PROVENANCE_PRIMARY,
      reason: 'Starter-template provenance must remain secondary to destination context and declared intent.',
    });

    expect(validatePolicyAuthoringStarterTemplatePlacement({
      destinationContextVisible: true,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Starter templates are optional post-destination accelerators.',
    });
  });

  test('rejects unknown template buckets and empty values', () => {
    expect(validatePolicyAuthoringTemplateSuggestion({
      bucketId: 'legacy_preset_weight',
      value: 'Animation',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.UNKNOWN_TEMPLATE_BUCKET,
    }));

    expect(validatePolicyAuthoringTemplateSuggestion({
      bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.HELPFUL_MATCHES,
      value: '',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.MISSING_TEMPLATE_VALUE,
    }));
  });

  test('builds typed draft commands when applying template suggestions', () => {
    const commandPlan = buildPolicyAuthoringTemplateApplicationCommands({
      presetId: 'preset-1',
      suggestions: [
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
          value: 'Animation',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.HELPFUL_MATCHES,
          value: 'Family',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.HARD_LIMITS,
          value: 'PG-13',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.AVOID,
          value: 'R',
        },
      ],
    });

    expect(commandPlan).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      flowStepId: POLICY_AUTHORING_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      interactionRuleId: POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      commandBoundary: 'typed_draft_commands',
      commandCount: 4,
      valid: true,
      riskId: null,
    }));
    expect(commandPlan.commands).toEqual([
      expect.objectContaining({
        commandId: POLICY_DRAFT_COMMAND_IDS.ADD_SIGNAL,
        payload: expect.objectContaining({
          presetId: 'preset-1',
          signalType: 'genres',
          key: 'require_any',
          value: 'Animation',
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          signalType: 'genres',
          key: 'prefer',
          value: 'Family',
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          signalType: 'certifications',
          key: 'max',
          value: 'PG-13',
        }),
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          signalType: 'certifications',
          key: 'exclude',
          value: 'R',
        }),
      }),
    ]);
    expect(commandPlan.commandValidations).toEqual([
      expect.objectContaining({ valid: true }),
      expect.objectContaining({ valid: true }),
      expect.objectContaining({ valid: true }),
      expect.objectContaining({ valid: true }),
    ]);
  });

  test('rejects template application plans with invalid command payloads', () => {
    const commandPlan = buildPolicyAuthoringTemplateApplicationCommands({
      suggestions: [
        {
          templateId: '',
          bucketId: POLICY_AUTHORING_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
          value: 'Animation',
        },
      ],
    });

    expect(commandPlan).toEqual(expect.objectContaining({
      commandCount: 1,
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.INVALID_DRAFT_COMMAND,
    }));
    expect(commandPlan.commandValidations).toEqual([
      expect.objectContaining({
        valid: false,
        missingFields: ['presetId'],
      }),
    ]);
  });

  test('classifies template mechanics as normal accelerator or bridge-only/delete-after-native-storage', () => {
    expect(listPolicyAuthoringStarterTemplateMechanicRecords().map(record => record.mechanicId)).toEqual([
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_DETAILS,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_WEIGHT,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.REMOVED_SIGNAL_MARKERS,
      POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.STRICT_ADVISORY_METADATA,
    ]);

    expect(getPolicyAuthoringStarterTemplateMechanicRecord(POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER))
      .toEqual(expect.objectContaining({
        roleId: POLICY_AUTHORING_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
        workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.REWRITE,
        workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
        normalAuthoringAllowed: true,
        deleteAfterNativeStorage: false,
      }));

    expect(getPolicyAuthoringStarterTemplateMechanicRecord(POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS))
      .toEqual(expect.objectContaining({
        roleId: POLICY_AUTHORING_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
        workflowDecisionId: POLICY_AUTHORING_WORKFLOW_DECISION_IDS.DELETE,
        workflowRoleId: POLICY_AUTHORING_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
        normalAuthoringAllowed: false,
        deleteAfterNativeStorage: true,
      }));
  });

  test('keeps raw template mechanics out of normal authoring', () => {
    expect(validatePolicyAuthoringTemplateMechanicSurface(POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
      }));

    expect(validatePolicyAuthoringTemplateMechanicSurface(POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS))
      .toEqual(expect.objectContaining({
        valid: false,
        riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      }));

    expect(validatePolicyAuthoringTemplateMechanicSurface('unknown_mechanic')).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      reason: 'Unknown starter-template mechanic cannot appear in normal authoring.',
    });
  });

  test('summarizes the starter-template role reset checkpoint', () => {
    expect(summarizePolicyAuthoringStarterTemplates()).toEqual({
      roleCount: 4,
      mechanicCount: 7,
      suggestionBucketIds: [
        POLICY_UX_TERM_IDS.BELONGS_HERE,
        POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
        POLICY_UX_TERM_IDS.HARD_LIMITS,
        POLICY_UX_TERM_IDS.AVOID,
      ],
      normalAuthoringMechanicIds: [
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER,
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_DETAILS,
      ],
      bridgeOnlyOrDeleteMechanicIds: [
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS,
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.TEMPLATE_WEIGHT,
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS,
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.REMOVED_SIGNAL_MARKERS,
        POLICY_AUTHORING_TEMPLATE_MECHANIC_IDS.STRICT_ADVISORY_METADATA,
      ],
      templatesRequiredToSave: false,
      destinationContextRequiredFirst: true,
      applicationCommandId: POLICY_DRAFT_COMMAND_IDS.ADD_SIGNAL,
    });
  });
});
