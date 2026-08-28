import { jest } from '@jest/globals';
import {
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
  POLICY_AUTHORING_PROPOSAL_STATUS_IDS,
  buildPolicyAuthoringProposalCandidate,
} from '../../services/policyAuthoringProposalContract.mjs';
import {
  createPolicyAuthoringProposalLifecycleService,
} from '../../services/policyAuthoringProposalLifecycleService.mjs';
import {
  buildPolicyLibraryProfileInitialIntentContract,
} from '../../services/policyLibraryProfileInitialIntent.mjs';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

function buildLibrary() {
  return { id: 6, name: 'Animated Movies', media_type: 'movie' };
}

function buildProfile(overrides = {}) {
  return {
    item_count: 30,
    last_generated_at: '2026-08-03T11:00:00.000Z',
    genre_distribution: { Animation: 80, Family: 45 },
    studio_distribution: { 'Studio Example': 25 },
    ...overrides,
  };
}

function buildCandidate({ library = buildLibrary(), profile = buildProfile() } = {}) {
  const initial = buildPolicyLibraryProfileInitialIntentContract({
    policy: {
      library_id: library.id,
      library_name: library.name,
      library_media_type: library.media_type,
      libraryProfile: profile,
    },
    now: NOW,
  });
  return buildPolicyAuthoringProposalCandidate({ library, profileInitialIntent: initial });
}

function storedProposal(candidate, overrides = {}) {
  return {
    id: 33,
    proposal_reference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
    library_id: 6,
    actor_id: 7,
    proposal_revision: candidate.proposalRevision,
    profile_fingerprint: candidate.profileFingerprint,
    policy_name: candidate.policyName,
    canonical_declared_intent: candidate.declaredIntent,
    display_summary: candidate.displaySummary,
    state: 'prepared',
    expires_at: '2026-08-03T12:15:00.000Z',
    consumed_policy_id: null,
    ...overrides,
  };
}

function createService({ library = buildLibrary(), profile = buildProfile(), policy = null, proposal = null, createResult = null } = {}) {
  const persistence = {
    readLibrary: jest.fn().mockResolvedValue(library),
    readPolicy: jest.fn().mockResolvedValue(policy),
    readProfile: jest.fn().mockResolvedValue(profile),
    insertProposal: jest.fn(),
    lockProposal: jest.fn().mockResolvedValue(proposal),
    consumeProposal: jest.fn().mockResolvedValue(33),
  };
  const createNativePolicy = jest.fn().mockResolvedValue(createResult || {
    policy: { id: 81, library_id: 6, name: 'Animated Movies Policy' },
    nativeIntentEstablishment: { establishment: { replayed: false } },
  });
  const service = createPolicyAuthoringProposalLifecycleService({
    persistence,
    createNativePolicy,
    proposalReferenceFactory: () => 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
  });
  const db = { withTransaction: jest.fn(async work => work({ query: jest.fn() })) };

  return { service, persistence, createNativePolicy, db };
}

describe('policyAuthoringProposalLifecycleService', () => {
  test('reports lifecycle eligibility from one current server-owned profile', async () => {
    const { service, persistence } = createService();

    const result = await service.getLifecycle({ db: {}, libraryId: 6, now: NOW });

    expect(result.statusId).toBe(POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL);
    expect(result.proposal).toEqual({
      available: true,
      reasonId: 'current_profile_candidate_available',
    });
    expect(persistence.readProfile).toHaveBeenCalledWith({ dbClient: {}, libraryId: 6 });
  });

  test('requires profile recovery when there is no current profile candidate', async () => {
    const { service } = createService({ profile: null });

    const result = await service.getLifecycle({ db: {}, libraryId: 6, now: NOW });

    expect(result.statusId).toBe(POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.PROFILE_RECOVERY_REQUIRED);
    expect(result.proposal).toEqual({
      available: false,
      reasonId: 'profile_not_current',
    });
  });

  test('exposes a contextual reconciliation review action for an existing compatibility policy', async () => {
    const { service } = createService({
      policy: { id: 71, library_id: 6, name: 'Compatibility', has_native_intent: false },
    });

    const result = await service.getLifecycle({ db: {}, libraryId: 6, now: NOW });

    expect(result.statusId).toBe(POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY);
    expect(result.action).toEqual({ id: 'review_reconciliation', available: true });
    expect(result.proposal).toEqual({
      available: false,
      reasonId: POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.EXISTING_COMPATIBILITY_POLICY,
    });
  });

  test('prepares an opaque proposal only within a transaction and does not expose canonical rules', async () => {
    const candidate = buildCandidate();
    const { service, persistence, db } = createService();
    persistence.insertProposal.mockResolvedValue(storedProposal(candidate));

    const result = await service.prepareProposal({ db, libraryId: 6, actorId: 7, now: NOW });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PREPARED,
      proposal: expect.objectContaining({
        reference: expect.stringMatching(/^[A-Za-z0-9_-]{32,96}$/),
        revision: candidate.proposalRevision,
        adjustment: {
          purposeGenres: expect.arrayContaining([
            expect.objectContaining({ value: 'Animation', sourceId: 'current_library_profile' }),
          ]),
          helpfulStudios: expect.arrayContaining([
            expect.objectContaining({ value: 'Studio Example', sourceId: 'current_library_profile' }),
          ]),
        },
      }),
    }));
    expect(JSON.stringify(result)).not.toContain('canonical_declared_intent');
    expect(persistence.readLibrary).toHaveBeenCalledWith({ dbClient: expect.any(Object), libraryId: 6, lock: true });
    expect(persistence.readProfile).toHaveBeenCalledWith({ dbClient: expect.any(Object), libraryId: 6, lock: true });
  });

  test('admits a current prepared proposal using server-stored rules only', async () => {
    const candidate = buildCandidate();
    const { service, persistence, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate),
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_AUTHORING_PROPOSAL_STATUS_IDS.CREATED,
      policy: { id: 81, libraryId: 6, name: 'Animated Movies Policy' },
    }));
    expect(createNativePolicy).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 7,
      establishmentRequest: expect.objectContaining({
        idempotency_key: IDEMPOTENCY_KEY,
        declared_intent: candidate.declaredIntent,
      }),
    }));
    expect(persistence.consumeProposal).toHaveBeenCalledWith(expect.objectContaining({
      proposalId: 33,
      policyId: 81,
    }));
  });

  test('rejects a profile revision change without creating a policy', async () => {
    const originalCandidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      profile: buildProfile({ genre_distribution: { Comedy: 80 } }),
      proposal: storedProposal(originalCandidate),
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: originalCandidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE);
    expect(createNativePolicy).not.toHaveBeenCalled();
  });

  test('admits a server-allowed proposal genre narrowing without accepting browser-authored rules', async () => {
    const candidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate),
    });

    await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      adjustmentCommands: [{ commandId: 'set_purpose_genres', values: ['Animation'] }],
      now: NOW,
    });

    expect(createNativePolicy).toHaveBeenCalledWith(expect.objectContaining({
      establishmentRequest: expect.objectContaining({
        declared_intent: expect.objectContaining({
          purpose: expect.arrayContaining([
            expect.objectContaining({
              signal_type: 'genres',
              values: { require_any: ['Animation'] },
            }),
            expect.objectContaining({
              signal_type: 'media_type',
              values: { require_any: ['movie'] },
            }),
          ]),
        }),
      }),
    }));
  });

  test('admits a server-allowed helpful-studio narrowing without changing purpose rules', async () => {
    const profile = buildProfile({
      studio_distribution: { 'Studio Example': 25, 'Studio Second': 20 },
    });
    const candidate = buildCandidate({ profile });
    const { service, createNativePolicy, db } = createService({
      profile,
      proposal: storedProposal(candidate),
    });

    await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      adjustmentCommands: [{ commandId: 'set_helpful_studios', values: ['Studio Example'] }],
      now: NOW,
    });

    expect(createNativePolicy).toHaveBeenCalledWith(expect.objectContaining({
      establishmentRequest: expect.objectContaining({
        declared_intent: expect.objectContaining({
          purpose: candidate.declaredIntent.purpose,
          helpful_hints: expect.arrayContaining([
            expect.objectContaining({
              signal_type: 'studios',
              operator: 'prefer',
              values: expect.objectContaining({ prefer: ['Studio Example'] }),
            }),
          ]),
        }),
      }),
    }));
  });

  test('rejects an adjustment value that is not in the re-derived proposal', async () => {
    const candidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate),
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      adjustmentCommands: [{ commandId: 'set_purpose_genres', values: ['Comedy'] }],
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_STALE);
    expect(createNativePolicy).not.toHaveBeenCalled();
  });

  test('expires a prepared proposal instead of recreating it', async () => {
    const candidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate, { expires_at: '2026-08-03T11:59:59.999Z' }),
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_AUTHORING_PROPOSAL_STATUS_IDS.PROPOSAL_EXPIRED);
    expect(createNativePolicy).not.toHaveBeenCalled();
  });

  test('replays a consumed proposal through the durable native create receipt', async () => {
    const candidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate, {
        state: 'consumed',
        consumed_policy_id: 81,
      }),
      createResult: {
        policy: { id: 81, library_id: 6, name: 'Animated Movies Policy' },
        nativeIntentEstablishment: { establishment: { replayed: true } },
      },
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_AUTHORING_PROPOSAL_STATUS_IDS.REPLAYED);
    expect(createNativePolicy).toHaveBeenCalledTimes(1);
  });

  test('returns the existing-policy outcome before attempting a second policy', async () => {
    const candidate = buildCandidate();
    const { service, createNativePolicy, db } = createService({
      proposal: storedProposal(candidate),
      policy: { id: 71, library_id: 6, name: 'Compatibility', has_native_intent: false },
    });

    const result = await service.admitProposal({
      db,
      libraryId: 6,
      actorId: 7,
      proposalReference: 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA',
      proposalRevision: candidate.proposalRevision,
      idempotencyKey: IDEMPOTENCY_KEY,
      now: NOW,
    });

    expect(result.statusId).toBe(POLICY_AUTHORING_PROPOSAL_STATUS_IDS.EXISTING_POLICY);
    expect(createNativePolicy).not.toHaveBeenCalled();
  });
});
