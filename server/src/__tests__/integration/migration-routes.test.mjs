/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for migration routes with preset validation
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import consoleHelpers from '../setup/consoleHelpers.mjs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { errorHandler } from '../../middleware/errorHandler.mjs';

const { withConsoleSpy } = consoleHelpers;

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { router: migrationRouter } = await import('../../routes/migration.mjs');
let requestUserId;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: requestUserId };
  next();
});
app.use('/api/migration', migrationRouter);
app.use(errorHandler);

describe('Migration Routes Integration', () => {
  let pool;
  let userId;
  let otherUserId;
  let libraryId;
  let mediaServerId;
  let privatePresetId;
  let privatePresetKey;

  const createRuleWithJson = async (name, ruleJson) => {
    const result = await pool.query(`
      INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
      VALUES ($1, $2, 'Test', $3, true)
      RETURNING id
    `, [libraryId, name, ruleJson]);
    return result.rows[0].id;
  };

  const createRule = async () => {
    return createRuleWithJson(
      'Test Rule',
      '{"field": "genres", "value": "Action"}'
    );
  };

  const getSystemPresetId = async () => {
    const presetResult = await pool.query(
      'SELECT id FROM content_presets WHERE is_system = true LIMIT 1'
    );
    return presetResult.rows.length > 0 ? presetResult.rows[0].id : null;
  };

  beforeAll(async () => {
    pool = getPool();

    const userResult = await pool.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ('migration_user', 'hashed', 'admin', true)
      RETURNING id
    `);
    userId = userResult.rows[0].id;
    requestUserId = userId;

    const otherUserResult = await pool.query(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES ('migration_other_user', 'hashed', 'admin', true)
      RETURNING id
    `);
    otherUserId = otherUserResult.rows[0].id;

    const serverResult = await pool.query(`
      INSERT INTO media_server (name, type, url, api_key, is_active)
      VALUES ('Migration Server', 'plex', 'http://localhost:32400', 'test-key', true)
      RETURNING id
    `);
    mediaServerId = serverResult.rows[0].id;

    const libraryResult = await pool.query(`
      INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
      VALUES ($1, 'migration-lib', 'Migration Library', 'movie', true, 5)
      RETURNING id
    `, [mediaServerId]);
    libraryId = libraryResult.rows[0].id;

  }, 60000);

  beforeEach(async () => {
    await pool.query('DELETE FROM policy_overrides');
    await pool.query('DELETE FROM policy_presets');
    await pool.query('DELETE FROM library_policies WHERE library_id = $1', [libraryId]);
    await pool.query('DELETE FROM library_custom_rules WHERE library_id = $1', [libraryId]);

    if (privatePresetId) {
      await pool.query('DELETE FROM content_presets WHERE id = $1', [privatePresetId]);
      privatePresetId = null;
      privatePresetKey = null;
    }
  });

  afterAll(async () => {
    await pool.query('DELETE FROM policy_overrides');
    await pool.query('DELETE FROM policy_presets');
    await pool.query('DELETE FROM library_policies WHERE library_id = $1', [libraryId]);
    await pool.query('DELETE FROM library_custom_rules WHERE library_id = $1', [libraryId]);

    if (privatePresetKey) {
      await pool.query('DELETE FROM content_presets WHERE key = $1', [privatePresetKey]);
    }

    if (libraryId) {
      await pool.query('DELETE FROM libraries WHERE id = $1', [libraryId]);
    }
    if (mediaServerId) {
      await pool.query('DELETE FROM media_server WHERE id = $1', [mediaServerId]);
    }
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (otherUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    }
  });

  test('returns 404 when preset does not exist', async () => {
    const ruleId = await createRule();

    const response = await request(app)
      .post(`/api/migration/rules/${ruleId}/migrate`)
      .send({
        migrationChoice: {
          type: 'preset',
          preset_id: 999999
        }
      })
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'PRESET_NOT_FOUND'
    });
  });

  test('returns 403 when preset is not accessible to the user', async () => {
    privatePresetKey = `test_private_preset_${Date.now()}`;
    const presetResult = await pool.query(`
      INSERT INTO content_presets (
        key, name, description, icon, category, signals,
        is_system, user_id, is_public, display_order
      )
      VALUES ($1, 'Private Preset', 'Private', 'lock', 'test', $2::jsonb, false, $3, false, 0)
      RETURNING id
    `, [privatePresetKey, '{"genres":["Action"]}', otherUserId]);
    privatePresetId = presetResult.rows[0].id;

    const ruleId = await createRule();

    const response = await request(app)
      .post(`/api/migration/rules/${ruleId}/migrate`)
      .send({
        migrationChoice: {
          type: 'preset',
          preset_id: privatePresetId
        }
      })
      .expect(403);

    expect(response.body).toMatchObject({
      code: 'PRESET_NOT_ALLOWED'
    });

    const rule = await pool.query('SELECT migrated_at FROM library_custom_rules WHERE id = $1', [ruleId]);
    expect(rule.rows[0].migrated_at).toBeNull();
  });

  test('returns migration status counts', async () => {
    const ruleId1 = await createRuleWithJson(
      'Action Rule',
      '{"field": "genres", "value": "Action"}'
    );
    await createRuleWithJson(
      'Comedy Rule',
      '{"field": "genres", "value": "Comedy"}'
    );

    await pool.query(`
      UPDATE library_custom_rules
      SET migrated_at = NOW(), migration_type = 'preset'
      WHERE id = $1
    `, [ruleId1]);

    const response = await request(app)
      .get('/api/migration/status')
      .expect(200);

    expect(response.body).toMatchObject({
      total: 2,
      migrated: 1,
      pending: 1
    });
  });

  test('lists libraries with legacy rules', async () => {
    await createRule();
    await createRuleWithJson(
      'Comedy Rule',
      '{"field": "genres", "value": "Comedy"}'
    );

    const response = await request(app)
      .get('/api/migration/libraries')
      .expect(200);

    const entry = response.body.find((item) => item.library_id === libraryId);
    expect(entry).toBeDefined();
    expect(entry.rule_count).toBe(2);
  });

  test('lists unmigrated rules for a library', async () => {
    await createRule();
    await createRuleWithJson(
      'Comedy Rule',
      '{"field": "genres", "value": "Comedy"}'
    );

    const response = await request(app)
      .get(`/api/migration/libraries/${libraryId}/rules`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.every((rule) => rule.library_id === libraryId)).toBe(true);
  });

  test('analyzes a legacy rule and returns suggestions', async () => {
    const ruleId = await createRule();

    const response = await request(app)
      .get(`/api/migration/rules/${ruleId}/analyze`)
      .expect(200);

    expect(response.body).toMatchObject({
      rule_id: ruleId
    });
    expect(response.body.suggestions.length).toBeGreaterThan(0);
  });

  test('migrates a rule via route with a valid preset', async () => {
    const presetId = await getSystemPresetId();
    if (!presetId) {
      return test.skip('No system presets found');
    }

    const ruleId = await createRule();

    const response = await withConsoleSpy('log', { suppress: true }, async ({ getMessages }) => {
      const result = await request(app)
        .post(`/api/migration/rules/${ruleId}/migrate`)
        .send({
          migrationChoice: {
            type: 'preset',
            preset_id: presetId
          }
        })
        .expect(200);

      const messages = getMessages();
      expect(messages).toContain('Rule migrated successfully');

      return result;
    });

    expect(response.body).toMatchObject({ success: true });

    const rule = await pool.query('SELECT migrated_at, migration_type FROM library_custom_rules WHERE id = $1', [ruleId]);
    expect(rule.rows[0].migrated_at).toBeTruthy();
    expect(rule.rows[0].migration_type).toBe('preset');

    const policyPresets = await pool.query(
      'SELECT * FROM policy_presets WHERE preset_id = $1',
      [presetId]
    );
    expect(policyPresets.rows.length).toBe(1);
  });
});
