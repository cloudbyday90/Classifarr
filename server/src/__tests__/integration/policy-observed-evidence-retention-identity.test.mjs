/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { createPolicyEngineIntegrationFixture } = await import('../setup/createPolicyEngineIntegrationFixture.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { PolicyObservedEvidenceProvenanceRetentionService } =
  await import('../../services/policyObservedEvidenceProvenanceRetentionService.mjs');
const { buildPayloadDigest } = await import('../../services/policyObservedEvidenceProvenanceRetentionContract.mjs');
const { SchedulerRetentionService } = await import('../../services/schedulerRetentionService.mjs');

const lockKey = 2010;
const dayMs = 24 * 60 * 60 * 1000;
const establishedAt = new Date();
const expiry = new Date(establishedAt.getTime() + 14 * dayMs).toISOString();
const maximum = '9223372036854775807';

beforeAll(async () => {
  await db.query(`INSERT INTO users (id, username, password_hash, role)
    VALUES (7, 'retention-fixture-admin', 'synthetic-test-data', 'admin') ON CONFLICT (id) DO NOTHING`);
});

function worker(transactionDb = db) {
  return new PolicyObservedEvidenceProvenanceRetentionService({
    db: transactionDb,
    lockKey,
    logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
  });
}

async function establish(tag, { snapshotId, intentId, establishmentId }, now = establishedAt) {
  const tagName = `Observed retention ${tag}`;
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, {
    policyName: tagName, libraryName: tagName,
  });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  await db.query(`INSERT INTO library_profiles
    (library_id, item_count, enriched_count, genre_distribution, last_generated_at, updated_at)
    VALUES ($1, 48, 48, '{"Animation":91.67,"Family":64.58}', $2, $2)`, [libraryId, now.toISOString()]);

  for (const [table, id] of [
    ['policy_intents', intentId],
    ['policy_initial_intent_establishments', establishmentId],
    ['policy_observed_evidence_provenance_snapshots', snapshotId],
  ]) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
  }
  const result = await applyPolicyInitialIntentEstablishment({
    dbClient: db,
    policyId,
    actorId: 7,
    request: {
      schema_version: 1,
      idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['Animation'] } }] },
    },
    now,
  });
  expect(result.establishment).toMatchObject({ id: establishmentId, intentId, applied: true });
  return { policyId, libraryId, snapshotId, intentId, establishmentId };
}

async function getSnapshots(ids) {
  const { rows } = await db.query(`SELECT id, policy_id, library_id, intent_id, establishment_id, capture_state,
      payload_redacted, snapshot_payload, evidence_fingerprint, redacted_at, expires_at
    FROM policy_observed_evidence_provenance_snapshots WHERE id = ANY($1::bigint[]) ORDER BY id`, [ids]);
  return rows;
}

test('preserves the exact safe, adjacent and maximum IDs through scheduled retention', async () => {
  const fixtures = [
    await establish('safe', { snapshotId: 901, intentId: 9011, establishmentId: 9012 }),
    await establish('lower', {
      snapshotId: '9007199254740992', intentId: '9007199254741000', establishmentId: '9007199254741012',
    }),
    await establish('upper', {
      snapshotId: '9007199254740993', intentId: '9007199254741001', establishmentId: '9007199254741013',
    }),
    await establish('maximum', { snapshotId: maximum, intentId: maximum, establishmentId: maximum }),
  ];
  const future = await establish('future', { snapshotId: 902, intentId: 9021, establishmentId: 9022 },
    new Date(establishedAt.getTime() + dayMs));
  const legacy = await establish('legacy marker', {
    snapshotId: 903, intentId: '9007199254741021', establishmentId: '9007199254741023',
  });
  const historicalMarker = { retention_marker: {
    version: 1, intent_id: 9007199254741020, establishment_id: 9007199254741024,
  } };
  await db.query(`UPDATE policy_observed_evidence_provenance_snapshots
    SET payload_redacted = true, redacted_at = $2, snapshot_payload = $3::jsonb WHERE id = $1`,
  [legacy.snapshotId, expiry, JSON.stringify(historicalMarker)]);
  const unaffectedIds = [future.snapshotId, legacy.snapshotId];
  const unaffected = await getSnapshots(unaffectedIds);
  const ids = fixtures.map(entry => entry.snapshotId);
  const before = await getSnapshots(ids);
  expect(before).toHaveLength(4);
  for (const row of before) {
    expect(row).toMatchObject({ capture_state: 'captured', payload_redacted: false });
    expect(row.expires_at.toISOString()).toBe(expiry);
    expect(JSON.stringify(row.snapshot_payload)).toContain('Animation');
  }
  const retention = worker();
  const scheduler = new SchedulerRetentionService({
    policyObservedEvidenceProvenanceRetentionService: { cleanup: () => retention.cleanup({ now: expiry, batchSize: 4 }) },
  });
  const result = await scheduler.runPolicyObservedEvidenceProvenanceRetentionCleanup();
  expect(result).toMatchObject({
    statusId: 'completed', redactedSnapshotCount: 4, redactedSnapshotIds: ids, hasMore: true, rawPayloadExposed: false,
  });
  expect(JSON.stringify(result)).not.toContain('Animation');
  const after = await getSnapshots(ids);
  expect(after).toHaveLength(4);
  for (const [index, row] of after.entries()) {
    const { snapshotId, establishmentId, intentId, policyId, libraryId } = fixtures[index];
    expect(row).toMatchObject({
      id: snapshotId, intent_id: intentId, establishment_id: establishmentId, policy_id: policyId, library_id: libraryId,
      payload_redacted: true, evidence_fingerprint: before[index].evidence_fingerprint,
    });
    expect(row.redacted_at.toISOString()).toBe(expiry);
    expect(row.snapshot_payload).toEqual({ retention_marker: expect.objectContaining({
      version: 1, intent_id: intentId, establishment_id: establishmentId,
      payload_digest: buildPayloadDigest(before[index].snapshot_payload),
    }) });
    expect(JSON.stringify(row.snapshot_payload)).not.toContain('Animation');
  }
  expect(await scheduler.runPolicyObservedEvidenceProvenanceRetentionCleanup()).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: [], redactedSnapshotCount: 0, hasMore: false,
  });
  expect(await getSnapshots(ids)).toEqual(after);
  expect(await getSnapshots(unaffectedIds)).toEqual(unaffected);
  const { rows } = await db.query('SELECT id, active FROM policy_intents WHERE id = ANY($1::bigint[]) ORDER BY id',
    [fixtures.map(entry => entry.intentId)]);
  expect(rows).toEqual(fixtures.map(({ intentId }) => ({ id: intentId, active: true })));
});

test('preserves advisory admission and skips a row locked by another transaction', async () => {
  const first = await establish('locked row', { snapshotId: 911, intentId: 9111, establishmentId: 9112 });
  const second = await establish('available row', { snapshotId: 912, intentId: 9121, establishmentId: 9122 });
  const service = worker();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    expect(await service.cleanup({ now: expiry })).toMatchObject({ statusId: 'cleanup_locked', redactedSnapshotIds: [] });
    await client.query('ROLLBACK');
    await client.query('BEGIN');
    await client.query('SELECT id FROM policy_observed_evidence_provenance_snapshots WHERE id = $1 FOR UPDATE', [first.snapshotId]);
    expect(await service.cleanup({ now: expiry })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [second.snapshotId] });
  } finally {
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  expect(await service.cleanup({ now: expiry })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [first.snapshotId] });
});

test('rolls back both writes when the updated row or typed marker disagrees with the selection', async () => {
  const first = await establish('first write', {
    snapshotId: '9007199254741030', intentId: '9007199254741041', establishmentId: '9007199254741061',
  });
  const second = await establish('second write', {
    snapshotId: '9007199254741031', intentId: '9007199254741042', establishmentId: '9007199254741062',
  });
  const neighbor = await establish('neighbor', {
    snapshotId: '9007199254741032', intentId: '9007199254741043', establishmentId: '9007199254741063',
  });
  const ids = [first.snapshotId, second.snapshotId, neighbor.snapshotId];
  const before = await getSnapshots(ids);
  for (const [selectedId, markerFields, observed] of [
    [neighbor.snapshotId, {}, { id: neighbor.snapshotId }],
    [second.snapshotId, { intent_id: first.intentId }, { id: second.snapshotId, marker_intent_id: first.intentId }],
    [second.snapshotId, { establishment_id: first.establishmentId }, {
      id: second.snapshotId, marker_establishment_id: first.establishmentId,
    }],
    [second.snapshotId, { intent_id: Number(second.intentId) }, {
      id: second.snapshotId, marker_intent_id: Number(second.intentId),
    }],
  ]) {
    let returned;
    const transactionDb = { withTransaction: work => db.withTransaction(client => work({
      query: async (sql, params) => {
        if (!sql.includes('UPDATE policy_observed_evidence_provenance_snapshots') || params[0] !== second.snapshotId) {
          return client.query(sql, params);
        }
        const marker = JSON.parse(params[1]);
        Object.assign(marker.retention_marker, markerFields);
        const result = await client.query(sql, [selectedId, JSON.stringify(marker), params[2]]);
        returned = result.rows[0];
        return result;
      },
    })) };
    expect(await worker(transactionDb).cleanup({ now: expiry, batchSize: 2 })).toMatchObject({
      statusId: 'failed_rolled_back', redactedSnapshotCount: 0, reason: { reasonId: 'snapshot_redaction_not_applied' },
    });
    expect(returned).toMatchObject(observed);
    expect(await getSnapshots(ids)).toEqual(before);
  }
  expect(await worker().cleanup({ now: expiry })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: ids, redactedSnapshotCount: 3,
  });
});
