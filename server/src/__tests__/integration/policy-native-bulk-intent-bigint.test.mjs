/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeAll, expect, jest, test } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { fetchActiveNativeIntentForPolicy, fetchActiveNativeIntentsForPolicies } =
  await import('../../services/policyNativePolicyReadService.mjs');
const { getActivePolicies } = await import('../../services/policyEngineQueries.mjs');

const cases = [
  { tag: 'safe', intentId: 120, arrType: 'radarr' },
  { tag: 'int32-boundary', intentId: 2147483648, arrType: 'radarr' },
  { tag: 'lower', intentId: '9007199254740992', arrType: 'radarr' },
  { tag: 'upper', intentId: '9007199254740993', arrType: 'sonarr' },
  { tag: 'maximum', intentId: '9223372036854775807', arrType: 'radarr' },
];
const fixtures = [];

async function seedIntent({ tag, intentId, arrType }, now) {
  const { policyId, libraryId, presetId } = await createPolicyEngineIntegrationFixture(db, {
    libraryName: `Native reader ${tag}`,
    libraryMediaType: arrType === 'sonarr' ? 'tv' : 'movie',
    policyName: `Native reader ${tag}`,
  });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  await db.query("SELECT setval(pg_get_serial_sequence('policy_intents', 'id'), $1::bigint, false)", [intentId]);
  const established = await applyPolicyInitialIntentEstablishment({
    dbClient: db,
    policyId,
    actorId: 1,
    request: {
      schema_version: 1,
      idempotency_key: randomUUID(),
      declared_intent: {
        purpose: [{ signal_type: 'genres', operator: 'include', values: { include: [tag] } }],
      },
    },
    now,
  });
  expect(established.establishment).toMatchObject({ applied: true, intentId });

  await db.query(`INSERT INTO policy_intent_template_applications
    (intent_id, preset_id, preset_key, preset_name, weight, signal_count)
    VALUES ($1, $2, $3, $3, 1, 1)`, [intentId, presetId, tag]);
  await db.query(`INSERT INTO policy_intent_validation_status
    (intent_id, status, validator_version, validated_at)
    SELECT intent_id, 'valid', $2, validated_at + interval '1 second'
    FROM policy_intent_validation_status
    WHERE intent_id = $1
    ORDER BY validated_at DESC, id DESC
    LIMIT 1`, [intentId, tag]);
  await db.query(`INSERT INTO policy_intent_routing_targets
    (intent_id, library_id, arr_type, target_status)
    VALUES ($1, $2, $3, 'configured')`, [intentId, libraryId, arrType]);

  return { policyId, intentId, tag, arrType, now };
}

beforeAll(async () => {
  await db.query(`INSERT INTO users (id, username, password_hash, role)
    VALUES (1, 'bulk-intent-fixture', 'synthetic-not-a-credential', 'admin') ON CONFLICT (id) DO NOTHING`);
  for (const [index, item] of cases.entries()) {
    fixtures.push(await seedIntent(item, new Date(Date.UTC(2026, 10, 27, 12, index))));
  }
});

test('loads all five native child collections in one batch with exact IDs', async () => {
  const calls = [];
  const observed = { query(sql, params) {
    calls.push({ sql, params });
    return db.query(sql, params);
  } };
  const policyIds = fixtures.map(({ policyId }) => policyId);
  const bulk = await fetchActiveNativeIntentsForPolicies(observed, policyIds);

  expect([...bulk.keys()]).toEqual(policyIds);
  expect(calls).toHaveLength(6);
  expect(calls[0]).toMatchObject({
    sql: expect.stringContaining('policy_id = ANY($1::integer[])'),
    params: [policyIds],
  });
  for (const call of calls.slice(1)) {
    expect(call.params).toEqual([fixtures.map(({ intentId }) => intentId)]);
  }

  for (const { policyId, intentId, tag, arrType, now } of fixtures) {
    const individual = await fetchActiveNativeIntentForPolicy(db, policyId);
    const entry = bulk.get(policyId);
    expect(entry).toMatchObject({
      intent: { id: intentId, policy_id: policyId },
      authority: { authoritative: true },
      rules: individual.rules,
      templates: individual.templates,
      validation: individual.validation,
      routingTarget: individual.routingTarget,
      observedEvidenceReference: individual.observedEvidenceReference,
    });
    expect(entry.rules).toEqual([expect.objectContaining({
      intent_id: intentId, values: { include: [tag] },
    })]);
    expect(entry.templates).toEqual([expect.objectContaining({ intent_id: intentId, preset_key: tag })]);
    expect(entry.validation).toMatchObject({ intent_id: intentId, validator_version: tag });
    expect(entry.routingTarget).toMatchObject({ intent_id: intentId, arr_type: arrType, target_status: 'configured' });
    expect(entry.observedEvidenceReference).toMatchObject({
      intent_id: intentId,
      capture_state: 'profile_unavailable',
      expires_at: new Date(now.getTime() + 14 * 86400000),
    });
  }
});

test('loads every native policy without falling back to legacy policy authority', async () => {
  const runtime = await getActivePolicies({ dbClient: db, throwOnError: true });
  for (const { policyId, tag, arrType } of fixtures) {
    expect(runtime.find(policy => policy.id === policyId)).toMatchObject({
      native_intent_active: true,
      policy_runtime_authority: { sourceId: 'native_intent', validationOk: true },
      policy_intent_contract: {
        purpose: [expect.objectContaining({ values: { include: [tag] } })],
        template_links: [expect.objectContaining({ preset_key: tag })],
      },
      policy_intent_authority_context: {
        routing_target: { arr_type: arrType, target_status: 'configured' },
        observed_evidence_reference: { capture_state: 'profile_unavailable' },
      },
      presets: [],
    });
  }
});
