import {
  POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS,
  buildPolicyAuthoringProposalCandidate,
  parseStoredPolicyAuthoringProposal,
  validatePolicyAuthoringProposalAdmissionRequest,
  validatePolicyAuthoringProposalPrepareRequest,
} from '../../services/policyAuthoringProposalContract.mjs';
import {
  buildPolicyLibraryProfileInitialIntentContract,
} from '../../services/policyLibraryProfileInitialIntent.mjs';

const NOW = '2026-08-03T12:00:00.000Z';

function buildProfile() {
  return {
    item_count: 30,
    last_generated_at: '2026-08-03T11:00:00.000Z',
    genre_distribution: { Animation: 80, Family: 45 },
    studio_distribution: { 'Studio Example': 25 },
  };
}

function buildCandidate() {
  const library = { id: 6, name: 'Animated Movies', media_type: 'movie' };
  const profileInitialIntent = buildPolicyLibraryProfileInitialIntentContract({
    policy: {
      library_id: library.id,
      library_name: library.name,
      library_media_type: library.media_type,
      libraryProfile: buildProfile(),
    },
    now: NOW,
  });

  return buildPolicyAuthoringProposalCandidate({ library, profileInitialIntent });
}

describe('policyAuthoringProposalContract', () => {
  test('derives validated persisted rules and a revision from the server profile contract', () => {
    const candidate = buildCandidate();

    expect(candidate).toEqual(expect.objectContaining({
      libraryId: 6,
      policyName: 'Animated Movies Policy',
      profileFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      proposalRevision: expect.stringMatching(/^[a-f0-9]{64}$/),
      declaredIntent: expect.objectContaining({
        purpose: expect.arrayContaining([
          expect.objectContaining({
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Animation', 'Family'] },
          }),
          expect.objectContaining({
            signal_type: 'media_type',
            values: { require_any: ['movie'] },
          }),
        ]),
      }),
      displaySummary: expect.objectContaining({
        title: 'Animated Movies Policy',
      }),
    }));
  });

  test('requires an exact revision and empty adjustment command list', () => {
    const candidate = buildCandidate();

    expect(validatePolicyAuthoringProposalAdmissionRequest({
      proposal_revision: candidate.proposalRevision,
      adjustment_commands: [],
    })).toEqual({
      ok: true,
      value: {
        proposalRevision: candidate.proposalRevision,
        adjustmentCommands: [],
      },
      errorId: null,
    });
    expect(validatePolicyAuthoringProposalAdmissionRequest({
      proposal_revision: candidate.proposalRevision,
      adjustment_commands: [{ operation: 'replace' }],
    })).toEqual(expect.objectContaining({
      ok: false,
      errorId: POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
    }));
    expect(validatePolicyAuthoringProposalPrepareRequest({ ignored: true })).toEqual({
      ok: false,
      errorId: POLICY_AUTHORING_PROPOSAL_ADMISSION_ERROR_IDS.INVALID_REQUEST,
    });
  });

  test('fails closed for malformed persisted proposal records', () => {
    expect(parseStoredPolicyAuthoringProposal({
      proposal_reference: 'not-a-safe-reference',
    })).toBeNull();
    expect(parseStoredPolicyAuthoringProposal({
      proposal_reference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposal_revision: 'a'.repeat(64),
      profile_fingerprint: 'b'.repeat(64),
      library_id: 6,
      actor_id: 7,
      expires_at: 'not-a-date',
    })).toBeNull();
  });
});
