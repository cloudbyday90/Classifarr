/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const queryMock = jest.fn();
const withTransactionMock = jest.fn(async (fn) => fn({ query: queryMock }));

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const db = await import('../config/database.mjs');
const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');
const {
  POLICY_INTENT_DRAFT_BUCKETS,
  POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
} = await import('../services/policyIntentRequestValidator.mjs');

function expectDetailedPolicyIntentProjection(policy, policyId) {
  expect(policy.configuration_view).toEqual(expect.objectContaining({
    schema_version: 1,
    policy_id: policyId,
    summary: expect.objectContaining({
      counts: expect.any(Object),
    }),
  }));
  expect(policy.policy_intent_contract).toEqual(expect.objectContaining({
    schema_version: 1,
    policy_id: policyId,
    validation: expect.objectContaining({
      valid: true,
      error_count: 0,
      errors: [],
    }),
  }));
}

function validPolicyIntentDraft(overrides = {}) {
  return {
    schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
    source: 'legacy_policy_builder',
    migration_state: 'legacy_compatible',
    presets: [{
      preset_id: 5,
      preset_name: 'Family',
      weight: 1,
      source: 'legacy_preset',
      migration_state: 'legacy_compatible',
      buckets: {
        [POLICY_INTENT_DRAFT_BUCKETS.IDENTITY]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.IDENTITY,
          signal_type: 'genres',
          values: { require_any: ['Family'] },
          metadata: { semantics: 'identity' },
          source: 'legacy_preset',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.COMPATIBILITY]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.STRICT_CONSTRAINTS,
          signal_type: 'certifications',
          values: { mode: 'max', max: 'PG-13' },
          metadata: { constraint_mode: 'strict' },
          source: 'intent_draft',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.BOOSTERS]: [],
        [POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.EXCLUSIONS,
          signal_type: 'ratings',
          values: { exclude: ['R'] },
          metadata: {},
          source: 'intent_draft',
        }],
        [POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS]: [{
          bucket: POLICY_INTENT_DRAFT_BUCKETS.REVIEW_TRIGGERS,
          signal_type: 'review_triggers',
          values: { when_any: ['missing_identity'] },
          metadata: {},
          source: 'intent_draft',
        }],
      },
      warnings: [],
    }],
    summary: {
      preset_count: 1,
    },
    ...overrides,
  };
}

describe('Policies routes coverage', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.withTransaction.mockReset();
    db.withTransaction.mockImplementation(async (fn) => fn({ query: db.query }));
    app = express();
    app.use(express.json());
    app.use('/api/policies', policiesRouter);
    app.use(errorHandler);
  });

  describe('GET /api/policies/presets/all', () => {
    test('returns attachable presets with category and search filters', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Family', usage_count: 2, source: 'builtin' },
          { id: 9, name: 'Family Remix', usage_count: 1, source: 'custom' },
        ],
      });

      const res = await request(app)
        .get('/api/policies/presets/all?category=audience&search=family')
        .expect(200);

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('cp.category = $1');
      expect(sql).toContain('cp.name ILIKE $2');
      expect(sql).toContain('UNION ALL');
      expect(params).toEqual(['audience', '%family%']);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((preset) => preset.source)).toEqual(['builtin', 'custom']);
    });

    test('supports builtin-only mode when include_custom is false', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Family', usage_count: 2, source: 'builtin' }],
      });

      const res = await request(app)
        .get('/api/policies/presets/all?include_custom=false')
        .expect(200);

      const [sql] = db.query.mock.calls[0];
      expect(sql).not.toContain('UNION ALL');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].source).toBe('builtin');
    });

    test('returns 500 on database failure', async () => {
      db.query.mockRejectedValueOnce(new Error('preset list failure'));

      const res = await request(app)
        .get('/api/policies/presets/all')
        .expect(500);

      expect(res.body.message).toContain('preset list failure');
    });
  });

  test('GET /api/policies/presets/categories returns categories', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ category: 'audience', count: '3' }],
    });

    const res = await request(app)
      .get('/api/policies/presets/categories')
      .expect(200);

    expect(res.body[0].category).toBe('audience');
  });

  describe('GET /api/policies/presets/:presetId/usage', () => {
    test('validates presetId', async () => {
      await request(app)
        .get('/api/policies/presets/0/usage')
        .expect(400);
    });

    test('returns usage count as number', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '7' }] });

      const res = await request(app)
        .get('/api/policies/presets/2/usage')
        .expect(200);

      expect(res.body.count).toBe(7);
    });
  });

  describe('GET /api/policies/presets/suggest/:libraryId', () => {
    test('returns 404 when library does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/policies/presets/suggest/999')
        .expect(404);
    });

    test('returns ranked suggestions with scoring', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 7, name: 'Anime Family Movies', media_type: 'movie' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              key: 'anime',
              name: 'Anime',
              description: 'Animation and anime content',
              icon: 'sparkles',
              category: 'genre',
              signals: { genres: { require_any: ['Animation'], prefer: ['Family'] } },
              is_system: true,
              display_order: 1,
            },
            {
              id: 11,
              key: 'drama',
              name: 'Drama',
              description: 'Drama only',
              icon: 'mask',
              category: 'genre',
              signals: { genres: { require_any: ['Drama'], prefer: [] } },
              is_system: true,
              display_order: 2,
            },
          ],
        });

      const res = await request(app)
        .get('/api/policies/presets/suggest/7')
        .expect(200);

      expect(res.body.library_name).toBe('Anime Family Movies');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
      expect(res.body.suggestions[0].suggestion_score).toBeGreaterThan(0);
      expect(Array.isArray(res.body.suggestions[0].suggestion_reasons)).toBe(true);
      expect(res.body.suggestions[0].match_score).toBe(res.body.suggestions[0].suggestion_score);
      expect(Array.isArray(res.body.suggestions[0].match_reasons)).toBe(true);
    });

    test('includes attachable custom presets in suggestion scoring', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 7, name: 'Anime Family Movies', media_type: 'movie' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              key: 'anime',
              name: 'Anime',
              description: 'Animation and anime content',
              icon: 'sparkles',
              category: 'genre',
              signals: { genres: { require_any: ['Animation'], prefer: ['Family'] } },
              is_system: true,
              display_order: 1,
              source: 'builtin',
            },
            {
              id: 21,
              key: 'custom_anime_family',
              name: 'Anime Family Remix',
              description: 'My anime-focused family preset',
              icon: 'gear',
              category: 'custom',
              signals: { genres: { prefer: ['Animation', 'Family'] } },
              is_system: false,
              display_order: 0,
              source: 'custom',
            },
          ],
        });

      const res = await request(app)
        .get('/api/policies/presets/suggest/7')
        .expect(200);

      expect(res.body.suggestions.some((suggestion) => suggestion.id === 21 && suggestion.source === 'custom')).toBe(true);
    });

    test('does not produce substring false positives from stopwords', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 8, name: 'Comedy and Standup', media_type: 'movie' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 12,
              key: 'scandinavian',
              name: 'Scandinavian',
              description: 'Scandinavian films and series.',
              icon: 'flag',
              category: 'regional',
              signals: { language: { require_any: ['sv', 'no', 'da', 'fi'] } },
              is_system: true,
              display_order: 1,
            },
            {
              id: 13,
              key: 'comedy',
              name: 'Comedy',
              description: 'Funny comedy content.',
              icon: 'laugh',
              category: 'genre',
              signals: { genres: { require_any: ['Comedy'] } },
              is_system: true,
              display_order: 2,
            },
          ],
        });

      const res = await request(app)
        .get('/api/policies/presets/suggest/8')
        .expect(200);

      expect(res.body.suggestions.some((suggestion) => suggestion.key === 'scandinavian')).toBe(false);
      expect(res.body.suggestions.some((suggestion) => suggestion.key === 'comedy')).toBe(true);
    });
  });

  describe('preset migration admin routes', () => {
    test('GET /api/policies/presets/migration/incompatible validates policy_id', async () => {
      await request(app)
        .get('/api/policies/presets/migration/incompatible?policy_id=0')
        .expect(400);
    });

    test('GET /api/policies/presets/migration/incompatible returns only legacy-incompatible attachments', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            policy_id: 27,
            policy_name: 'Comedy and Standup Policy',
            library_id: 56,
            library_name: 'Comedy and Standup',
            id: 11,
            key: 'scandinavian',
            name: 'Scandinavian',
            signals: { language: { require_any: ['sv', 'no'] } },
            custom_signals: null,
            weight: 1,
          },
          {
            policy_id: 27,
            policy_name: 'Comedy and Standup Policy',
            library_id: 56,
            library_name: 'Comedy and Standup',
            id: 12,
            key: 'comedy',
            name: 'Comedy',
            signals: { genres: { require_any: ['Comedy'] } },
            custom_signals: null,
            weight: 1,
          },
          {
            policy_id: 29,
            policy_name: 'Movies Policy',
            library_id: 58,
            library_name: 'Movies',
            id: 13,
            key: 'korean',
            name: 'Korean',
            signals: { language: { require_any: ['ko'], strict: true } },
            custom_signals: null,
            weight: 1,
          },
        ],
      });

      const res = await request(app)
        .get('/api/policies/presets/migration/incompatible?policy_id=27')
        .expect(200);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('WHERE pp.policy_id = $1');
      expect(db.query.mock.calls[0][1]).toEqual([27]);
      expect(res.body.count).toBe(1);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0]).toEqual(expect.objectContaining({
        key: 'scandinavian',
        runtime_semantics: expect.objectContaining({
          migration_state: 'advisory_defaulted',
          review_recommended: true,
        }),
      }));
    });

    test('POST /api/policies/presets/migration/drop-incompatible validates policy_id', async () => {
      await request(app)
        .post('/api/policies/presets/migration/drop-incompatible')
        .send({ policy_id: -1 })
        .expect(400);
    });

    test('POST /api/policies/presets/migration/drop-incompatible deletes only incompatible attachments', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              policy_id: 27,
              policy_name: 'Comedy and Standup Policy',
              library_id: 56,
              library_name: 'Comedy and Standup',
              id: 11,
              key: 'scandinavian',
              name: 'Scandinavian',
              signals: { language: { require_any: ['sv', 'no'] } },
              custom_signals: null,
              weight: 1,
            },
            {
              policy_id: 27,
              policy_name: 'Comedy and Standup Policy',
              library_id: 56,
              library_name: 'Comedy and Standup',
              id: 12,
              key: 'comedy',
              name: 'Comedy',
              signals: { genres: { require_any: ['Comedy'] } },
              custom_signals: null,
              weight: 1,
            },
            {
              policy_id: 27,
              policy_name: 'Comedy and Standup Policy',
              library_id: 56,
              library_name: 'Comedy and Standup',
              id: 13,
              key: 'korean',
              name: 'Korean',
              signals: { language: { require_any: ['ko'] } },
              custom_signals: { language: { strict: true } },
              weight: 1,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ id: 27, native_intent_active: false }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/policies/presets/migration/drop-incompatible')
        .send({ policy_id: 27 })
        .expect(200);

      expect(db.withTransaction).toHaveBeenCalled();
      expect(db.query.mock.calls[0][0]).toContain('WHERE pp.policy_id = $1');
      expect(db.query.mock.calls[0][1]).toEqual([27]);
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query.mock.calls[2]).toEqual([
        'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
        [27, 11],
      ]);
      expect(res.body.dropped_count).toBe(1);
      expect(res.body.dropped).toHaveLength(1);
      expect(res.body.dropped[0]).toEqual(expect.objectContaining({
        key: 'scandinavian',
        runtime_semantics: expect.objectContaining({
          migration_state: 'advisory_defaulted',
        }),
      }));
    });

    test('POST /api/policies/presets/migration/drop-incompatible blocks converted policies', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            policy_id: 27,
            policy_name: 'Comedy and Standup Policy',
            library_id: 56,
            library_name: 'Comedy and Standup',
            id: 11,
            key: 'scandinavian',
            name: 'Scandinavian',
            signals: { language: { require_any: ['sv', 'no'] } },
            custom_signals: null,
            weight: 1,
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 27, native_intent_active: true }] });

      const res = await request(app)
        .post('/api/policies/presets/migration/drop-incompatible')
        .send({ policy_id: 27 })
        .expect(409);

      expect(res.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
      expect(db.query.mock.calls.some(([sql]) => sql === 'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2')).toBe(false);
    });
  });

  test('GET /api/policies returns policy list', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Movies Policy', preset_count: 2 }],
    });

    const res = await request(app)
      .get('/api/policies')
      .expect(200);

    expect(res.body[0].id).toBe(1);
    expect(res.body[0]).not.toHaveProperty('configuration_view');
    expect(res.body[0]).not.toHaveProperty('policy_intent_contract');
  });

  describe('GET /api/policies/:id', () => {
    test('returns 404 when policy does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/policies/123')
        .expect(404);
    });

    test('returns policy with presets', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 5, name: 'Policy', library_name: 'Movies' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 11,
            weight: 1.2,
            signals: {
              genres: { require_any: ['Family'] },
              language: { require_any: ['sv', 'no'] },
            },
            custom_signals: null,
          }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const res = await request(app)
        .get('/api/policies/5')
        .expect(200);

      expect(res.body.id).toBe(5);
      expect(res.body.presets).toHaveLength(1);
      expect(res.body.presets[0].runtime_semantics).toEqual(expect.objectContaining({
        migration_state: 'advisory_defaulted',
        review_recommended: true,
        badge_label: 'Review runtime',
      }));
      expect(res.body.configuration_view).toEqual(expect.objectContaining({
        schema_version: 1,
        policy_id: 5,
        identity_signals: [
          expect.objectContaining({
            signal_type: 'genres',
            role: 'identity',
          }),
        ],
        compatibility_signals: [
          expect.objectContaining({
            signal_type: 'language',
            role: 'compatibility',
          }),
        ],
      }));
      expect(res.body.policy_intent_contract).toEqual(expect.objectContaining({
        schema_version: 1,
        policy_id: 5,
        source: 'legacy_presets',
        inference_state: 'inferred',
        purpose: [
          expect.objectContaining({
            signal_type: 'genres',
            intent_role: 'purpose',
          }),
        ],
        helpful_hints: [
          expect.objectContaining({
            signal_type: 'language',
            intent_role: 'helpful_hint',
          }),
        ],
      }));
      expectDetailedPolicyIntentProjection(res.body, 5);
    });

    test('returns converted policy from active native intent storage', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            library_id: 4,
            name: 'Policy',
            library_name: 'Animated Movies',
            library_media_type: 'movie',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 11,
            weight: 1,
            signals: {
              genres: { require_any: ['Family'] },
            },
            custom_signals: {
              genres: { require_any: ['Family'] },
            },
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 101,
            policy_id: 5,
            library_id: 4,
            schema_version: 1,
            intent_version: 2,
            active: true,
            source: 'legacy_presets',
            inference_state: 'inferred',
            review_behavior: {
              auto_classify_threshold: 85,
              prompt_threshold: 60,
              require_ai_validation: true,
            },
            validation_status: 'valid',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            intent_role: 'purpose',
            collection: 'purpose',
            signal_type: 'genres',
            operator: 'require_any',
            values: { require_any: ['Animation'] },
            constraint_mode: 'advisory',
            semantics: 'identity',
            source: 'native_intent',
            inference_state: 'inferred',
            sort_order: 0,
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            preset_id: 11,
            preset_key: 'family',
            preset_name: 'Family',
            weight: '1.000',
            signal_count: 1,
            link_state: 'applied',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            status: 'valid',
            error_count: 0,
            warning_count: 0,
            errors: [],
            warnings: [],
          }],
        });

      const res = await request(app)
        .get('/api/policies/5')
        .expect(200);

      expect(res.body.policy_intent_contract).toEqual(expect.objectContaining({
        source: 'native_intent',
        inference_state: 'inferred',
        purpose: [
          expect.objectContaining({
            signal_type: 'genres',
            values: { require_any: ['Animation'] },
          }),
        ],
        validation: expect.objectContaining({
          valid: true,
          error_count: 0,
        }),
      }));
      expect(res.body.configuration_view).toEqual(expect.objectContaining({
        source: 'native_intent',
        identity_signals: [
          expect.objectContaining({
            signal_type: 'genres',
            values: { require_any: ['Animation'] },
          }),
        ],
      }));
      expect(res.body.policy_intent_read_trace).toEqual(expect.objectContaining({
        source: 'native_intent',
        status: 'native_intent_active',
        intent_version: 2,
      }));
      expect(res.body.presets).toHaveLength(1);
    });
  });

  describe('POST /api/policies', () => {
    test('does not expose retired migration verifiers', async () => {
      await request(app)
        .post('/api/policies/migration-verifier/impact-preview')
        .send({ library_id: 4 })
        .expect(404);

      await request(app)
        .post('/api/policies/migration-verifier/replay-preview')
        .send({ library_id: 4 })
        .expect(404);

      expect(db.query).not.toHaveBeenCalled();
      expect(db.withTransaction).not.toHaveBeenCalled();
    });

    test('validates required fields', async () => {
      await request(app)
        .post('/api/policies')
        .send({ description: 'missing required fields' })
        .expect(400);
    });

    test('validates threshold and weight constraints', async () => {
      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad policy',
          auto_classify_threshold: 101,
        })
        .expect(400);

      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad weights',
          profile_weight: 0.25,
          preset_weight: 0.5,
          pattern_weight: 0.3,
          rag_weight: 0.3,
          history_weight: 0.1,
        })
        .expect(400);

      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad preset attachment weight',
          presets: [{ preset_id: 9, weight: -1 }],
        })
        .expect(400);

      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Inverted thresholds',
          auto_classify_threshold: 70,
          prompt_threshold: 80,
        })
        .expect(400);

      await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Null threshold',
          auto_classify_threshold: null,
        })
        .expect(400);
    });

    test('rejects unsupported combination modes on create', async () => {
      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Bad mode',
          combination_mode: 'consensus',
        })
        .expect(400);

      expect(res.body.error).toContain('combination_mode');
    });

    test('creates policy with presets and commits transaction', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 77, library_id: 4, name: 'Family Policy' }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ id: 77, library_id: 4, name: 'Family Policy', library_name: 'Family' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 5,
            key: 'family',
            name: 'Family',
            weight: 1.0,
            signals: {
              genres: { require_any: ['Family'] },
              certifications: { mode: 'max', max: 'PG-13', strict: true },
            },
            custom_signals: null,
          }],
        });

      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 4,
          name: 'Family Policy',
          preset_weight: 0.35,
          profile_weight: 0.25,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.1,
          presets: [
            { preset_id: 5, weight: 1.0 },
            { preset_id: 6, customSignals: { genres: ['Family'] } },
          ],
        })
        .expect(201);

      expect(db.withTransaction).toHaveBeenCalled();
      expect(res.body.id).toBe(77);
      expect(res.body.presets).toHaveLength(1);
      expectDetailedPolicyIntentProjection(res.body, 77);
      expect(res.body.policy_intent_contract).toEqual(expect.objectContaining({
        source: 'legacy_presets',
        inference_state: 'inferred',
        purpose: [
          expect.objectContaining({
            signal_type: 'genres',
            intent_role: 'purpose',
          }),
        ],
        hard_limits: [
          expect.objectContaining({
            signal_type: 'certifications',
            intent_role: 'hard_limit',
          }),
        ],
      }));
    });

    test('reports valid native intent draft preflight without persisting draft content on create', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 78, library_id: 4, name: 'Family Policy' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 78, library_id: 4, name: 'Family Policy', library_name: 'Family' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 4,
          name: 'Family Policy',
          presets: [],
          policyIntentDraft: validPolicyIntentDraft(),
        })
        .expect(201);

      expect(db.withTransaction).toHaveBeenCalled();
      expect(res.body.id).toBe(78);
      expect(res.body.policy_intent_write_preflight).toEqual({
        present: true,
        validation: {
          valid: true,
          errors: [],
        },
        persistence_enabled: false,
        persistence_reason_code: 'native_intent_storage_not_enabled',
        draft_schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
        source: 'legacy_policy_builder',
        migration_state: 'legacy_compatible',
        preset_count: 1,
      });
      expect(res.body.policy_intent_write_preflight).not.toHaveProperty('draft');
      expect(res.body).not.toHaveProperty('policyIntentDraft');
      expect(res.body).not.toHaveProperty('policy_intent_draft');
    });

    test('rejects invalid native intent draft preflight before create persistence', async () => {
      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 4,
          name: 'Invalid native draft',
          policyIntentDraft: validPolicyIntentDraft({ unexpected_root: true }),
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid policy intent draft');
      expect(res.body.code).toBe('POLICY_INTENT_REQUEST_INVALID');
      expect(db.query).not.toHaveBeenCalled();
      expect(db.withTransaction).not.toHaveBeenCalled();
    });

    test('rolls back when preset insert fails', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 12, library_id: 1, name: 'Broken policy' }],
        })
        .mockRejectedValueOnce(new Error('policy preset insert failed'));

      const res = await request(app)
        .post('/api/policies')
        .send({
          library_id: 1,
          name: 'Broken policy',
          presets: [{ preset_id: 1 }],
        })
        .expect(500);

      expect(res.body.message).toContain('policy preset insert failed');
      expect(db.withTransaction).toHaveBeenCalled();
    });
  });

  describe('PUT /api/policies/:id', () => {
    test('blocks legacy behavior updates for policies with active native intent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 8,
          native_intent_active: true,
          auto_classify_threshold: 85,
          prompt_threshold: 60,
          preset_weight: 0.35,
          profile_weight: 0.25,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.1,
        }],
      });

      const res = await request(app)
        .put('/api/policies/8')
        .send({ preset_weight: 0.35 })
        .expect(409);

      expect(res.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
      expect(res.body.required_action).toBe('use_native_intent_command');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('allows metadata updates for policies with active native intent', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 8,
            native_intent_active: true,
            auto_classify_threshold: 85,
            prompt_threshold: 60,
            preset_weight: 0.35,
            profile_weight: 0.25,
            pattern_weight: 0.15,
            rag_weight: 0.15,
            history_weight: 0.1,
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 8, name: 'Renamed', library_id: 1, library_name: 'Movies' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/policies/8')
        .send({ name: 'Renamed' })
        .expect(200);

      expect(res.body.name).toBe('Renamed');
    });

    test('validates update constraints', async () => {
      const res = await request(app)
        .put('/api/policies/8')
        .send({ auto_classify_threshold: -1 })
        .expect(400);

      expect(res.body.error).toContain('auto_classify_threshold');
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects merged updates that invert the threshold ladder', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 8,
          auto_classify_threshold: 85,
          prompt_threshold: 60,
          preset_weight: 0.35,
          profile_weight: 0.25,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.1,
        }],
      });

      const res = await request(app)
        .put('/api/policies/8')
        .send({ prompt_threshold: 90 })
        .expect(400);

      expect(res.body.error).toContain('prompt_threshold must be less than or equal to auto_classify_threshold');
      expect(db.withTransaction).toHaveBeenCalledTimes(1);
    });

    test('rejects unsupported combination modes on update', async () => {
      const res = await request(app)
        .put('/api/policies/8')
        .send({ combination_mode: 'consensus' })
        .expect(400);

      expect(res.body.error).toContain('combination_mode');
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects invalid profile_weight values on update', async () => {
      const res = await request(app)
        .put('/api/policies/8')
        .send({ profile_weight: 1.2 })
        .expect(400);

      expect(res.body.error).toContain('profile_weight');
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects non-positive preset attachment weights on update', async () => {
      const res = await request(app)
        .put('/api/policies/8')
        .send({ presets: [{ preset_id: 3, weight: 0 }] })
        .expect(400);

      expect(res.body.error).toContain('presets[0].weight');
      expect(db.query).not.toHaveBeenCalled();
    });

    test('updates policy with preset replacement', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 8, preset_weight: 0.35, profile_weight: 0.25, pattern_weight: 0.15, rag_weight: 0.15, history_weight: 0.1, auto_classify_threshold: 85, prompt_threshold: 60 }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ id: 8, name: 'Updated', library_id: 1, library_name: 'Movies' }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 3,
            key: 'movies',
            name: 'Movies',
            weight: 2.0,
            signals: {
              genres: { require_any: ['Action'] },
            },
            custom_signals: {
              keywords: { prefer: ['adventure'], semantics: 'compatibility' },
            },
          }],
        });

      const res = await request(app)
        .put('/api/policies/8')
        .send({
          name: 'Updated',
          preset_weight: 0.35,
          profile_weight: 0.25,
          pattern_weight: 0.15,
          rag_weight: 0.15,
          history_weight: 0.1,
          presets: [{ preset_id: 3, weight: 2.0 }],
        })
        .expect(200);

      expect(db.withTransaction).toHaveBeenCalled();
      expect(res.body.name).toBe('Updated');
      expect(res.body.presets).toHaveLength(1);
      expectDetailedPolicyIntentProjection(res.body, 8);
      expect(res.body.policy_intent_contract).toEqual(expect.objectContaining({
        source: 'legacy_presets',
        inference_state: 'inferred',
        purpose: [
          expect.objectContaining({
            signal_type: 'genres',
            intent_role: 'purpose',
          }),
        ],
        helpful_hints: [
          expect.objectContaining({
            signal_type: 'keywords',
            intent_role: 'helpful_hint',
          }),
        ],
      }));
    });

    test('reports valid native intent draft preflight without persisting draft content on update', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 8, preset_weight: 0.35, profile_weight: 0.25, pattern_weight: 0.15, rag_weight: 0.15, history_weight: 0.1, auto_classify_threshold: 85, prompt_threshold: 60 }],
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ id: 8, name: 'Updated', library_id: 1, library_name: 'Movies' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/policies/8')
        .send({
          name: 'Updated',
          policy_intent_draft: validPolicyIntentDraft(),
        })
        .expect(200);

      expect(db.withTransaction).toHaveBeenCalled();
      expect(res.body.name).toBe('Updated');
      expect(res.body.policy_intent_write_preflight).toEqual({
        present: true,
        validation: {
          valid: true,
          errors: [],
        },
        persistence_enabled: false,
        persistence_reason_code: 'native_intent_storage_not_enabled',
        draft_schema_version: POLICY_INTENT_DRAFT_REQUEST_SCHEMA_VERSION,
        source: 'legacy_policy_builder',
        migration_state: 'legacy_compatible',
        preset_count: 1,
      });
      expect(res.body.policy_intent_write_preflight).not.toHaveProperty('draft');
      expect(res.body).not.toHaveProperty('policyIntentDraft');
      expect(res.body).not.toHaveProperty('policy_intent_draft');
    });

    test('rejects invalid native intent draft preflight before update persistence', async () => {
      const res = await request(app)
        .put('/api/policies/8')
        .send({
          name: 'Invalid native draft',
          policy_intent_draft: validPolicyIntentDraft({
            summary: {
              preset_count: 2,
            },
          }),
        })
        .expect(400);

      expect(res.body.error).toContain('Invalid policy intent draft');
      expect(res.body.code).toBe('POLICY_INTENT_REQUEST_INVALID');
      expect(db.query).not.toHaveBeenCalled();
      expect(db.withTransaction).not.toHaveBeenCalled();
    });

    test('rejects partial updates that break merged weight totals', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 8, preset_weight: 0.35, profile_weight: 0.25, pattern_weight: 0.15, rag_weight: 0.15, history_weight: 0.1, auto_classify_threshold: 85, prompt_threshold: 60 }],
      });

      const res = await request(app)
        .put('/api/policies/8')
        .send({ preset_weight: 0.9 })
        .expect(400);

      expect(res.body.error).toContain('Weights must sum to 1.0');
      expect(db.withTransaction).toHaveBeenCalledTimes(1);
    });

    test('returns 404 after update when policy no longer exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/policies/404')
        .send({ name: 'not found path' })
        .expect(404);
    });
  });

  describe('DELETE /api/policies/:id', () => {
    test('blocks reset-by-recreation for policies with active native intent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 9, library_id: 3, native_intent_active: true }],
      });

      const res = await request(app)
        .delete('/api/policies/9')
        .expect(409);

      expect(res.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('returns 404 for missing policy', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .delete('/api/policies/44')
        .expect(404);
    });

    test('resets policy and returns old/new policy payload', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 9, library_id: 3, library_name: 'Family', name: 'Old' }],
        })
        .mockResolvedValueOnce({ rows: [{ name: 'Family' }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          rows: [{ id: 10, library_id: 3, name: 'Family Policy' }],
        });

      const res = await request(app)
        .delete('/api/policies/9')
        .expect(200);

      expect(res.body.message).toContain('reset');
      expect(res.body.oldPolicy.id).toBe(9);
      expect(res.body.newPolicy.id).toBe(10);
    });
  });

  test('GET /api/policies/:id/presets returns attached presets', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 5,
        key: 'family',
        weight: 1.0,
        signals: { language: { require_any: ['ja'], strict: true } },
        custom_signals: null,
      }],
    });

    const res = await request(app)
      .get('/api/policies/22/presets')
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].runtime_semantics).toEqual(expect.objectContaining({
      migration_state: 'strict_inherited',
      badge_label: 'Strict runtime',
    }));
  });

  describe('POST /api/policies/:id/presets', () => {
    test('blocks preset attachment for policies with active native intent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 22, native_intent_active: true }],
      });

      const res = await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 4, weight: 1 })
        .expect(409);

      expect(res.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('requires preset_id', async () => {
      await request(app)
        .post('/api/policies/22/presets')
        .send({})
        .expect(400);
    });

    test('rejects non-positive weight', async () => {
      await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 4, weight: 0 })
        .expect(400);
    });

    test('rejects duplicate attachment', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 22, native_intent_active: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 4, weight: 1 })
        .expect(400);
    });

    test('attaches preset and returns runtime semantics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 22, native_intent_active: false }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            policy_id: 22,
            preset_id: 4,
            weight: 1.2,
            custom_signals: { language: { strict: true } },
            is_system: false,
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/policies/22/presets')
        .send({ preset_id: 4, weight: 1.2, custom_signals: { language: { strict: true } } })
        .expect(201);

      expect(res.body.policy_id).toBe(22);
      expect(res.body.preset_id).toBe(4);
      expect(res.body.customSignals).toEqual({ language: { strict: true } });
    });
  });

  describe('DELETE /api/policies/:id/presets/:presetId', () => {
    test('blocks preset removal for policies with active native intent', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 22, native_intent_active: true }],
      });

      const res = await request(app)
        .delete('/api/policies/22/presets/5')
        .expect(409);

      expect(res.body.code).toBe('POLICY_NATIVE_INTENT_LEGACY_WRITE_BLOCKED');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('returns 404 when preset is not attached', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 22, native_intent_active: false }] })
        .mockResolvedValueOnce({ rows: [] });

      await request(app)
        .delete('/api/policies/22/presets/5')
        .expect(404);
    });

    test('removes preset from policy', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 22, native_intent_active: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/api/policies/22/presets/5')
        .expect(200);

      expect(res.body.message).toContain('removed');
    });
  });
});
