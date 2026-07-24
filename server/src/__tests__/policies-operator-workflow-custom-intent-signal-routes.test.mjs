import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  createPolicyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';
import {
  loadPolicyLibraryProfileEvidence,
} from '../services/policyLibraryProfileEvidenceLoader.mjs';
import {
  registerPolicyOperatorWorkflowCustomIntentSignalRoutes,
} from '../routes/policiesRouteOperatorWorkflowCustomIntentSignal.mjs';
import { policyIntentSignalCustomEntryLimiterConfig } from '../config/rateLimits.mjs';

const NOW = Date.parse('2026-07-22T12:00:00.000Z');

function buildProfile(overrides = {}) {
  return {
    library_id: 6,
    item_count: 10,
    genre_distribution: { Animation: 8 },
    rating_distribution: { PG: 8 },
    last_generated_at: '2026-07-22T11:00:00.000Z',
    ...overrides,
  };
}

function createApp({ rows = [], mappingRows = [], profile = buildProfile(), presets = [] } = {}) {
  const loadProfileEvidence = jest.fn(({ libraryId }) => loadPolicyLibraryProfileEvidence({
    libraryId,
    getProfile: jest.fn().mockResolvedValue(profile),
    now: NOW,
  }));
  const operatorWorkflowReadService = createPolicyOperatorWorkflowReadService({ loadProfileEvidence });
  const listPresets = jest.fn().mockResolvedValue(presets);
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: mappingRows }),
  };
  const app = express();
  const router = express.Router();

  app.use(express.json());
  registerPolicyOperatorWorkflowCustomIntentSignalRoutes(router, {
    db,
    listPresets,
    logger,
    rateLimit,
    operatorWorkflowReadService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, db, listPresets, loadProfileEvidence, logger, rateLimit };
}

describe('policy operator workflow custom intent-signal routes', () => {
  test('validates a custom value through the display-only workflow projection without writing policy storage', async () => {
    const { app, db, loadProfileEvidence, rateLimit } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
      mappingRows: [{
        arr_type: 'radarr',
        arr_config_id: 4,
        arr_root_folder_path: '/movies/animated',
      }],
    });

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/intent-signals/custom')
      .send({
        signalType: 'studios',
        value: 'Studio Ghibli',
        explanation: 'This library is for animated films from Studio Ghibli.',
      })
      .expect(200);

    expect(rateLimit).toHaveBeenCalledWith(policyIntentSignalCustomEntryLimiterConfig);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(loadProfileEvidence).toHaveBeenCalledWith({ libraryId: 6 });
    expect(response.body).toEqual(expect.objectContaining({
      version: 'policy.operator_workflow_read.v3',
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
      },
      rawPayloadExposed: false,
      observedProfile: expect.objectContaining({
        intentSignalProjection: expect.objectContaining({
          customEntryInput: expect.objectContaining({ enabled: true }),
          options: expect.arrayContaining([
            expect.objectContaining({
              value: 'Studio Ghibli',
              sourceId: 'operator_added_custom',
              selectable: true,
              requiresExplicitAcceptance: true,
              canAutoDeclare: false,
            }),
          ]),
        }),
      }),
    }));
  });

  test('returns an unavailable projection option for a broad custom genre without observed support', async () => {
    const { app } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
    });

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/intent-signals/custom')
      .send({
        signalType: 'genres',
        value: 'Drama',
        explanation: 'The operator wants this destination to include drama.',
      })
      .expect(200);

    expect(response.body.observedProfile.intentSignalProjection.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 'Drama',
        sourceId: 'unavailable_conflicting_intent',
        selectable: false,
        disabledReason: expect.stringContaining('Broad identity genres need supporting evidence'),
      }),
    ]));
  });

  test('rejects malformed input before reading library state and does not log submitted values', async () => {
    const { app, db, logger } = createApp();

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/intent-signals/custom')
      .send({
        signalType: 'genres',
        value: 'Drama',
        explanation: 'A value.',
        autoDeclare: true,
      })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Custom intent-signal input contains unsupported fields.',
      code: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_REQUEST',
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Rejected custom policy intent-signal input', {
      libraryId: 6,
      code: 'POLICY_INTENT_SIGNAL_CUSTOM_ENTRY_INVALID_REQUEST',
    });
  });
});
