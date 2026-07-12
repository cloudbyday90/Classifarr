import { jest } from '@jest/globals';
import {
  MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS,
  POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS,
  POLICY_QUESTION_RESOLUTION_TRANSITION,
  RESOLVED_PENDING_ANSWER_STATUS_IDS,
  buildPolicyLibraryPendingAnswerEvidenceCollectorAudit,
  createPolicyLibraryPendingAnswerEvidenceCollector,
} from '../../services/policyLibraryPendingAnswerEvidenceCollector.mjs';
import {
  buildPolicyEvidenceEnvelope,
} from '../../services/policyEvidenceEnvelope.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS,
} from '../../services/policyLibraryEvidenceRecordContract.mjs';

function createCollector(rows = []) {
  const db = {
    query: jest.fn().mockResolvedValue({ rows }),
  };

  return {
    db,
    collector: createPolicyLibraryPendingAnswerEvidenceCollector({ db }),
  };
}

describe('policyLibraryPendingAnswerEvidenceCollector', () => {
  test('collects bounded resolved pending-item state with a fixed parameterized query', async () => {
    const { db, collector } = createCollector([{
      id: 101,
      created_at: '2026-07-09T12:00:00.000Z',
      updated_at: '2026-07-10T08:00:00.000Z',
      clarification_response: { label: 'Raw answer must not escape' },
      discord_user_id: 'operator value must not escape',
    }]);

    const result = await collector.collectLibraryPendingAnswerEvidence({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
      libraryId: 42,
      pendingItemAnswers: [expect.objectContaining({
        key: 'pending_answer:classification:101',
        label: 'Persisted resolved pending-item answer',
        value: 'resolved',
        reasonCode: 'persisted_pending_answer_requires_learning_guard',
        observedAt: '2026-07-10T08:00:00.000Z',
      })],
      sideEffects: {
        databaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        learningMutationPerformed: false,
      },
    }));
    expect(JSON.stringify(result)).not.toContain('Raw answer must not escape');
    expect(JSON.stringify(result)).not.toContain('operator value must not escape');
    const [sql, parameters] = db.query.mock.calls[0];
    expect(sql).toContain('FROM classification_history ch');
    expect(sql).toContain("ch.metadata #> '{classification_details,outcome_path,transitions}'");
    expect(sql).toContain("ch.clarification_status = 'resolved'");
    expect(sql).not.toContain('response_label');
    expect(sql).not.toContain('discord_user_id');
    expect(parameters).toEqual([
      42,
      RESOLVED_PENDING_ANSWER_STATUS_IDS,
      POLICY_QUESTION_RESOLUTION_TRANSITION,
      MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS + 1,
    ]);
    expect(buildPolicyLibraryPendingAnswerEvidenceCollectorAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('truncates resolved answers without copying answer or metadata payloads', async () => {
    const rows = Array.from({ length: MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS + 2 }, (_, index) => ({
      id: index + 1,
      created_at: '2026-07-10T08:00:00.000Z',
      response_label: `Raw answer ${index}`,
      metadata: { selected_option: `Raw metadata ${index}` },
    }));
    const { collector } = createCollector(rows);

    const result = await collector.collectLibraryPendingAnswerEvidence({ libraryId: 42 });

    expect(result.pendingItemAnswers).toHaveLength(MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS);
    expect(result.summary).toEqual({
      maxRecords: MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS,
      resolvedAnswerRowsRead: MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS + 2,
      pendingItemAnswerEvidenceCount: MAX_LIBRARY_PENDING_ANSWER_EVIDENCE_RECORDS,
      resolvedAnswersTruncated: true,
    });
    expect(JSON.stringify(result)).not.toContain('Raw answer 0');
    expect(JSON.stringify(result)).not.toContain('Raw metadata 0');
  });

  test('fails closed for invalid IDs or query failures without leaking database errors', async () => {
    const { collector } = createCollector();
    const invalid = await collector.collectLibraryPendingAnswerEvidence({ libraryId: 'invalid' });
    const failedCollector = createPolicyLibraryPendingAnswerEvidenceCollector({
      db: { query: jest.fn().mockRejectedValue(new Error('database error must not escape')) },
    });
    const failed = await failedCollector.collectLibraryPendingAnswerEvidence({ libraryId: 42 });

    expect(invalid).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(failed).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
    }));
    expect(JSON.stringify(failed)).not.toContain('database error must not escape');
  });

  test('detects tampered summary and side-effect records', async () => {
    const { collector } = createCollector([{ id: 1 }]);
    const result = await collector.collectLibraryPendingAnswerEvidence({ libraryId: 42 });
    result.summary.pendingItemAnswerEvidenceCount = 99;
    result.summary.resolvedAnswersTruncated = true;
    result.pendingItemAnswers[0].reasonCode = 'untrusted_reason';
    result.sideEffects.learningMutationPerformed = true;

    const audit = buildPolicyLibraryPendingAnswerEvidenceCollectorAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNSUPPORTED_REASON_CODE,
      POLICY_LIBRARY_PENDING_ANSWER_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });

  test('provides review-only answer evidence to the policy evidence envelope', async () => {
    const { collector } = createCollector([{ id: 1, updated_at: '2026-07-10T08:00:00.000Z' }]);
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
    const answerEvidence = await collector.collectLibraryPendingAnswerEvidence({ libraryId: 42 });

    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      pendingItemAnswers: answerEvidence.pendingItemAnswers,
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.evidenceBoundary.projection.buckets.insufficient_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'persisted_pending_answer_requires_learning_guard',
          sourceId: 'pending_item_answers',
        }),
      ]));
  });
});
