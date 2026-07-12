import { jest } from '@jest/globals';
import {
  buildPolicyDeclaredIntentCommandAudit,
  createPolicyDeclaredIntentCommandService,
  POLICY_DECLARED_INTENT_COMMAND_RISK_IDS,
  POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS,
} from '../../services/policyDeclaredIntentCommand.mjs';

const PROPOSAL_FINGERPRINT = 'a'.repeat(64);

function readyProposal(overrides = {}) {
  return {
    ok: true,
    statusId: 'ready',
    evidenceProvenance: {
      libraryId: 42,
      projectionFingerprint: {
        fingerprint: PROPOSAL_FINGERPRINT,
      },
    },
    handoffAudit: {
      ok: true,
      projectionFingerprint: {
        fingerprint: PROPOSAL_FINGERPRINT,
      },
    },
    intent: {
      version: 'policy.intent.v1',
    },
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    proposalReference: 'proposal-42',
    proposalFingerprint: PROPOSAL_FINGERPRINT,
    actor: {
      id: 7,
      role: 'admin',
      authenticated: true,
    },
    declaredIntent: {
      belongsHere: ['Animated Movies'],
      helpfulMatches: ['Family'],
      hardLimits: ['No NC-17'],
      avoid: ['Live action'],
      routingTargets: ['Radarr Animated Movies'],
    },
    confirmedFields: ['hard_limits'],
    ...overrides,
  };
}

describe('policyDeclaredIntentCommand', () => {
  test('returns an authorized fingerprint-bound declared intent command without writes', async () => {
    const resolveProposal = jest.fn().mockResolvedValue(readyProposal());
    const service = createPolicyDeclaredIntentCommandService({ resolveProposal });

    const result = await service.submitDeclaredIntentCommand(validInput());

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.READY,
      proposal: expect.objectContaining({
        libraryId: 42,
        statusId: 'ready',
        fingerprint: PROPOSAL_FINGERPRINT,
        verifiedHandoffFingerprint: PROPOSAL_FINGERPRINT,
        handoffAuditOk: true,
      }),
      command: expect.objectContaining({
        proposalReference: 'proposal-42',
        proposalFingerprint: PROPOSAL_FINGERPRINT,
        verifiedHandoffFingerprint: PROPOSAL_FINGERPRINT,
        libraryId: 42,
        actor: { id: 7, role: 'admin' },
        authoritySourceId: 'operator_declared_intent',
        declaredIntent: expect.objectContaining({
          hardLimits: ['No NC-17'],
        }),
      }),
      sideEffects: {
        proposalResolved: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        learningMutated: false,
        routingAttempted: false,
      },
      nextStep: expect.objectContaining({ stepId: 'policy_intent_persistence_gate' }),
    }));
    expect(resolveProposal).toHaveBeenCalledWith({
      proposalReference: 'proposal-42',
      actor: { id: 7, role: 'admin' },
    });
    expect(buildPolicyDeclaredIntentCommandAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('rejects an actor that is not an authenticated administrator before proposal lookup', async () => {
    const resolveProposal = jest.fn();
    const service = createPolicyDeclaredIntentCommandService({ resolveProposal });

    const result = await service.submitDeclaredIntentCommand(validInput({
      actor: { id: 7, role: 'user', authenticated: true },
    }));

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.UNAUTHORIZED_ACTOR,
      issues: [expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.UNAUTHORIZED_ACTOR,
      })],
      command: null,
      nextStep: null,
    }));
    expect(resolveProposal).not.toHaveBeenCalled();
  });

  test('rejects malformed commands before proposal lookup', async () => {
    const resolveProposal = jest.fn();
    const service = createPolicyDeclaredIntentCommandService({ resolveProposal });

    const result = await service.submitDeclaredIntentCommand(validInput({
      declaredIntent: {
        belongsHere: ['Animated Movies'],
        providerPayload: { unsafe: true },
      },
    }));

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.INVALID_COMMAND,
      issues: [expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.INVALID_COMMAND,
      })],
    }));
    expect(resolveProposal).not.toHaveBeenCalled();
  });

  test('requires declared destination identity before proposal lookup', async () => {
    const resolveProposal = jest.fn();
    const service = createPolicyDeclaredIntentCommandService({ resolveProposal });

    const result = await service.submitDeclaredIntentCommand(validInput({
      declaredIntent: {
        helpfulMatches: ['Family'],
      },
      confirmedFields: [],
    }));

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.INVALID_COMMAND,
      issues: [expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.MISSING_DESTINATION_IDENTITY,
      })],
    }));
    expect(resolveProposal).not.toHaveBeenCalled();
  });

  test('rejects a stale proposal fingerprint and unconfirmed hard limits', async () => {
    const service = createPolicyDeclaredIntentCommandService({
      resolveProposal: jest.fn().mockResolvedValue(readyProposal()),
    });

    const staleFingerprint = await service.submitDeclaredIntentCommand(validInput({
      proposalFingerprint: 'b'.repeat(64),
    }));
    const unconfirmedHardLimit = await service.submitDeclaredIntentCommand(validInput({
      confirmedFields: [],
    }));

    expect(staleFingerprint.statusId)
      .toBe(POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_FINGERPRINT_MISMATCH);
    expect(staleFingerprint.issues[0].riskId)
      .toBe(POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_FINGERPRINT_MISMATCH);
    expect(unconfirmedHardLimit.statusId)
      .toBe(POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.CONFIRMATION_REQUIRED);
    expect(unconfirmedHardLimit.issues[0].riskId)
      .toBe(POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.HARD_LIMIT_CONFIRMATION_REQUIRED);
  });

  test('rejects proposal provenance that differs from the verified handoff fingerprint', async () => {
    const service = createPolicyDeclaredIntentCommandService({
      resolveProposal: jest.fn().mockResolvedValue(readyProposal({
        handoffAudit: {
          ok: true,
          projectionFingerprint: {
            fingerprint: 'b'.repeat(64),
          },
        },
      })),
    });

    const result = await service.submitDeclaredIntentCommand(validInput());

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_NOT_READY,
      issues: [expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.VERIFIED_HANDOFF_FINGERPRINT_MISMATCH,
      })],
      nextStep: null,
    }));
  });

  test('sanitizes unavailable proposals and detects unsafe result side effects', async () => {
    const service = createPolicyDeclaredIntentCommandService({
      resolveProposal: jest.fn().mockRejectedValue(new Error('proposal storage details must not escape')),
    });

    const result = await service.submitDeclaredIntentCommand(validInput());

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_DECLARED_INTENT_COMMAND_STATUS_IDS.PROPOSAL_UNAVAILABLE,
      issues: [expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.PROPOSAL_UNAVAILABLE,
      })],
    }));
    expect(JSON.stringify(result)).not.toContain('proposal storage details must not escape');

    const readyService = createPolicyDeclaredIntentCommandService({
      resolveProposal: jest.fn().mockResolvedValue(readyProposal()),
    });
    const ready = await readyService.submitDeclaredIntentCommand(validInput());
    ready.sideEffects.policyStorageMutated = true;
    ready.command.proposalFingerprint = 'c'.repeat(64);
    ready.command.verifiedHandoffFingerprint = 'd'.repeat(64);

    expect(buildPolicyDeclaredIntentCommandAudit(ready).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.UNSAFE_SIDE_EFFECT,
      }),
      expect.objectContaining({
        riskId: POLICY_DECLARED_INTENT_COMMAND_RISK_IDS.COMMAND_FAILED,
      }),
    ]));
  });
});
