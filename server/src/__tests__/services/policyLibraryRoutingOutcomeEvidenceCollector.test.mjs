import { jest } from '@jest/globals';
import {
  BLOCKED_ROUTING_REASON_IDS,
  MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS,
  POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS,
  ROUTING_OUTCOME_STATE_IDS,
  SKIPPED_ROUTING_REASON_IDS,
  SUCCESSFUL_ROUTING_REASON_IDS,
  buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit,
  createPolicyLibraryRoutingOutcomeEvidenceCollector,
} from '../../services/policyLibraryRoutingOutcomeEvidenceCollector.mjs';
import {
  buildPolicyEvidenceEnvelope,
} from '../../services/policyEvidenceEnvelope.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../../services/policyLibraryProfileEvidenceLoader.mjs';

function createCollector(rows = []) {
  const db = {
    query: jest.fn().mockResolvedValue({ rows }),
  };

  return {
    db,
    collector: createPolicyLibraryRoutingOutcomeEvidenceCollector({ db }),
  };
}

describe('policyLibraryRoutingOutcomeEvidenceCollector', () => {
  test('collects fixed succeeded, blocked, and skipped states with parameterized queries', async () => {
    const { db, collector } = createCollector([
      { id: 101, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED },
      { id: 102, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.BLOCKED },
      { id: 103, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SKIPPED },
    ]);

    const result = await collector.collectLibraryRoutingOutcomeEvidence({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
      libraryId: 42,
      arrRoutingOutcomes: expect.arrayContaining([
        expect.objectContaining({
          value: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED,
          reasonCode: 'persisted_routing_succeeded',
        }),
        expect.objectContaining({
          value: ROUTING_OUTCOME_STATE_IDS.BLOCKED,
          reasonCode: 'persisted_routing_blocked',
        }),
        expect.objectContaining({
          value: ROUTING_OUTCOME_STATE_IDS.SKIPPED,
          reasonCode: 'persisted_routing_skipped',
        }),
      ]),
      sideEffects: {
        databaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        routeAttemptPerformed: false,
      },
    }));
    const [sql, parameters] = db.query.mock.calls[0];
    expect(sql).toContain('FROM classification_history ch');
    expect(sql).toContain("'{classification_details,routing}'");
    expect(sql).not.toContain('routing_error');
    expect(parameters).toEqual([
      42,
      SUCCESSFUL_ROUTING_REASON_IDS,
      BLOCKED_ROUTING_REASON_IDS,
      SKIPPED_ROUTING_REASON_IDS,
      MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS + 1,
    ]);
    expect(buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('truncates routing outcomes without copying raw route errors or metadata', async () => {
    const rows = Array.from({ length: MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS + 2 }, (_, index) => ({
      id: index + 1,
      routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.BLOCKED,
      routing_error: `Raw route error ${index}`,
      metadata: { classification_details: { routing: `Raw routing value ${index}` } },
    }));
    const { collector } = createCollector(rows);

    const result = await collector.collectLibraryRoutingOutcomeEvidence({ libraryId: 42 });

    expect(result.arrRoutingOutcomes).toHaveLength(MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS);
    expect(result.summary).toEqual({
      maxRecords: MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS,
      routingOutcomeRowsRead: MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS + 2,
      routingOutcomeEvidenceCount: MAX_LIBRARY_ROUTING_OUTCOME_EVIDENCE_RECORDS,
      routingOutcomesTruncated: true,
    });
    expect(JSON.stringify(result)).not.toContain('Raw route error 0');
    expect(JSON.stringify(result)).not.toContain('Raw routing value 0');
  });

  test('fails closed for invalid IDs or query failures without leaking database errors', async () => {
    const { collector } = createCollector();
    const invalid = await collector.collectLibraryRoutingOutcomeEvidence({ libraryId: 'invalid' });
    const failedCollector = createPolicyLibraryRoutingOutcomeEvidenceCollector({
      db: { query: jest.fn().mockRejectedValue(new Error('database error must not escape')) },
    });
    const failed = await failedCollector.collectLibraryRoutingOutcomeEvidence({ libraryId: 42 });

    expect(invalid).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(failed).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
    }));
    expect(JSON.stringify(failed)).not.toContain('database error must not escape');
  });

  test('detects tampered summary, unknown states, and side-effect records', async () => {
    const { collector } = createCollector([{ id: 1, routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED }]);
    const result = await collector.collectLibraryRoutingOutcomeEvidence({ libraryId: 42 });
    result.summary.routingOutcomesTruncated = true;
    result.arrRoutingOutcomes[0].value = 'raw_route_reason';
    result.sideEffects.routeAttemptPerformed = true;

    const audit = buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNKNOWN_OUTCOME_STATE,
      POLICY_LIBRARY_ROUTING_OUTCOME_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });

  test('provides bounded routing evidence to the policy evidence envelope', async () => {
    const { collector } = createCollector([{
      id: 1,
      routing_outcome_state: ROUTING_OUTCOME_STATE_IDS.SUCCEEDED,
      updated_at: '2026-07-10T08:00:00.000Z',
    }]);
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
    const routingEvidence = await collector.collectLibraryRoutingOutcomeEvidence({ libraryId: 42 });

    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      arrRoutingOutcomes: routingEvidence.arrRoutingOutcomes,
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.evidenceBoundary.projection.buckets.routing_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'persisted_routing_succeeded',
          sourceId: 'arr_routing_outcomes',
        }),
      ]));
  });
});
