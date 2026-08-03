import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyAuthoringProposalRoutes,
} from '../routes/policiesRoutePolicyAuthoringProposal.mjs';
import { policyAuthoringProposalLimiterConfig } from '../config/rateLimits.mjs';

const PROPOSAL_REFERENCE = 'C5CSeInFAbrQK1soKk5dW-4faH0sZNqj-ZXo3mV45xA';
const PROPOSAL_REVISION = 'a'.repeat(64);
const IDEMPOTENCY_KEY = '6fe3d170-9390-4ec5-95f7-42ad6f8ec777';

function createApp({ user = { id: 7, role: 'admin' }, lifecycle = {}, prepare = {}, admit = {} } = {}) {
  const proposalLifecycleService = {
    getLifecycle: jest.fn().mockResolvedValue({
      statusId: 'eligible_to_prepare_proposal',
      library: { id: 6, name: 'Animated Movies', mediaType: 'movie' },
      ...lifecycle,
    }),
    prepareProposal: jest.fn().mockResolvedValue({
      statusId: 'proposal_prepared',
      proposal: { reference: PROPOSAL_REFERENCE, revision: PROPOSAL_REVISION },
      ...prepare,
    }),
    admitProposal: jest.fn().mockResolvedValue({
      statusId: 'proposal_admission_created',
      policy: { id: 81, libraryId: 6, name: 'Animated Movies Policy' },
      ...admit,
    }),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const logger = { info: jest.fn() };
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyAuthoringProposalRoutes(router, {
    db: {},
    logger,
    rateLimit,
    proposalLifecycleService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, proposalLifecycleService, rateLimit, logger };
}

describe('policy authoring proposal routes', () => {
  test('reads a bounded lifecycle for an administrator', async () => {
    const { app, proposalLifecycleService } = createApp();

    const response = await request(app)
      .get('/api/policies/operator-workflow/libraries/6/authoring-lifecycle')
      .expect(200);

    expect(response.body.statusId).toBe('eligible_to_prepare_proposal');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(proposalLifecycleService.getLifecycle).toHaveBeenCalledWith({ db: {}, libraryId: 6 });
  });

  test('rejects a non-administrator before lifecycle service access', async () => {
    const { app, proposalLifecycleService } = createApp({ user: { id: 8, role: 'operator' } });

    await request(app)
      .get('/api/policies/operator-workflow/libraries/6/authoring-lifecycle')
      .expect(403);

    expect(proposalLifecycleService.getLifecycle).not.toHaveBeenCalled();
  });

  test('requires an empty prepare request and applies the bounded limiter', async () => {
    const { app, proposalLifecycleService, rateLimit } = createApp();

    await request(app)
      .post('/api/policies/operator-workflow/libraries/6/proposals')
      .send({ declared_intent: { purpose: [] } })
      .expect(400);

    expect(rateLimit).toHaveBeenCalledWith(policyAuthoringProposalLimiterConfig);
    expect(proposalLifecycleService.prepareProposal).not.toHaveBeenCalled();
  });

  test('returns a bounded conflict result for stale admission', async () => {
    const { app, proposalLifecycleService } = createApp({
      admit: { statusId: 'proposal_stale', policy: null },
    });

    const response = await request(app)
      .post(`/api/policies/operator-workflow/libraries/6/proposals/${PROPOSAL_REFERENCE}/admission`)
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({
        proposal_revision: PROPOSAL_REVISION,
        adjustment_commands: [
          { command_id: 'set_helpful_studios', values: ['Studio Example'] },
          { command_id: 'set_purpose_genres', values: ['Animation'] },
        ],
      })
      .expect(409);

    expect(response.body).toEqual(expect.objectContaining({ statusId: 'proposal_stale' }));
    expect(proposalLifecycleService.admitProposal).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 6,
      actorId: 7,
      proposalReference: PROPOSAL_REFERENCE,
      proposalRevision: PROPOSAL_REVISION,
      idempotencyKey: IDEMPOTENCY_KEY,
      adjustmentCommands: [
        { commandId: 'set_purpose_genres', values: ['Animation'] },
        { commandId: 'set_helpful_studios', values: ['Studio Example'] },
      ],
    }));
  });

  test('requires a valid idempotency key before proposal admission', async () => {
    const { app, proposalLifecycleService } = createApp();

    await request(app)
      .post(`/api/policies/operator-workflow/libraries/6/proposals/${PROPOSAL_REFERENCE}/admission`)
      .send({ proposal_revision: PROPOSAL_REVISION, adjustment_commands: [] })
      .expect(400);

    expect(proposalLifecycleService.admitProposal).not.toHaveBeenCalled();
  });

  test('rejects malformed opaque proposal references before service access', async () => {
    const { app, proposalLifecycleService } = createApp();

    await request(app)
      .post('/api/policies/operator-workflow/libraries/6/proposals/not-a-reference/admission')
      .set('Idempotency-Key', IDEMPOTENCY_KEY)
      .send({ proposal_revision: PROPOSAL_REVISION, adjustment_commands: [] })
      .expect(400);

    expect(proposalLifecycleService.admitProposal).not.toHaveBeenCalled();
  });
});
