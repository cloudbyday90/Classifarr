/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { persistAiSettingsConfig } = await import('../../routes/helpers/aiSettingsPersistence.mjs');
const {
  createAiSettingsWritePreconditionService,
} = await import('../../services/aiSettingsWritePrecondition.mjs');
const {
  ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository,
} = await import('../../services/classificationCandidateBoundVerificationCapabilityChangeReceiptRepository.mjs');

const receiptMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../database/migrations/20260813_100000_add_verification_capability_change_receipts.sql',
  ),
  'utf8',
);
const revisionIntegrityMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../database/migrations/20260813_110000_enforce_ai_provider_configuration_revision_integrity.sql',
  ),
  'utf8',
);
const writePreconditionMigrationSql = readFileSync(
  path.resolve(
    import.meta.dirname,
    '../../../../database/migrations/20260813_120000_add_ai_settings_write_precondition.sql',
  ),
  'utf8',
);

const RECEIPTS_TABLE = 'candidate_bound_verification_capability_receipts';
const aiSettingsWritePreconditionService = createAiSettingsWritePreconditionService();

function createPersistenceDependencies({
  verificationCapabilityChangeReceiptRepository =
    new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository(),
} = {}) {
  return {
    logger: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
    validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
    encryptValue: jest.fn(),
    formatEncryptedValue: jest.fn(),
    aiSettingsWritePreconditionService,
    verificationCapabilityChangeReceiptActorId: 'user:42',
    verificationCapabilityChangeReceiptRepository,
  };
}

async function getCurrentWritePrecondition() {
  const current = await db.query(
    'SELECT configuration_write_tag FROM ai_provider_config WHERE id = 1',
  );
  return aiSettingsWritePreconditionService.issueForConfiguration(current.rows[0] || null);
}

async function saveVerificationReadyConfiguration({
  providedWritePrecondition = null,
  body = {
    primary_provider: 'gemini',
    model: 'gemini-2.5-pro',
  },
  dependencies = createPersistenceDependencies(),
} = {}) {
  const currentWritePrecondition = providedWritePrecondition || await getCurrentWritePrecondition();

  return db.withTransaction((client) => persistAiSettingsConfig({
    client,
    body,
    providedWritePrecondition: currentWritePrecondition,
    ...dependencies,
  }));
}

async function clearRevisionIntegrityFixture() {
  await db.query(`TRUNCATE TABLE ${RECEIPTS_TABLE} RESTART IDENTITY`);
  await db.query('DELETE FROM ai_provider_config');
}

afterEach(async () => {
  await clearRevisionIntegrityFixture();
});

describe('verification capability configuration revision integrity', () => {
  test('a fresh-install schema has revision and opaque-write-tag baselines', async () => {
    const column = await db.query(
      `SELECT is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ai_provider_config'
         AND column_name = 'configuration_revision'`,
    );
    const constraint = await db.query(
      `SELECT convalidated
       FROM pg_constraint
       WHERE conrelid = 'public.ai_provider_config'::regclass
         AND conname = 'ai_provider_config_revision_ck'`,
    );
    const writeTagColumn = await db.query(
      `SELECT is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ai_provider_config'
         AND column_name = 'configuration_write_tag'`,
    );

    expect(column.rows).toEqual([expect.objectContaining({
      is_nullable: 'NO',
      column_default: expect.stringContaining('0'),
    })]);
    expect(constraint.rows).toEqual([{ convalidated: true }]);
    expect(writeTagColumn.rows).toEqual([expect.objectContaining({
      is_nullable: 'NO',
      column_default: expect.stringContaining('gen_random_uuid'),
    })]);

    const inserted = await db.query(
      `INSERT INTO ai_provider_config (id, primary_provider)
       VALUES (999999, 'none')
       RETURNING configuration_revision, configuration_write_tag`,
    );
    expect(String(inserted.rows[0].configuration_revision)).toBe('0');
    expect(inserted.rows[0].configuration_write_tag).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('replays receipt, revision, and write-precondition migrations over an existing installation', async () => {
    await db.query(`DROP TABLE IF EXISTS ${RECEIPTS_TABLE}`);
    await db.query('ALTER TABLE ai_provider_config DROP CONSTRAINT IF EXISTS ai_provider_config_revision_ck');
    await db.query('ALTER TABLE ai_provider_config DROP COLUMN IF EXISTS configuration_revision');
    await db.query('ALTER TABLE ai_provider_config DROP COLUMN IF EXISTS configuration_write_tag');
    await db.query("INSERT INTO ai_provider_config (id, primary_provider) VALUES (1, 'none')");

    await db.query(receiptMigrationSql);
    await db.query('UPDATE ai_provider_config SET configuration_revision = -7 WHERE id = 1');
    await db.query(revisionIntegrityMigrationSql);
    await expect(db.query(revisionIntegrityMigrationSql)).resolves.toBeDefined();
    await db.query(writePreconditionMigrationSql);
    await expect(db.query(writePreconditionMigrationSql)).resolves.toBeDefined();

    const repaired = await db.query(
      `SELECT configuration_revision, configuration_write_tag
       FROM ai_provider_config
       WHERE id = 1`,
    );
    expect(String(repaired.rows[0].configuration_revision)).toBe('0');
    expect(repaired.rows[0].configuration_write_tag).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await expect(db.query(
      'UPDATE ai_provider_config SET configuration_revision = -1 WHERE id = 1',
    )).rejects.toMatchObject({ code: '23514' });

    await db.query(
      `INSERT INTO ${RECEIPTS_TABLE} (
         actor_id, before_status_id, after_status_id, configuration_revision, receipt_version
       ) VALUES (
         'user:42', 'primary_path_ineligible', 'verification_ready', 1,
         'classification.candidate_bound_verification_capability_change_receipt.v1'
       )`,
    );
    await expect(db.query(
      `DELETE FROM ${RECEIPTS_TABLE} WHERE configuration_revision = 1`,
    )).rejects.toMatchObject({ code: '55000' });
    await db.withTransaction((client) => client.query(
      `SELECT set_config(
         'classifarr.verification_capability_receipt_maintenance',
         'replace_restore',
         true
       )`,
    ).then(() => client.query(`DELETE FROM ${RECEIPTS_TABLE}`)));
  });

  test('serializes accepted saves, increments only in PostgreSQL, and retains one transition receipt', async () => {
    const first = await saveVerificationReadyConfiguration();
    const second = await saveVerificationReadyConfiguration();

    expect([first.config.primary_provider, second.config.primary_provider])
      .toEqual(['gemini', 'gemini']);

    const configuration = await db.query(
      'SELECT configuration_revision FROM ai_provider_config WHERE id = 1',
    );
    const receipts = await db.query(
      `SELECT before_status_id, after_status_id, configuration_revision
       FROM ${RECEIPTS_TABLE}
       ORDER BY id`,
    );

    expect(String(configuration.rows[0].configuration_revision)).toBe('2');
    expect(receipts.rows.map((receipt) => ({
      ...receipt,
      configuration_revision: String(receipt.configuration_revision),
    }))).toEqual([{
      before_status_id: 'primary_path_ineligible',
      after_status_id: 'verification_ready',
      configuration_revision: '1',
    }]);

    await saveVerificationReadyConfiguration();
    const replayed = await db.query(
      `SELECT configuration_revision,
              (SELECT count(*) FROM ${RECEIPTS_TABLE})::int AS receipt_count
       FROM ai_provider_config
       WHERE id = 1`,
    );
    expect({
      configurationRevision: String(replayed.rows[0].configuration_revision),
      receiptCount: replayed.rows[0].receipt_count,
    }).toEqual({
      configurationRevision: '3',
      receiptCount: 1,
    });
  });

  test('accepts exactly one competing write and rejects the stale write before receipt persistence', async () => {
    const sharedPrecondition = await getCurrentWritePrecondition();
    const receiptRepository = { record: jest.fn() };
    const dependencies = createPersistenceDependencies({
      verificationCapabilityChangeReceiptRepository: receiptRepository,
    });

    const attempts = await Promise.allSettled([
      saveVerificationReadyConfiguration({
        providedWritePrecondition: sharedPrecondition,
        body: { primary_provider: 'none', model: 'candidate-a' },
        dependencies,
      }),
      saveVerificationReadyConfiguration({
        providedWritePrecondition: sharedPrecondition,
        body: { primary_provider: 'none', model: 'candidate-b' },
        dependencies,
      }),
    ]);

    const succeeded = attempts.filter((attempt) => attempt.status === 'fulfilled');
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      code: 'ai_settings_stale_write',
      httpStatus: 412,
      reloadRequired: true,
    });
    expect(receiptRepository.record).not.toHaveBeenCalled();

    const persisted = await db.query(
      `SELECT model, configuration_revision, configuration_write_tag
       FROM ai_provider_config
       WHERE id = 1`,
    );
    expect(persisted.rows[0]).toMatchObject({
      model: expect.stringMatching(/^candidate-[ab]$/),
      configuration_write_tag: expect.any(String),
    });
    expect(String(persisted.rows[0].configuration_revision)).toBe('1');
    expect(aiSettingsWritePreconditionService.issueForConfiguration(persisted.rows[0]))
      .not.toBe(sharedPrecondition);
  });
});
