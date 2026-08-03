import {
  POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS,
  applyPolicyAuthoringProposalAdjustmentCommands,
  buildPolicyAuthoringProposalAdjustmentPresentation,
  normalizePolicyAuthoringProposalAdjustmentCommands,
} from '../../services/policyAuthoringProposalAdjustmentContract.mjs';

function buildDeclaredIntent() {
  return {
    purpose: [
      {
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation', 'Family'] },
      },
      {
        signal_type: 'media_type',
        operator: 'require_any',
        values: { require_any: ['movie'] },
      },
    ],
    hard_limits: [],
    helpful_hints: [
      {
        signal_type: 'studios',
        operator: 'prefer',
        values: { prefer: ['Studio Example', 'Studio Second'] },
      },
    ],
    avoid: [],
  };
}

describe('policyAuthoringProposalAdjustmentContract', () => {
  test('exposes only bounded current-proposal genre and helpful-studio values for the adjustment disclosure', () => {
    expect(buildPolicyAuthoringProposalAdjustmentPresentation(buildDeclaredIntent())).toEqual({
      purposeGenres: [
        { value: 'Animation', sourceId: 'current_library_profile' },
        { value: 'Family', sourceId: 'current_library_profile' },
      ],
      helpfulStudios: [
        { value: 'Studio Example', sourceId: 'current_library_profile' },
        { value: 'Studio Second', sourceId: 'current_library_profile' },
      ],
    });
  });

  test('accepts typed genre and studio narrowing commands while preserving non-adjustable proposal rules', () => {
    const commands = normalizePolicyAuthoringProposalAdjustmentCommands([
      {
        command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
        values: ['Studio Example'],
      },
      {
        command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
        values: ['Animation'],
      },
    ]);

    expect(commands).toEqual([
      {
        commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
        values: ['Animation'],
      },
      {
        commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
        values: ['Studio Example'],
      },
    ]);
    expect(applyPolicyAuthoringProposalAdjustmentCommands({
      declaredIntent: buildDeclaredIntent(),
      adjustmentCommands: commands,
    })).toEqual({
      purpose: [
        {
          signal_type: 'genres',
          operator: 'require_any',
          values: { require_any: ['Animation'] },
        },
        {
          signal_type: 'media_type',
          operator: 'require_any',
          values: { require_any: ['movie'] },
        },
      ],
      hard_limits: [],
      helpful_hints: [
        {
          signal_type: 'studios',
          operator: 'prefer',
          values: { prefer: ['Studio Example'] },
        },
      ],
      avoid: [],
    });
  });

  test('fails closed for duplicate commands, empty selections, or non-proposed values', () => {
    expect(normalizePolicyAuthoringProposalAdjustmentCommands([{
      command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
      values: ['Animation', 'Animation'],
    }])).toBeNull();
    expect(applyPolicyAuthoringProposalAdjustmentCommands({
      declaredIntent: buildDeclaredIntent(),
      adjustmentCommands: [{
        commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
        values: ['Comedy'],
      }],
    })).toBeNull();
    expect(normalizePolicyAuthoringProposalAdjustmentCommands([
      {
        command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
        values: ['Studio Example'],
      },
      {
        command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
        values: ['Studio Second'],
      },
    ])).toBeNull();
    expect(applyPolicyAuthoringProposalAdjustmentCommands({
      declaredIntent: buildDeclaredIntent(),
      adjustmentCommands: [{
        commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
        values: ['Unrelated Studio'],
      }],
    })).toBeNull();
  });
});
