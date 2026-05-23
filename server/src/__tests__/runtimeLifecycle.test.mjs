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
import consoleHelpers from './setup/consoleHelpers.mjs';
import {
  gracefulShutdown,
  normalizeUnhandledReason,
  registerProcessHandlers,
  startHttpServer,
} from '../bootstrap/runtimeLifecycle.mjs';

const { createConsoleSpy } = consoleHelpers;

describe('runtimeLifecycle', () => {
  let consoleLogHandle;
  let consoleWarnHandle;
  let consoleErrorHandle;

  beforeEach(() => {
    consoleLogHandle = createConsoleSpy('log', { suppress: true });
    consoleWarnHandle = createConsoleSpy('warn', { suppress: true });
    consoleErrorHandle = createConsoleSpy('error', { suppress: true });
  });

  afterEach(() => {
    consoleLogHandle.restore();
    consoleWarnHandle.restore();
    consoleErrorHandle.restore();
  });

  it('starts the http server and returns the created server', async () => {
    const fakeServer = { close: jest.fn() };
    const app = {
      listen: jest.fn((port, host, callback) => {
        callback();
        return fakeServer;
      }),
    };

    const server = await startHttpServer({ app, port: 21324 });

    expect(app.listen).toHaveBeenCalledWith(21324, '0.0.0.0', expect.any(Function));
    expect(server).toBe(fakeServer);
  });

  it('shuts down the queue worker and closes the server before exiting', async () => {
    const queueService = {
      gracefulShutdown: jest.fn().mockResolvedValue(),
    };
    const server = {
      close: jest.fn((callback) => callback()),
    };
    const exit = jest.fn();
    const forceExit = { unref: jest.fn() };
    const setTimeoutFn = jest.fn(() => forceExit);
    const clearTimeoutFn = jest.fn();

    await gracefulShutdown({
      signal: 'SIGTERM',
      queueService,
      server,
      exit,
      setTimeoutFn,
      clearTimeoutFn,
    });

    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 10_000);
    expect(queueService.gracefulShutdown).toHaveBeenCalled();
    expect(server.close).toHaveBeenCalled();
    expect(clearTimeoutFn).toHaveBeenCalledWith(forceExit);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('registers process handlers that report unhandled failures through the logger', async () => {
    const handlers = new Map();
    const processRef = {
      on: jest.fn((event, handler) => {
        handlers.set(event, handler);
      }),
    };
    const logger = {
      error: jest.fn().mockResolvedValue(),
    };
    const queueService = {
      gracefulShutdown: jest.fn().mockResolvedValue(),
    };
    const server = {
      close: jest.fn((callback) => callback()),
    };
    const exit = jest.fn();

    registerProcessHandlers({
      processRef,
      queueService,
      getServer: () => server,
      logger,
      exit,
    });

    expect(processRef.on).toHaveBeenCalledTimes(4);

    handlers.get('unhandledRejection')(new Error('boom'), Promise.resolve());
    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled promise rejection',
      expect.objectContaining({ message: 'boom', name: 'Error', promiseType: 'object' }),
      expect.objectContaining({ error: expect.any(Error) })
    );

    await handlers.get('uncaughtException')(new Error('fatal'));
    expect(logger.error).toHaveBeenCalledWith(
      'Uncaught exception encountered; exiting process',
      { error: 'fatal', name: 'Error' },
      expect.objectContaining({ error: expect.any(Error) })
    );
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('normalizes string and error rejection payloads', () => {
    expect(normalizeUnhandledReason('broken')).toEqual({ message: 'broken' });
    expect(normalizeUnhandledReason(new Error('kaput'))).toEqual({ name: 'Error', message: 'kaput' });
  });
});
