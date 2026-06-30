import {
  PHASE_2R_DRAFT_COMMAND_IDS,
} from '../../services/policyBuilderPhase2DraftCommandBoundary.mjs';
import {
  PHASE_3R_COMPONENT_IDS,
  PHASE_3R_INTERACTION_RULE_IDS,
} from '../../services/policyBuilderPhase3ComponentSystem.mjs';
import {
  PHASE_3R_DESTINATION_FLOW_STEP_IDS,
} from '../../services/policyBuilderPhase3DestinationFirstFlow.mjs';
import {
  PHASE_3R_WORKFLOW_DECISION_IDS,
  PHASE_3R_WORKFLOW_ROLE_IDS,
} from '../../services/policyBuilderPhase3WorkflowInventory.mjs';
import {
  PHASE_3R_TEMPLATE_MECHANIC_IDS,
  PHASE_3R_TEMPLATE_RISK_IDS,
  PHASE_3R_TEMPLATE_ROLE_IDS,
  PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS,
  buildPhase3RTemplateApplicationCommands,
  getPhase3RStarterTemplateMechanicRecord,
  getPhase3RStarterTemplateRoleRecord,
  listPhase3RStarterTemplateMechanicRecords,
  listPhase3RStarterTemplateRoleRecords,
  normalizePhase3RTemplateSuggestion,
  summarizePhase3RStarterTemplateRoleReset,
  validatePhase3RStarterTemplatePlacement,
  validatePhase3RTemplateMechanicSurface,
  validatePhase3RTemplateSuggestion,
} from '../../services/policyBuilderPhase3StarterTemplateRoleReset.mjs';
import {
  POLICY_UX_TERM_IDS,
} from '../../services/policyUserMentalModel.mjs';

describe('policyBuilderPhase3StarterTemplateRoleReset', () => {
  test('defines starter templates as optional accelerators with secondary provenance', () => {
    expect(listPhase3RStarterTemplateRoleRecords().map(record => record.roleId)).toEqual([
      PHASE_3R_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
      PHASE_3R_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
      PHASE_3R_TEMPLATE_ROLE_IDS.BRIDGE_ONLY_MECHANIC,
      PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
    ]);

    expect(getPhase3RStarterTemplateRoleRecord(PHASE_3R_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR))
      .toEqual(expect.objectContaining({
        normalAuthoringAllowed: true,
        requiresDestinationContext: true,
        canBeRequiredToSave: false,
        componentId: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      }));
  });

  test('maps template suggestions into Phase 0R product vocabulary buckets', () => {
    expect(Object.values(PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS)).toEqual([
      POLICY_UX_TERM_IDS.BELONGS_HERE,
      POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ]);

    expect(normalizePhase3RTemplateSuggestion({
      templateId: 'template-1',
      templateName: 'Animated starter',
      bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
      value: 'Animation',
      explanation: 'Starter template commonly uses Animation as identity.',
    })).toEqual(expect.objectContaining({
      templateId: 'template-1',
      templateName: 'Animated starter',
      bucketId: POLICY_UX_TERM_IDS.BELONGS_HERE,
      value: 'Animation',
      label: 'Animation',
      provenanceRoleId: PHASE_3R_TEMPLATE_ROLE_IDS.SECONDARY_PROVENANCE,
      sourceLabel: 'Starter template suggestion',
      signalType: 'genres',
      key: 'require_any',
    }));
  });

  test('validates template placement after destination context and never as save requirement', () => {
    expect(validatePhase3RStarterTemplatePlacement({
      destinationContextVisible: false,
    })).toEqual({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_BEFORE_DESTINATION_CONTEXT,
      reason: 'Starter templates can appear only after destination context is visible.',
    });

    expect(validatePhase3RStarterTemplatePlacement({
      destinationContextVisible: true,
      templateRequiredToSave: true,
    })).toEqual({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_REQUIRED_FOR_POLICY,
      reason: 'Users must be able to build and save a policy without selecting a starter template.',
    });

    expect(validatePhase3RStarterTemplatePlacement({
      destinationContextVisible: true,
      provenancePrimary: true,
    })).toEqual({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.TEMPLATE_PROVENANCE_PRIMARY,
      reason: 'Starter-template provenance must remain secondary to destination context and declared intent.',
    });

    expect(validatePhase3RStarterTemplatePlacement({
      destinationContextVisible: true,
    })).toEqual({
      valid: true,
      riskId: null,
      reason: 'Starter templates are optional post-destination accelerators.',
    });
  });

  test('rejects unknown template buckets and empty values', () => {
    expect(validatePhase3RTemplateSuggestion({
      bucketId: 'legacy_preset_weight',
      value: 'Animation',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.UNKNOWN_TEMPLATE_BUCKET,
    }));

    expect(validatePhase3RTemplateSuggestion({
      bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.HELPFUL_MATCHES,
      value: '',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.MISSING_TEMPLATE_VALUE,
    }));
  });

  test('builds typed draft commands when applying template suggestions', () => {
    const commandPlan = buildPhase3RTemplateApplicationCommands({
      presetId: 'preset-1',
      suggestions: [
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
          value: 'Animation',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.HELPFUL_MATCHES,
          value: 'Family',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.HARD_LIMITS,
          value: 'PG-13',
        },
        {
          templateId: 'preset-1',
          templateName: 'Animated starter',
          bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.AVOID,
          value: 'R',
        },
      ],
    });

    expect(commandPlan).toEqual(expect.objectContaining({
      componentId: PHASE_3R_COMPONENT_IDS.STARTER_TEMPLATE_SUGGESTION,
      flowStepId: PHASE_3R_DESTINATION_FLOW_STEP_IDS.ACCEPT_OR_EDIT_DECLARED_INTENT,
      interactionRuleId: PHASE_3R_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      commandBoundary: 'typed_draft_commands',
      commandCount: 4,
      valid: true,
      riskId: null,
    }));
    expect(commandPlan.commands).toEqual([
      expect.objectContaining({
        commandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
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
    const commandPlan = buildPhase3RTemplateApplicationCommands({
      suggestions: [
        {
          templateId: '',
          bucketId: PHASE_3R_TEMPLATE_SUGGESTION_BUCKET_IDS.BELONGS_HERE,
          value: 'Animation',
        },
      ],
    });

    expect(commandPlan).toEqual(expect.objectContaining({
      commandCount: 1,
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.INVALID_DRAFT_COMMAND,
    }));
    expect(commandPlan.commandValidations).toEqual([
      expect.objectContaining({
        valid: false,
        missingFields: ['presetId'],
      }),
    ]);
  });

  test('classifies template mechanics as normal accelerator or bridge-only/delete-after-native-storage', () => {
    expect(listPhase3RStarterTemplateMechanicRecords().map(record => record.mechanicId)).toEqual([
      PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_DETAILS,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_WEIGHT,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.REMOVED_SIGNAL_MARKERS,
      PHASE_3R_TEMPLATE_MECHANIC_IDS.STRICT_ADVISORY_METADATA,
    ]);

    expect(getPhase3RStarterTemplateMechanicRecord(PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER))
      .toEqual(expect.objectContaining({
        roleId: PHASE_3R_TEMPLATE_ROLE_IDS.OPTIONAL_ACCELERATOR,
        workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.REWRITE,
        workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.STARTER_TEMPLATE_ACCELERATOR,
        normalAuthoringAllowed: true,
        deleteAfterPhase8R: false,
      }));

    expect(getPhase3RStarterTemplateMechanicRecord(PHASE_3R_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS))
      .toEqual(expect.objectContaining({
        roleId: PHASE_3R_TEMPLATE_ROLE_IDS.DELETE_AFTER_NATIVE_STORAGE,
        workflowDecisionId: PHASE_3R_WORKFLOW_DECISION_IDS.DELETE,
        workflowRoleId: PHASE_3R_WORKFLOW_ROLE_IDS.COMPATIBILITY_BRIDGE,
        normalAuthoringAllowed: false,
        deleteAfterPhase8R: true,
      }));
  });

  test('keeps raw template mechanics out of normal authoring', () => {
    expect(validatePhase3RTemplateMechanicSurface(PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER))
      .toEqual(expect.objectContaining({
        valid: true,
        riskId: null,
      }));

    expect(validatePhase3RTemplateMechanicSurface(PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS))
      .toEqual(expect.objectContaining({
        valid: false,
        riskId: PHASE_3R_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      }));

    expect(validatePhase3RTemplateMechanicSurface('unknown_mechanic')).toEqual({
      valid: false,
      riskId: PHASE_3R_TEMPLATE_RISK_IDS.RAW_TEMPLATE_MECHANIC_IN_NORMAL_FLOW,
      reason: 'Unknown starter-template mechanic cannot appear in normal authoring.',
    });
  });

  test('summarizes the starter-template role reset checkpoint', () => {
    expect(summarizePhase3RStarterTemplateRoleReset()).toEqual({
      roleCount: 4,
      mechanicCount: 7,
      suggestionBucketIds: [
        POLICY_UX_TERM_IDS.BELONGS_HERE,
        POLICY_UX_TERM_IDS.HELPFUL_MATCHES,
        POLICY_UX_TERM_IDS.HARD_LIMITS,
        POLICY_UX_TERM_IDS.AVOID,
      ],
      normalAuthoringMechanicIds: [
        PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_BROWSER,
        PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_DETAILS,
      ],
      bridgeOnlyOrDeleteMechanicIds: [
        PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_MECHANICS,
        PHASE_3R_TEMPLATE_MECHANIC_IDS.TEMPLATE_WEIGHT,
        PHASE_3R_TEMPLATE_MECHANIC_IDS.RAW_CUSTOM_SIGNALS,
        PHASE_3R_TEMPLATE_MECHANIC_IDS.REMOVED_SIGNAL_MARKERS,
        PHASE_3R_TEMPLATE_MECHANIC_IDS.STRICT_ADVISORY_METADATA,
      ],
      templatesRequiredToSave: false,
      destinationContextRequiredFirst: true,
      applicationCommandId: PHASE_2R_DRAFT_COMMAND_IDS.ADD_SIGNAL,
    });
  });
});
