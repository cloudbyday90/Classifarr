import { jest } from '@jest/globals';
import {
  buildPolicyDeclaredIntentCommandAudit,
  createPolicyDeclaredIntentCommandService,
} from '../../services/policyDeclaredIntentCommand.mjs';
import {
  buildPolicyIntentProposalRegistryAudit,
  createPolicyIntentProposalRegistry,
  POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS,
} from '../../services/policyIntentProposalRegistry.mjs';

const PROPOSAL_FINGERPRINT = 'a'.repeat(64);

function actor(overrides = {}) {
  return {
    id: 7,
    role: 'admin',
    authenticated: true,
    ...overrides,
  };
}

function readyProposal(overrides = {}) {
  return {
    ok: true,
    statusId: 'ready',
    issueCount: 0,
    issues: [],
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
    intentAudit: { ok: true },
    intent: {
      version: 'policy.intent.v1',
      belongsHere: ['Animated Movies'],
      evidenceBoundary: {
        projectionFingerprint: {
          fingerprint: PROPOSAL_FINGERPRINT,
        },
      },
    },
    ...overrides,
  };
}

function createRegistry(overrides = {}) {
  return createPolicyIntentProposalRegistry({
    now: () => 1_000,
    createReference: () => 'opaque-proposal-reference',
    ...overrides,
  });
}

describe('policyIntentProposalRegistry', () => {
  test('registers a verified proposal as an opaque actor-scoped reference without exposing proposal content', () => {
    const registry = createRegistry();
    const proposal = readyProposal();

    const result = registry.registerProposal({ proposal, actor: actor() });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTERED,
      registration: {
        proposalReference: 'opaque-proposal-reference',
        proposalFingerprint: PROPOSAL_FINGERPRINT,
        libraryId: 42,
        expiresAt: '1970-01-01T00:10:01.000Z',
      },
      sideEffects: expect.objectContaining({
        proposalRegistered: true,
        policyStorageMutated: false,
        learningMutated: false,
        routingAttempted: false,
      }),
    }));
    expect(JSON.stringify(result)).not.toContain('Animated Movies');
    expect(buildPolicyIntentProposalRegistryAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });

    proposal.intent.belongsHere[0] = 'Mutated after registration';
    expect(registry.resolveProposal({
      proposalReference: result.registration.proposalReference,
      actor: actor(),
    })).toEqual(expect.objectContaining({
      intent: expect.objectContaining({ belongsHere: ['Animated Movies'] }),
    }));
  });

  test('resolves only the owner-bound proposal and integrates with the declared intent command', async () => {
    const registry = createRegistry();
    const registration = registry.registerProposal({ proposal: readyProposal(), actor: actor() });
    const commandService = createPolicyDeclaredIntentCommandService({
      resolveProposal: registry.resolveProposalForCommand,
    });

    expect(registry.resolveProposal({
      proposalReference: registration.registration.proposalReference,
      actor: actor({ id: 8 }),
    })).toBeNull();
    expect(registry.resolveProposal({
      proposalReference: registration.registration.proposalReference,
      actor: { id: 7, role: 'admin' },
    })).toBeNull();

    const result = await commandService.submitDeclaredIntentCommand({
      proposalReference: registration.registration.proposalReference,
      proposalFingerprint: PROPOSAL_FINGERPRINT,
      actor: actor(),
      declaredIntent: {
        belongsHere: ['Animated Movies'],
      },
      confirmedFields: [],
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, statusId: 'ready' }));
    expect(buildPolicyDeclaredIntentCommandAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('expires references server-side and never resolves an expired proposal', () => {
    let nowMs = 1_000;
    const registry = createPolicyIntentProposalRegistry({
      now: () => nowMs,
      proposalTtlMs: 100,
      createReference: () => 'expiring-reference',
    });
    const registration = registry.registerProposal({ proposal: readyProposal(), actor: actor() });
    nowMs += 100;

    expect(registry.resolveProposal({
      proposalReference: registration.registration.proposalReference,
      actor: actor(),
    })).toBeNull();

    const result = registry.consumeProposal({
      proposalReference: registration.registration.proposalReference,
      proposalFingerprint: PROPOSAL_FINGERPRINT,
      actor: actor(),
    });
    expect(result.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_UNAVAILABLE);
  });

  test('refuses stale fingerprints and permits exactly one successful consumption', () => {
    const registry = createRegistry();
    const registration = registry.registerProposal({ proposal: readyProposal(), actor: actor() });
    const input = {
      proposalReference: registration.registration.proposalReference,
      actor: actor(),
    };

    const mismatch = registry.consumeProposal({
      ...input,
      proposalFingerprint: 'b'.repeat(64),
    });
    const consumed = registry.consumeProposal({
      ...input,
      proposalFingerprint: PROPOSAL_FINGERPRINT,
    });
    const replay = registry.consumeProposal({
      ...input,
      proposalFingerprint: PROPOSAL_FINGERPRINT,
    });

    expect(mismatch.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_FINGERPRINT_MISMATCH);
    expect(consumed).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.CONSUMED,
      sideEffects: expect.objectContaining({ proposalConsumed: true }),
    }));
    expect(replay.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.PROPOSAL_UNAVAILABLE);
    expect(registry.resolveProposal(input)).toBeNull();
  });

  test('revalidates the stored verified proposal before resolving and consuming it', () => {
    const buildProposalAudit = jest.fn(proposal => ({
      ok: proposal.handoffAudit?.projectionFingerprint?.fingerprint === PROPOSAL_FINGERPRINT,
      issueCount: 0,
      issues: [],
    }));
    const registry = createPolicyIntentProposalRegistry({ buildProposalAudit });
    const registration = registry.registerProposal({ proposal: readyProposal(), actor: actor() });

    expect(buildProposalAudit).toHaveBeenCalledTimes(1);
    expect(registry.resolveProposal({
      proposalReference: registration.registration.proposalReference,
      actor: actor(),
    })).toEqual(expect.objectContaining({ ok: true }));
    expect(buildProposalAudit).toHaveBeenCalledTimes(2);

    expect(registry.consumeProposal({
      proposalReference: registration.registration.proposalReference,
      proposalFingerprint: PROPOSAL_FINGERPRINT,
      actor: actor(),
    })).toEqual(expect.objectContaining({ ok: true }));
    expect(buildProposalAudit).toHaveBeenCalledTimes(3);
  });

  test('fails closed for invalid proposals, unauthorized callers, and bounded capacity', () => {
    const actorBoundRegistry = createRegistry({ maximumEntries: 2, maximumEntriesPerActor: 1 });
    const unauthorized = actorBoundRegistry.registerProposal({
      proposal: readyProposal(),
      actor: actor({ role: 'user' }),
    });
    const invalidProposal = actorBoundRegistry.registerProposal({
      proposal: readyProposal({ intentAudit: { ok: false } }),
      actor: actor(),
    });
    const first = actorBoundRegistry.registerProposal({ proposal: readyProposal(), actor: actor() });
    const actorCapacity = actorBoundRegistry.registerProposal({ proposal: readyProposal(), actor: actor() });
    const globalBoundRegistry = createRegistry({ maximumEntries: 1, maximumEntriesPerActor: 1 });
    globalBoundRegistry.registerProposal({ proposal: readyProposal(), actor: actor() });
    const registryCapacity = globalBoundRegistry.registerProposal({
      proposal: readyProposal(),
      actor: actor({ id: 8 }),
    });

    expect(unauthorized.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.UNAUTHORIZED_ACTOR);
    expect(invalidProposal.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.INVALID_PROPOSAL);
    expect(first.ok).toBe(true);
    expect(actorCapacity.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.ACTOR_CAPACITY_REACHED);
    expect(registryCapacity.statusId).toBe(POLICY_INTENT_PROPOSAL_REGISTRY_STATUS_IDS.REGISTRY_CAPACITY_REACHED);
  });

  test('detects tampered registry result fields and unsafe side effects', () => {
    const registry = createRegistry();
    const result = registry.registerProposal({ proposal: readyProposal(), actor: actor() });
    result.intent = readyProposal().intent;
    result.sideEffects.policyStorageMutated = true;

    expect(buildPolicyIntentProposalRegistryAudit(result).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'invalid_registry_result' }),
      expect.objectContaining({ riskId: 'unsafe_side_effect' }),
    ]));
  });
});
