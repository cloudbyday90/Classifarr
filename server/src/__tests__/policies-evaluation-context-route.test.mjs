import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import {
  registerPolicyEvaluationContextRoute,
} from '../routes/policiesRouteEvaluationContext.mjs';

describe('Policy evaluation context route', () => {
  test('returns a bounded fingerprint without returning policy content', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{
          policy: { id: 7, name: 'Private family policy', enabled: true },
          library: { id: 4, media_type: 'movie', is_active: true },
        }] })
        .mockResolvedValueOnce({ rows: [{
          attachment: { policy_id: 7, preset_id: 2, weight: 1 },
          preset: { id: 2, signals: { genres: ['Family'] } },
        }] })
        .mockResolvedValueOnce({ rows: [{ intent: { id: 19, policy_id: 7, intent_version: 3 } }] })
        .mockResolvedValueOnce({ rows: [{ rule: { intent_id: 19, values: { require_any: ['Family'] } } }] })
        .mockResolvedValueOnce({ rows: [{ template: { intent_id: 19, preset_id: 2, weight: 1 } }] }),
    };
    const app = express();
    const router = express.Router();
    registerPolicyEvaluationContextRoute(router, { db });
    app.use('/api/policies', router);

    const response = await request(app)
      .get('/api/policies/evaluation-context')
      .expect(200);

    expect(response.body).toEqual({
      version: 'classifarr.ai_classification_evaluation_policy_context.v1',
      algorithm: 'sha256',
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      provenance: {
        policyCount: 1,
        presetAttachmentCount: 1,
        activeNativeIntentCount: 1,
        activeNativeRuleCount: 1,
        activeNativeTemplateCount: 1,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('Private family policy');
    expect(db.query).toHaveBeenCalledTimes(5);
    expect(db.query.mock.calls[0][0]).toContain('to_jsonb(lp) AS policy');
    expect(db.query.mock.calls[3][0]).toContain('intent.active = TRUE');
  });
});
