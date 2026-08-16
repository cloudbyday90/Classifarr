/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const {
  policyNativeIntentPurposeChangeReadService,
} = await import('../../services/policyNativeIntentPurposeChangeReadService.mjs');
const {
  applyPolicyNativeIntentChange,
  POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS,
} = await import('../../services/policyNativeIntentChangeService.mjs');

async function createNativePurposeFixture({ fixtureKey, term, intentVersion = 3 }) {
  const fixture = await createPolicyEngineIntegrationFixture(db, {
    mediaServerName: 'Native Purpose Change Media Server',
    libraryExternalIdPrefix: `native-purpose-change-write-${fixtureKey}`,
    libraryName: `Native Purpose Change ${fixtureKey}`,
    policyName: `Native Purpose Change ${fixtureKey} Policy`,
    presetKeyPrefix: `native-purpose-change-write-${fixtureKey}`,
    presetName: 'Native Purpose Change Write Preset',
    presetSignals: {},
  });

  await db.query(`
    WITH native_intent AS (
      INSERT INTO policy_intents (
        policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status
      )
      VALUES ($1, $2, 1, $3, TRUE, 'native_intent', 'inferred', '{}'::jsonb, 'valid')
      RETURNING id
    )
    INSERT INTO policy_intent_rules (
      intent_id, intent_role, collection, signal_type, operator,
      values, constraint_mode, semantics, source, inference_state
    )
    SELECT
      native_intent.id,
      'purpose',
      'purpose',
      'genres',
      'require_any',
      jsonb_build_object('require_any', jsonb_build_array($4::text)),
      'advisory',
      'identity',
      'native_intent',
      'inferred'
    FROM native_intent
  `, [fixture.policyId, fixture.libraryId, intentVersion, term]);

  return fixture;
}

function purposeCommand(term) {
  return {
    command_id: 'update_purpose',
    values: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [term] },
      constraint_mode: 'advisory',
      semantics: 'identity',
    }],
  };
}

describe('native intent purpose change integration', () => {
  const fixtures = [];

  afterAll(async () => {
    for (const fixture of fixtures.reverse()) {
      await fixture.cleanup();
    }
  });

  test('reads a server-owned revision, applies exactly one canonical purpose command, and rejects a stale retry', async () => {
    const fixture = await createNativePurposeFixture({
      fixtureKey: 'target',
      term: 'existing-purpose-token',
    });
    fixtures.push(fixture);

    const before = await policyNativeIntentPurposeChangeReadService.getPurposeChange({
      dbClient: db,
      policyId: fixture.policyId,
    });

    expect(before).toEqual(expect.objectContaining({
      statusId: 'native_intent_purpose_change_available',
      revision: 3,
      changeCommand: expect.objectContaining({ command_id: 'update_purpose' }),
    }));
    expect(before.changeCommand.values[0].values).toEqual({ require_any: ['existing-purpose-token'] });

    const applied = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: before.revision,
      actorId: 1,
      actorRole: 'admin',
      changeCommands: [purposeCommand('replacement-purpose-token')],
    });

    expect(applied.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
    expect(applied.change).toEqual(expect.objectContaining({
      applied: true,
      newIntentVersion: 4,
      appliedCommandIds: ['update_purpose'],
    }));

    const after = await policyNativeIntentPurposeChangeReadService.getPurposeChange({
      dbClient: db,
      policyId: fixture.policyId,
    });

    expect(after).toEqual(expect.objectContaining({
      statusId: 'native_intent_purpose_change_available',
      revision: 4,
    }));
    expect(after.changeCommand.values[0].values).toEqual({ require_any: ['replacement-purpose-token'] });

    const stale = await applyPolicyNativeIntentChange({
      dbClient: db,
      policyId: fixture.policyId,
      expectedRevision: before.revision,
      actorId: 1,
      actorRole: 'admin',
      changeCommands: [purposeCommand('second-replacement-token')],
    });

    expect(stale.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.STALE_REVISION);

    const persisted = await db.query(`
      SELECT intent_version, active
      FROM policy_intents
      WHERE policy_id = $1
      ORDER BY intent_version
    `, [fixture.policyId]);
    expect(persisted.rows).toEqual([
      expect.objectContaining({ intent_version: 3, active: false }),
      expect.objectContaining({ intent_version: 4, active: true }),
    ]);
  });
});
