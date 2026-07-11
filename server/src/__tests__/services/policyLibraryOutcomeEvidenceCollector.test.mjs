import { jest } from '@jest/globals';
import {
  FINAL_CLASSIFICATION_STATUS_IDS,
  MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS,
  POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS,
  buildPolicyLibraryOutcomeEvidenceCollectorAudit,
  createPolicyLibraryOutcomeEvidenceCollector,
} from '../../services/policyLibraryOutcomeEvidenceCollector.mjs';
import {
  buildPolicyEvidenceEnvelope,
} from '../../services/policyEvidenceEnvelope.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';

function createCollector(rows = {}) {
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows: rows.finalOutcomes || [] })
      .mockResolvedValueOnce({ rows: rows.manualCorrections || [] }),
  };

  return {
    db,
    collector: createPolicyLibraryOutcomeEvidenceCollector({ db }),
  };
}

describe('policyLibraryOutcomeEvidenceCollector', () => {
  test('collects bounded final outcomes and manual corrections with parameterized queries', async () => {
    const { db, collector } = createCollector({
      finalOutcomes: [{
        id: 101,
        status: 'routed',
        confidence: 84,
        created_at: '2026-07-09T12:00:00.000Z',
      }],
      manualCorrections: [{
        id: 22,
        classification_id: 101,
        corrected_library_id: 42,
        created_at: '2026-07-10T08:00:00.000Z',
        corrected_by: 'operator value must not escape',
      }],
    });

    const result = await collector.collectLibraryOutcomeEvidence({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
      libraryId: 42,
      classificationOutcomes: [expect.objectContaining({
        key: 'classification:101',
        label: 'Persisted final classification outcome',
        value: 'routed',
        confidence: 0.84,
        reasonCode: 'persisted_final_outcome',
      })],
      manualCorrections: [expect.objectContaining({
        key: 'correction:22:classification:101',
        label: 'Persisted manual correction to this destination',
        reasonCode: 'persisted_manual_correction',
      })],
      sideEffects: {
        databaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
      },
    }));
    expect(JSON.stringify(result)).not.toContain('operator value must not escape');
    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM classification_history ch'), [
      42,
      FINAL_CLASSIFICATION_STATUS_IDS,
      MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 1,
    ]);
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM classification_corrections cc'), [
      42,
      MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 1,
    ]);
    expect(buildPolicyLibraryOutcomeEvidenceCollectorAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('truncates each read independently without copying titles or metadata', async () => {
    const finalOutcomes = Array.from({ length: MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 2 }, (_, index) => ({
      id: index + 1,
      status: 'completed',
      title: `Title ${index}`,
      metadata: { providerPayload: { title: `Raw ${index}` } },
    }));
    const manualCorrections = Array.from({ length: MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 1 }, (_, index) => ({
      id: index + 1,
      classification_id: index + 100,
      corrected_library_id: 42,
      created_at: '2026-07-10T08:00:00.000Z',
      title: `Correction title ${index}`,
    }));
    const { collector } = createCollector({ finalOutcomes, manualCorrections });

    const result = await collector.collectLibraryOutcomeEvidence({ libraryId: 42 });

    expect(result.classificationOutcomes).toHaveLength(MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS);
    expect(result.manualCorrections).toHaveLength(MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS);
    expect(result.summary).toEqual(expect.objectContaining({
      finalOutcomeRowsRead: MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 2,
      finalOutcomesTruncated: true,
      manualCorrectionRowsRead: MAX_LIBRARY_OUTCOME_EVIDENCE_RECORDS + 1,
      manualCorrectionsTruncated: true,
    }));
    expect(JSON.stringify(result)).not.toContain('Title 0');
    expect(JSON.stringify(result)).not.toContain('Raw 0');
  });

  test('fails closed for invalid IDs or query failures without leaking database errors', async () => {
    const { collector } = createCollector();
    const invalid = await collector.collectLibraryOutcomeEvidence({ libraryId: 'invalid' });
    const failedCollector = createPolicyLibraryOutcomeEvidenceCollector({
      db: { query: jest.fn().mockRejectedValue(new Error('database error must not escape')) },
    });
    const failed = await failedCollector.collectLibraryOutcomeEvidence({ libraryId: 42 });

    expect(invalid).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(failed).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
    }));
    expect(JSON.stringify(failed)).not.toContain('database error must not escape');
  });

  test('detects tampered summary and side-effect records', async () => {
    const { collector } = createCollector({
      finalOutcomes: [{ id: 1, status: 'completed' }],
      manualCorrections: [],
    });
    const result = await collector.collectLibraryOutcomeEvidence({ libraryId: 42 });
    result.summary.finalOutcomeEvidenceCount = 99;
    result.sideEffects.liveProviderLookupPerformed = true;

    const audit = buildPolicyLibraryOutcomeEvidenceCollectorAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_LIBRARY_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });

  test('provides only bounded source records needed by the policy evidence envelope', async () => {
    const { collector } = createCollector({
      finalOutcomes: [{ id: 1, status: 'completed' }],
      manualCorrections: [{
        id: 2,
        classification_id: 1,
        corrected_library_id: 42,
        created_at: '2026-07-10T08:00:00.000Z',
      }],
    });
    const profileHandoff = await loadPolicyLibraryProfileEvidence({
      libraryId: 42,
      now: Date.parse('2026-07-10T12:00:00.000Z'),
      getProfile: async () => ({
        library_id: 42,
        item_count: 10,
        genre_distribution: { Animation: 80 },
        last_generated_at: '2026-07-09T12:00:00.000Z',
      }),
    });
    const outcomeEvidence = await collector.collectLibraryOutcomeEvidence({ libraryId: 42 });

    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      classificationOutcomes: outcomeEvidence.classificationOutcomes,
      manualCorrections: outcomeEvidence.manualCorrections,
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.evidenceBoundary.projection.buckets.compatibility_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ reasonCode: 'persisted_final_outcome' }),
      ]));
    expect(envelope.evidenceBoundary.projection.buckets.outlier_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ reasonCode: 'persisted_manual_correction' }),
      ]));
  });
});
