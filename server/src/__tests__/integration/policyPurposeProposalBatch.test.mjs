/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  PolicyPurposeProposalBatchService,
} = await import('../../services/policyPurposeProposalBatchService.mjs');
const {
  applyPolicyNativeIntentChange,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
} = await import('../../services/policyNativeIntentChangeService.mjs');

async function createProfilePurposeFixture(fixtureKey) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Purpose Proposal Batch Media Server',
    libraryExternalIdPrefix: `purpose-proposal-batch-${fixtureKey}`,
    libraryName: `Purpose Proposal Batch ${fixtureKey}`,
    policyName: `Purpose Proposal Batch ${fixtureKey} Policy`,
    presetKeyPrefix: `purpose-proposal-batch-${fixtureKey}`,
    presetName: 'Purpose Proposal Batch Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, 3, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
      RETURNING id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT native_intent.id, 'purpose', 'purpose', 'genres', 'require_any',
      jsonb_build_object('require_any', jsonb_build_array($3::text)),
      'advisory', 'identity', 'media_server_library_profile', 'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, `profile-term-${fixtureKey}`]);

  return fixture;
}

async function readVersions(policyIds) {
  const result = await db.query(`
    SELECT policy_id, intent_version, active
    FROM policy_intents
    WHERE policy_id = ANY($1::int[])
    ORDER BY policy_id, intent_version
  `, [policyIds]);
  return result.rows;
}

describe('policy purpose proposal batch integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) await fixture.cleanup();
  });

  test('commits all compatible profile-derived declarations together and rolls back the whole batch on a later child failure', async () => {
    const first = await createProfilePurposeFixture('commit-first');
    const second = await createProfilePurposeFixture('commit-second');
    fixtures.push(first, second);
    const service = new PolicyPurposeProposalBatchService({ db });
    const proposal = await service.getProposal();

    expect(proposal).toEqual(expect.objectContaining({
      statusId: 'ready_for_apply',
      summary: expect.objectContaining({ candidatePolicyCount: 2 }),
      rawPurposeRulesExposed: false,
    }));
    expect(JSON.stringify(proposal)).not.toContain('profile-term-commit-first');

    const applied = await service.applyProposal({
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'c'.repeat(32),
      request: {
        proposal_fingerprint: proposal.proposalFingerprint,
        candidate_policy_ids: proposal.action.candidatePolicyIds,
      },
    });
    expect(applied).toEqual(expect.objectContaining({ statusId: 'applied', policyCount: 2 }));
    expect(await readVersions([first.policyId, second.policyId])).toEqual([
      expect.objectContaining({ policy_id: first.policyId, intent_version: 3, active: false }),
      expect.objectContaining({ policy_id: first.policyId, intent_version: 4, active: true }),
      expect.objectContaining({ policy_id: second.policyId, intent_version: 3, active: false }),
      expect.objectContaining({ policy_id: second.policyId, intent_version: 4, active: true }),
    ]);

    const rollbackFirst = await createProfilePurposeFixture('rollback-first');
    const rollbackSecond = await createProfilePurposeFixture('rollback-second');
    fixtures.push(rollbackFirst, rollbackSecond);
    let writerCallCount = 0;
    const rollbackService = new PolicyPurposeProposalBatchService({
      db,
      applyChange: async args => {
        writerCallCount += 1;
        if (writerCallCount === 1) return applyPolicyNativeIntentChange(args);
        return {
          statusId: POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION,
          change: { replayed: false },
        };
      },
    });
    const rollbackProposal = await rollbackService.getProposal();
    const rolledBack = await rollbackService.applyProposal({
      actorId: 1,
      actorRole: 'admin',
      idempotencyKey: 'd'.repeat(32),
      request: {
        proposal_fingerprint: rollbackProposal.proposalFingerprint,
        candidate_policy_ids: rollbackProposal.action.candidatePolicyIds,
      },
    });

    expect(rolledBack.statusId).toBe('proposal_stale');
    expect(writerCallCount).toBe(2);
    expect(await readVersions([rollbackFirst.policyId, rollbackSecond.policyId])).toEqual([
      expect.objectContaining({ policy_id: rollbackFirst.policyId, intent_version: 3, active: true }),
      expect.objectContaining({ policy_id: rollbackSecond.policyId, intent_version: 3, active: true }),
    ]);
  });
});
