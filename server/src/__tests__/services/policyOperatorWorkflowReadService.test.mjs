import { jest } from '@jest/globals';
import {
  buildPolicyOperatorWorkflowReadAudit,
  createPolicyOperatorWorkflowReadService,
  POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS,
} from '../../services/policyOperatorWorkflowReadService.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';

const NOW = Date.parse('2026-07-19T12:00:00.000Z');

function buildProfile(overrides = {}) {
  return {
    library_id: 42,
    item_count: 10,
    genre_distribution: { Animation: 80, Family: 50 },
    rating_distribution: { PG: 70 },
    last_generated_at: '2026-07-19T11:00:00.000Z',
    ...overrides,
  };
}

function buildService({ profile = buildProfile() } = {}) {
  const loadProfileEvidence = jest.fn(({ libraryId }) => loadPolicyLibraryProfileEvidence({
    libraryId,
    getProfile: jest.fn().mockResolvedValue(profile),
    now: NOW,
  }));

  return {
    loadProfileEvidence,
    service: createPolicyOperatorWorkflowReadService({ loadProfileEvidence }),
  };
}

describe('policyOperatorWorkflowReadService', () => {
  test('returns cached observations and the five-section workflow without declaring observed values', async () => {
    const { service, loadProfileEvidence } = buildService();

    const result = await service.getWorkflow({
      library: { id: 42, name: 'Animated Movies', media_type: 'movie' },
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'radarr library mapping',
      },
    });

    expect(loadProfileEvidence).toHaveBeenCalledWith({ libraryId: 42 });
    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.READY,
      library: {
        id: 42,
        name: 'Animated Movies',
        mediaType: 'movie',
      },
      observedProfile: expect.objectContaining({
        available: true,
        current: true,
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            label: 'Animation',
            sourceId: 'observed_in_library',
            requiresExplicitAcceptance: true,
          }),
        ]),
      }),
      workflow: expect.objectContaining({
        sectionOrder: [
          'what_belongs_here',
          'what_should_not_go_here',
          'what_helps_but_should_not_decide_alone',
          'when_should_classifarr_ask',
          'can_this_route',
        ],
      }),
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
      },
      sideEffects: {
        cachedProfileRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        routingExecuted: false,
      },
      rawPayloadExposed: false,
    }));
    expect(result.workflow.sections.find(section => section.sectionId === 'what_belongs_here').entries)
      .toEqual([]);
    expect(buildPolicyOperatorWorkflowReadAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('keeps stale cached evidence visible but marks it as needing refresh without refreshing it', async () => {
    const { service } = buildService({
      profile: buildProfile({ last_generated_at: '2026-07-01T12:00:00.000Z' }),
    });

    const result = await service.getWorkflow({
      library: { id: 42, name: 'Animated Movies', media_type: 'movie' },
    });

    expect(result.statusId).toBe(POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.PROFILE_NEEDS_REFRESH);
    expect(result.observedProfile).toEqual(expect.objectContaining({
      available: true,
      current: false,
      suggestionCount: 3,
    }));
    expect(result.sideEffects.liveMediaServerLookupPerformed).toBe(false);
  });

  test('fails closed to an empty normal workflow when the cached profile is unavailable', async () => {
    const loadProfileEvidence = jest.fn().mockResolvedValue({ ok: false });
    const service = createPolicyOperatorWorkflowReadService({ loadProfileEvidence });

    const result = await service.getWorkflow({
      library: { id: 42, name: 'Animated Movies', media_type: 'movie' },
    });

    expect(result.statusId).toBe(POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.PROFILE_UNAVAILABLE);
    expect(result.observedProfile).toEqual({
      statusId: POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.PROFILE_UNAVAILABLE,
      available: false,
      current: false,
      itemCount: null,
      suggestionCount: 0,
      suggestions: [],
    });
    expect(result.rawPayloadExposed).toBe(false);
    expect(buildPolicyOperatorWorkflowReadAudit(result).ok).toBe(true);
  });

  test('does not attempt a profile read for an invalid library and detects unsafe display changes', async () => {
    const loadProfileEvidence = jest.fn();
    const service = createPolicyOperatorWorkflowReadService({ loadProfileEvidence });

    const result = await service.getWorkflow({
      library: { id: 'invalid', name: '' },
    });

    expect(result.statusId).toBe(POLICY_OPERATOR_WORKFLOW_READ_STATUS_IDS.INVALID_LIBRARY);
    expect(loadProfileEvidence).not.toHaveBeenCalled();

    result.observedProfile.suggestions = [{ requiresExplicitAcceptance: false }];
    result.sideEffects.providerQuotaRead = true;
    result.rawPayloadExposed = true;

    expect(buildPolicyOperatorWorkflowReadAudit(result).issues.map(issue => issue.riskId)).toEqual(
      expect.arrayContaining([
        POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.INVALID_LIBRARY,
        POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.OBSERVED_VALUE_AUTO_DECLARED,
        POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
        POLICY_OPERATOR_WORKFLOW_READ_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      ])
    );
  });
});
