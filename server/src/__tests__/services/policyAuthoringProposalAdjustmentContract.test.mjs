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
    helpful_hints: [],
    avoid: [],
  };
}

describe('policyAuthoringProposalAdjustmentContract', () => {
  test('exposes only bounded current-proposal genre values for the adjustment disclosure', () => {
    expect(buildPolicyAuthoringProposalAdjustmentPresentation(buildDeclaredIntent())).toEqual({
      purposeGenres: [
        { value: 'Animation', sourceId: 'current_library_profile' },
        { value: 'Family', sourceId: 'current_library_profile' },
      ],
    });
  });

  test('accepts one typed narrowing command and preserves non-genre proposal rules', () => {
    const commands = normalizePolicyAuthoringProposalAdjustmentCommands([{
      command_id: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
      values: ['Animation'],
    }]);

    expect(commands).toEqual([{
      commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
      values: ['Animation'],
    }]);
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
      helpful_hints: [],
      avoid: [],
    });
  });

  test('fails closed for duplicate, empty, or non-proposed genre values', () => {
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
  });
});
