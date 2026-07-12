import { jest } from '@jest/globals';
import {
  FINAL_METADATA_STATUS_IDS,
  MAX_LIBRARY_METADATA_EVIDENCE_RECORDS,
  POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS,
  POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS,
  buildPolicyLibraryMetadataEvidenceCollectorAudit,
  createPolicyLibraryMetadataEvidenceCollector,
} from '../../services/policyLibraryMetadataEvidenceCollector.mjs';
import { buildPolicyEvidenceEnvelope } from '../../services/policyEvidenceEnvelope.mjs';
import { loadPolicyLibraryProfileEvidence } from '../../services/policyLibraryProfileEvidenceLoader.mjs';
import {
  POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS,
} from '../../services/policyLibraryEvidenceRecordContract.mjs';

function createCollector(rows = []) {
  const db = {
    query: jest.fn().mockResolvedValue({ rows }),
  };

  return {
    db,
    collector: createPolicyLibraryMetadataEvidenceCollector({ db }),
  };
}

describe('policyLibraryMetadataEvidenceCollector', () => {
  test('collects bounded normalized genre facts with a fixed parameterized query', async () => {
    const { db, collector } = createCollector([{
      genre_name: '  Science Fiction  ',
      occurrence_count: 12,
      observed_at: '2026-07-10T08:00:00.000Z',
      provider_payload: { title: 'Raw provider payload must not escape' },
    }]);

    const result = await collector.collectLibraryMetadataEvidence({ libraryId: 42 });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.READY,
      libraryId: 42,
      metadataEvidence: [expect.objectContaining({
        label: 'Persisted metadata genre: Science Fiction',
        value: 'Science Fiction',
        count: 12,
        reasonCode: 'persisted_metadata_genre_compatibility',
        observedAt: '2026-07-10T08:00:00.000Z',
      })],
      sideEffects: {
        databaseRead: true,
        liveMediaServerLookupPerformed: false,
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        policyStorageMutated: false,
        metadataRefreshPerformed: false,
      },
    }));
    expect(result.metadataEvidence[0].key).toMatch(/^metadata_genre:[a-f0-9]{16}$/);
    expect(JSON.stringify(result)).not.toContain('Raw provider payload must not escape');
    const [sql, parameters] = db.query.mock.calls[0];
    expect(sql).toContain('UNNEST(COALESCE(ch.genre_names');
    expect(sql).not.toContain('ch.metadata');
    expect(sql).not.toContain('title');
    expect(parameters).toEqual([
      42,
      FINAL_METADATA_STATUS_IDS,
      MAX_LIBRARY_METADATA_EVIDENCE_RECORDS + 1,
    ]);
    expect(buildPolicyLibraryMetadataEvidenceCollectorAudit(result)).toEqual({
      ok: true,
      issueCount: 0,
      issues: [],
    });
  });

  test('sanitizes invalid metadata facts and truncates bounded reads', async () => {
    const rows = [
      { genre_name: 'Valid Genre', occurrence_count: 2 },
      { genre_name: 'Invalid\nGenre', occurrence_count: 1 },
      ...Array.from({ length: MAX_LIBRARY_METADATA_EVIDENCE_RECORDS }, (_, index) => ({
        genre_name: `Genre ${index}`,
        occurrence_count: 1,
      })),
    ];
    const { collector } = createCollector(rows);

    const result = await collector.collectLibraryMetadataEvidence({ libraryId: 42 });

    expect(result.metadataEvidence).toHaveLength(MAX_LIBRARY_METADATA_EVIDENCE_RECORDS - 1);
    expect(result.summary).toEqual({
      maxRecords: MAX_LIBRARY_METADATA_EVIDENCE_RECORDS,
      metadataGenreRowsRead: MAX_LIBRARY_METADATA_EVIDENCE_RECORDS + 2,
      metadataEvidenceCount: MAX_LIBRARY_METADATA_EVIDENCE_RECORDS - 1,
      invalidMetadataGenreFactCount: 1,
      metadataGenresTruncated: true,
    });
    expect(JSON.stringify(result)).not.toContain('Invalid\\nGenre');
  });

  test('fails closed for invalid IDs or query failures without leaking database errors', async () => {
    const { collector } = createCollector();
    const invalid = await collector.collectLibraryMetadataEvidence({ libraryId: 'invalid' });
    const failedCollector = createPolicyLibraryMetadataEvidenceCollector({
      db: { query: jest.fn().mockRejectedValue(new Error('database error must not escape')) },
    });
    const failed = await failedCollector.collectLibraryMetadataEvidence({ libraryId: 42 });

    expect(invalid).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.INVALID_LIBRARY_ID,
      issues: [expect.objectContaining({
        riskId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_LIBRARY_ID,
      })],
    }));
    expect(failed).toEqual(expect.objectContaining({
      ok: false,
      statusId: POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_STATUS_IDS.COLLECTION_FAILED,
    }));
    expect(JSON.stringify(failed)).not.toContain('database error must not escape');
  });

  test('detects tampered summaries, invalid facts, and side-effect records', async () => {
    const { collector } = createCollector([{ genre_name: 'Animation', occurrence_count: 1 }]);
    const result = await collector.collectLibraryMetadataEvidence({ libraryId: 42 });
    result.summary.metadataGenresTruncated = true;
    result.metadataEvidence[0].value = 'Invalid\nGenre';
    result.metadataEvidence[0].reasonCode = 'untrusted_reason';
    result.sideEffects.metadataRefreshPerformed = true;

    const audit = buildPolicyLibraryMetadataEvidenceCollectorAudit(result);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.SUMMARY_COUNT_MISMATCH,
      POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.INVALID_METADATA_FACT,
      POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNSUPPORTED_REASON_CODE,
      POLICY_LIBRARY_METADATA_EVIDENCE_COLLECTOR_RISK_IDS.UNSAFE_SIDE_EFFECT,
    ]));
  });

  test('provides compatibility-only metadata evidence to the policy evidence envelope', async () => {
    const { collector } = createCollector([{ genre_name: 'Animation', occurrence_count: 3 }]);
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
    const metadataEvidence = await collector.collectLibraryMetadataEvidence({ libraryId: 42 });

    const envelope = buildPolicyEvidenceEnvelope({
      profileHandoff,
      metadataEvidence: metadataEvidence.metadataEvidence,
    });

    expect(envelope.ok).toBe(true);
    expect(envelope.evidenceBoundary.projection.buckets.compatibility_evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'persisted_metadata_genre_compatibility',
          sourceId: 'metadata_enrichment',
        }),
      ]));
    expect(envelope.evidenceBoundary.projection.buckets.identity_evidence)
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceId: 'metadata_enrichment' }),
      ]));
  });
});
