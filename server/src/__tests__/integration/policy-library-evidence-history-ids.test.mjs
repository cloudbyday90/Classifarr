/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { policyLibraryEvidenceLoader } = await import('../../services/policyLibraryEvidenceLoader.mjs');

test('loads all four evidence sources with exact History keys and repeatable fingerprints', async () => {
  const libraryId = 42;
  const safeId = '101';
  const lower = '9007199254740992';
  const upper = '9007199254740993';
  const max = '9223372036854775807';
  const historyIds = [safeId, lower, upper, max];
  await db.query(`
    INSERT INTO libraries (id, external_id, name, media_type)
    VALUES ($1, 'evidence-fixture', 'Evidence fixture', 'movie')
  `, [libraryId]);
  const { rows: [history] } = await db.query(`
    INSERT INTO classification_history (
      id, library_id, title, media_type, status, confidence, created_at,
      clarification_status, clarification_response, genre_names
    )
    SELECT id, $2, 'Evidence fixture', 'movie', 'routed', 84,
           TIMESTAMP '2026-11-22 10:00:00', 'resolved', '{}'::jsonb, ARRAY['Animation']
      FROM unnest($1::bigint[]) AS id
    RETURNING created_at
  `, [historyIds, libraryId]);
  await db.query(`
    INSERT INTO classification_corrections (id, classification_id, corrected_library_id, created_at)
    VALUES (22, $1, $3, TIMESTAMP '2026-11-22 11:00:00'),
           (2147483647, $2, $3, TIMESTAMP '2026-11-22 11:00:00'),
           (23, NULL, $3, TIMESTAMP '2026-11-22 11:00:00')
  `, [safeId, max, libraryId]);

  const options = {
    libraryId,
    operatorIntent: { belongsHere: ['Animated Movies'] },
    getProfile: async () => ({
      library_id: libraryId,
      item_count: 10,
      genre_distribution: { Animation: 80 },
      last_generated_at: '2026-11-22T08:00:00.000Z',
    }),
    now: Date.parse('2026-11-23T12:00:00.000Z'),
  };
  const first = await policyLibraryEvidenceLoader.loadLibraryEvidence(options);
  expect(first).toMatchObject({ ok: true, statusId: 'ready', evidenceEnvelopeAudit: { ok: true } });
  expect(Object.values(first.sourceSummary).map(({ ok }) => ok)).toEqual([true, true, true, true]);
  expect(first.evidenceEnvelope.sourceSummary).toMatchObject({
    classificationOutcomes: { acceptedCount: 4 },
    manualCorrections: { acceptedCount: 2 },
    pendingItemAnswers: { acceptedCount: 4 },
    arrRoutingOutcomes: { acceptedCount: 4 },
    metadataEvidence: { acceptedCount: 1 },
  });

  const { projection, projectionFingerprint } = first.evidenceEnvelope.evidenceBoundary;
  const entries = Object.values(projection.buckets).flat();
  const expectedHistoryKeys = historyIds.flatMap((id) => [
    `classification:${id}`,
    `pending_answer:classification:${id}`,
    `routing_outcome:classification:${id}`,
  ]);
  const observedAt = history.created_at.toISOString();
  expect(entries).toEqual(expect.arrayContaining(expectedHistoryKeys.map((key) =>
    expect.objectContaining({ key, observedAt }))));
  expect(entries.map(({ key }) => key)).toEqual(expect.arrayContaining([
    `correction:22:classification:${safeId}`,
    `correction:2147483647:classification:${max}`,
  ]));
  expect(entries).toContainEqual(expect.objectContaining({
    key: expect.stringMatching(/^metadata_genre:/), count: 4, observedAt,
  }));
  expect(projectionFingerprint.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  const second = await policyLibraryEvidenceLoader.loadLibraryEvidence(options);
  expect(second.evidenceEnvelope.evidenceBoundary.projectionFingerprint.fingerprint)
    .toBe(projectionFingerprint.fingerprint);
});
