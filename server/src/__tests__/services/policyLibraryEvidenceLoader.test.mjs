import { jest } from '@jest/globals';
import {
  createPolicyLibraryMetadataEvidenceCollector,
} from '../../services/policyLibraryMetadataEvidenceCollector.mjs';
import {
  createPolicyLibraryEvidenceLoader,
  POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS,
  POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS,
  buildPolicyLibraryEvidenceLoaderAudit,
} from '../../services/policyLibraryEvidenceLoader.mjs';
import {
  createPolicyLibraryOutcomeEvidenceCollector,
} from '../../services/policyLibraryOutcomeEvidenceCollector.mjs';
import {
  createPolicyLibraryPendingAnswerEvidenceCollector,
} from '../../services/policyLibraryPendingAnswerEvidenceCollector.mjs';
import {
  createPolicyLibraryRoutingOutcomeEvidenceCollector,
  ROUTING_OUTCOME_STATE_IDS,
} from '../../services/policyLibraryRoutingOutcomeEvidenceCollector.mjs';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');

function createReadyLoader() {
  const outcomeDb = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, classification_id: 1, corrected_library_id: 42 }] }),
  };
  const pendingAnswerDb = {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
  };
  const routingDb = {
    query: jest.fn().mockResolvedValue({ rows: [{
      id: 1,
      routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED,
    }] }),
  };
  const metadataDb = {
    query: jest.fn().mockResolvedValue({ rows: [{
      genre_name: 'Animation',
      occurrence_count: 3,
    }] }),
  };
  const outcomeCollector = createPolicyLibraryOutcomeEvidenceCollector({ db: outcomeDb });
  const pendingAnswerCollector = createPolicyLibraryPendingAnswerEvidenceCollector({ db: pendingAnswerDb });
  const routingOutcomeCollector = createPolicyLibraryRoutingOutcomeEvidenceCollector({ db: routingDb });
  const metadataCollector = createPolicyLibraryMetadataEvidenceCollector({ db: metadataDb });

  return {
    loader: createPolicyLibraryEvidenceLoader({
      outcomeCollector,
      pendingAnswerCollector,
      routingOutcomeCollector,
      metadataCollector,
    }),
    collectors: {
      outcomeCollector,
      pendingAnswerCollector,
      routingOutcomeCollector,
      metadataCollector,
    },
    databases: {
      outcomeDb,
      pendingAnswerDb,
      routingDb,
      metadataDb,
    },
  };
}

function getCurrentProfile() {
  return {
    library_id: 42,
    item_count: 10,
    genre_distribution: { Animation: 80 },
    last_generated_at: '2026-07-09T12:00:00.000Z',
  };
}

describe('policyLibraryEvidenceLoader', () => {
  test('composes audited profile and source snapshots into one bounded envelope', async () => {
    const { loader, databases } = createReadyLoader();
    const result = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.READY,
      libraryId: 42,
      profileHandoff: expect.objectContaining({
        libraryId: 42,
        statusId: 'ready',
      }),
      evidenceEnvelope: expect.objectContaining({ ok: true, statusId: 'ready' }),
      evidenceEnvelopeAudit: { ok: true, issueCount: 0, issues: [] },
      sideEffects: {
        libraryProfileRead: true,
        sourceDatabaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        evidenceEnvelopeBuilt: true,
        policyStorageMutated: false,
      },
    }));
    expect(Object.values(result.sourceSummary)).toHaveLength(4);
    expect(Object.values(result.sourceSummary).every(source => source.ok === true)).toBe(true);
    expect(databases.outcomeDb.query).toHaveBeenCalledTimes(2);
    expect(databases.pendingAnswerDb.query).toHaveBeenCalledTimes(1);
    expect(databases.routingDb.query).toHaveBeenCalledTimes(1);
    expect(databases.metadataDb.query).toHaveBeenCalledTimes(1);
    expect(result.evidenceEnvelope.sourceSummary).toEqual({
      classificationOutcomes: { receivedCount: 1, acceptedCount: 1, truncated: false },
      manualCorrections: { receivedCount: 1, acceptedCount: 1, truncated: false },
      pendingItemAnswers: { receivedCount: 1, acceptedCount: 1, truncated: false },
      arrRoutingOutcomes: { receivedCount: 1, acceptedCount: 1, truncated: false },
      metadataEvidence: { receivedCount: 1, acceptedCount: 1, truncated: false },
    });
    expect(buildPolicyLibraryEvidenceLoaderAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('blocks before source reads when the profile handoff is unavailable', async () => {
    const { loader, databases } = createReadyLoader();
    const result = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => null,
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.BLOCKED_BY_PROFILE,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.PROFILE_NOT_READY,
      })],
      evidenceEnvelope: null,
      nextStep: null,
    }));
    expect(databases.outcomeDb.query).not.toHaveBeenCalled();
    expect(databases.pendingAnswerDb.query).not.toHaveBeenCalled();
    expect(databases.routingDb.query).not.toHaveBeenCalled();
    expect(databases.metadataDb.query).not.toHaveBeenCalled();
    expect(buildPolicyLibraryEvidenceLoaderAudit(result).ok).toBe(true);
  });

  test('fails closed when any source collector is unavailable or fails', async () => {
    const sourceFailure = {
      collectLibraryOutcomeEvidence: jest.fn().mockResolvedValue({
        ok: false,
        statusId: 'collection_failed',
        issueCount: 1,
        issues: [{ riskId: 'collection_failed' }],
        summary: {},
        sideEffects: { databaseRead: true },
      }),
    };
    const { collectors } = createReadyLoader();
    const failedLoader = createPolicyLibraryEvidenceLoader({
      outcomeCollector: sourceFailure,
      pendingAnswerCollector: collectors.pendingAnswerCollector,
      routingOutcomeCollector: collectors.routingOutcomeCollector,
      metadataCollector: collectors.metadataCollector,
    });
    const result = await failedLoader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.BLOCKED_BY_SOURCE_COLLECTION,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.SOURCE_COLLECTION_FAILED,
      })],
      evidenceEnvelope: null,
      nextStep: null,
    }));
    expect(JSON.stringify(result)).not.toContain('database error');
    expect(buildPolicyLibraryEvidenceLoaderAudit(result).ok).toBe(true);
  });

  test('rejects invalid IDs without calling profile or source loaders', async () => {
    const loadProfileEvidence = jest.fn();
    const outcomeCollector = { collectLibraryOutcomeEvidence: jest.fn() };
    const loader = createPolicyLibraryEvidenceLoader({
      loadProfileEvidence,
      outcomeCollector,
    });

    const result = await loader.loadLibraryEvidence({ libraryId: 'invalid' });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(loadProfileEvidence).not.toHaveBeenCalled();
    expect(outcomeCollector.collectLibraryOutcomeEvidence).not.toHaveBeenCalled();
  });

  test('detects tampered source audits, unsafe side effects, and blocked next steps', async () => {
    const { loader } = createReadyLoader();
    const result = await loader.loadLibraryEvidence({
      libraryId: 42,
      getProfile: async () => getCurrentProfile(),
      now: NOW,
    });
    result.sourceSummary.outcomes.audit.ok = false;
    result.sideEffects.liveProviderLookupPerformed = true;
    result.ok = false;
    result.nextStep = { stepId: 'intent_inference' };

    const audit = buildPolicyLibraryEvidenceLoaderAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });
});
