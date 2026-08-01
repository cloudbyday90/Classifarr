import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyOperatorWorkflowReadRoutes,
} from '../routes/policiesRouteOperatorWorkflowRead.mjs';
import {
  createPolicyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';

function createApp({ rows = [], mappingRows = [], presets = [] } = {}) {
  const workflowReadService = createPolicyOperatorWorkflowReadService({
    loadProfileEvidence: jest.fn().mockResolvedValue({ ok: false }),
  });
  const getWorkflow = jest.fn(options => workflowReadService.getWorkflow(options));
  const listPresets = jest.fn().mockResolvedValue(presets);
  const db = {
    query: jest.fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: mappingRows }),
  };
  const app = express();
  const router = express.Router();

  registerPolicyOperatorWorkflowReadRoutes(router, {
    db,
    listPresets,
    operatorWorkflowReadService: { getWorkflow },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, db, getWorkflow, listPresets };
}

describe('policy operator workflow read routes', () => {
  test('reads the library, mapping, and bounded workflow display projection', async () => {
    const { app, db, getWorkflow } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
      mappingRows: [{
        arr_type: 'radarr',
        arr_config_id: 4,
        arr_root_folder_path: '/movies/animated',
      }],
    });

    const response = await request(app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      version: 'policy.operator_workflow_read.v4',
      statusId: 'profile_unavailable',
      rawPayloadExposed: false,
      authority: {
        displayProjection: true,
        automationDecision: false,
        policyPersistence: false,
        routingExecution: false,
      },
    }));
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(getWorkflow).toHaveBeenCalledWith({
      library: { id: 6, name: 'Animated Movies', media_type: 'movie' },
      routing: {
        configured: true,
        routeReady: true,
        targetName: 'radarr library mapping',
      },
      intentSignalSources: { starterTemplateSuggestions: [] },
    });
  });

  test('projects matching starter-template values as bounded workflow input without attaching a template', async () => {
    const { app, getWorkflow, listPresets } = createApp({
      rows: [{ id: 6, name: 'Holiday Movies', media_type: 'movie' }],
      presets: [{
        id: 44,
        key: 'holiday',
        name: 'Holiday',
        signals: { keywords: { require_any: ['Christmas'] } },
      }],
    });

    const response = await request(app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(200);

    expect(listPresets).toHaveBeenCalledWith({ includeCustom: true, orderBy: 'policy' });
    expect(getWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      intentSignalSources: {
        starterTemplateSuggestions: [{
          templateId: '44',
          templateName: 'Holiday',
          signalType: 'keywords',
          value: 'Christmas',
          label: 'Christmas',
          explanation: 'Suggested by the optional Holiday starter template.',
        }],
      },
    }));
    const candidate = response.body.observedProfile.intentSignalProjection.options.find(option => (
      option.sourceId === 'suggested_from_starter_template'
    ));
    expect(candidate).toEqual(expect.objectContaining({
      value: 'Christmas',
      sourceLabel: 'Suggested by starter template',
      selectable: true,
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
    }));
    expect(candidate).not.toHaveProperty('templateId');
    expect(candidate).not.toHaveProperty('templateName');
    expect(candidate).not.toHaveProperty('signals');
  });

  test('keeps unmapped libraries read-only and reports invalid or missing libraries safely', async () => {
    const { app, getWorkflow } = createApp({
      rows: [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
      mappingRows: [],
    });

    await request(app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(200);
    expect(getWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      routing: {
        configured: false,
        routeReady: false,
        targetName: null,
      },
      intentSignalSources: { starterTemplateSuggestions: [] },
    }));

    const invalid = createApp();
    await request(invalid.app)
      .get('/api/policies/operator-workflow/libraries/not-a-number')
      .expect(400);
    expect(invalid.db.query).not.toHaveBeenCalled();

    const missing = createApp({ rows: [] });
    await request(missing.app)
      .get('/api/policies/operator-workflow/libraries/6')
      .expect(404);
    expect(missing.getWorkflow).not.toHaveBeenCalled();
  });
});
