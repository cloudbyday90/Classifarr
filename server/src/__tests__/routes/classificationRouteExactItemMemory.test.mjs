/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import { jest } from '@jest/globals';
import request from 'supertest';

import { errorHandler } from '../../middleware/errorHandler.mjs';
import {
  registerExactItemMemoryRoutes,
} from '../../routes/classificationRouteExactItemMemory.mjs';
import {
  PolicyRuntimeExactItemMemoryCommandError,
} from '../../services/policyRuntimeExactItemMemoryCommandService.mjs';

function createApp(commandService = { execute: jest.fn() }) {
  const app = express();
  const logger = { info: jest.fn() };

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'admin-1', username: 'admin' };
    next();
  });
  const router = express.Router();
  registerExactItemMemoryRoutes(router, {
    db: {},
    logger,
    requireReadWrite: (_req, _res, next) => next(),
    policyRuntimeExactItemMemoryCommandService: commandService,
  });
  app.use('/api/classification', router);
  app.use(errorHandler);

  return { app, logger };
}

describe('classificationRouteExactItemMemory', () => {
  test('executes an empty-body command with the authenticated actor only', async () => {
    const commandService = {
      execute: jest.fn().mockResolvedValue({
        execution: {
          statusId: 'applied',
          replayed: false,
          reasonCodes: ['authorized_outcome_source_event_claimed'],
          operations: { learning: { persisted: true } },
        },
      }),
    };
    const { app, logger } = createApp(commandService);

    const response = await request(app)
      .post('/api/classification/history/42/exact-item-memory')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'applied',
      replayed: false,
      exact_item_memory_recorded: true,
      exact_item_memory_already_present: false,
      reason_codes: ['authorized_outcome_source_event_claimed'],
    });
    expect(commandService.execute).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 42,
      actorId: 'admin',
      authorizationContext: expect.objectContaining({
        authenticated: true,
        actorId: 'admin',
      }),
    }));
    expect(logger.info).toHaveBeenCalledWith(
      'Runtime exact-item memory command completed',
      expect.objectContaining({ classification_id: 42, actor_id: 'admin' }),
    );
  });

  test('rejects client-supplied destination or learning fields', async () => {
    const commandService = { execute: jest.fn() };
    const { app } = createApp(commandService);

    const response = await request(app)
      .post('/api/classification/history/42/exact-item-memory')
      .send({ destination_library_id: 8, learning: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Exact-item memory command does not accept request fields');
    expect(commandService.execute).not.toHaveBeenCalled();
  });

  test('returns a conflict for an outdated resolution without leaking its stored details', async () => {
    const commandService = {
      execute: jest.fn().mockRejectedValue(new PolicyRuntimeExactItemMemoryCommandError(
        'runtime_exact_item_memory_final_outcome_destination_mismatch',
      )),
    };
    const { app } = createApp(commandService);

    const response = await request(app)
      .post('/api/classification/history/42/exact-item-memory')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Classification is not eligible for exact-item memory');
    expect(JSON.stringify(response.body)).not.toContain('Animated Movies');
  });

  test('returns a bounded replay result without issuing a second writer command', async () => {
    const commandService = {
      execute: jest.fn().mockResolvedValue({
        execution: {
          statusId: 'replayed',
          replayed: true,
          reasonCodes: ['authorized_outcome_source_event_replayed'],
          operations: { learning: null },
        },
      }),
    };
    const { app } = createApp(commandService);

    const response = await request(app)
      .post('/api/classification/history/42/exact-item-memory')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'replayed',
      replayed: true,
      exact_item_memory_recorded: false,
      exact_item_memory_already_present: false,
    });
    expect(commandService.execute).toHaveBeenCalledTimes(1);
  });
});
