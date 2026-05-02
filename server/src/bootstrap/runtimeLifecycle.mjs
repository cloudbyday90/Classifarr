/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import os from 'node:os';
import v8 from 'node:v8';

function defaultExit(code) {
  process.exit(code);
}

function defaultSetTimeout(callback, delayMs) {
  return setTimeout(callback, delayMs);
}

function logStartupBanner(port) {
  console.log(`Classifarr server running on port ${port}`);
  console.log(`API Documentation: http://localhost:${port}/api/docs`);
  console.log(`Health Check: http://localhost:${port}/health`);

  const hasExplicitCap = (process.env.NODE_OPTIONS || '').includes('max-old-space-size');
  if (hasExplicitCap) {
    return;
  }

  const heapLimitMb = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  console.warn(
    `[WARN] --max-old-space-size not set. Node.js heap auto-capped at ~${heapLimitMb} MB. ` +
    `Free RAM: ${freeMemMb} MB / ${totalMemMb} MB. ` +
    `On low-memory hosts this can cause OOM crashes. ` +
    `Set memory limits in docker-compose or pass NODE_OPTIONS=--max-old-space-size=<MB>.`
  );
}

export async function startHttpServer({ app, port, host = '0.0.0.0' }) {
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      logStartupBanner(port);
      queueMicrotask(() => resolve(server));
    });
  });
}

export async function gracefulShutdown({
  signal,
  queueService,
  server,
  exit = defaultExit,
  setTimeoutFn = defaultSetTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  console.log(`Received ${signal}, starting graceful shutdown`);

  const forceExit = setTimeoutFn(() => {
    console.error('Graceful shutdown timed out after 10 s, forcing exit');
    exit(1);
  }, 10_000);
  forceExit.unref?.();

  try {
    await queueService.gracefulShutdown();
  } catch (error) {
    console.error('Queue graceful shutdown error:', error.message);
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        console.log('HTTP server closed');
        resolve();
      });
    });
  }

  clearTimeoutFn(forceExit);
  exit(0);
}

export function normalizeUnhandledReason(reason) {
  if (reason instanceof Error) {
    return {
      name: reason.name,
      message: reason.message,
    };
  }

  if (typeof reason === 'string') {
    return { message: reason };
  }

  return { reason };
}

export function registerProcessHandlers({
  processRef = process,
  queueService,
  getServer,
  logger,
  exit = defaultExit,
  setTimeoutFn = defaultSetTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  processRef.on('SIGTERM', () => gracefulShutdown({
    signal: 'SIGTERM',
    queueService,
    server: getServer(),
    exit,
    setTimeoutFn,
    clearTimeoutFn,
  }));

  processRef.on('SIGINT', () => gracefulShutdown({
    signal: 'SIGINT',
    queueService,
    server: getServer(),
    exit,
    setTimeoutFn,
    clearTimeoutFn,
  }));

  processRef.on('unhandledRejection', (reason, promise) => {
    const payload = {
      ...normalizeUnhandledReason(reason),
      promiseType: typeof promise,
    };
    const options = reason instanceof Error ? { error: reason } : {};
    logger.error('Unhandled promise rejection', payload, options);
  });

  processRef.on('uncaughtException', (error) => {
    const forceExit = setTimeoutFn(() => {
      exit(1);
    }, 5000);
    forceExit.unref?.();

    logger.error(
      'Uncaught exception encountered; exiting process',
      { error: error.message, name: error.name },
      { error }
    ).finally(() => {
      clearTimeoutFn(forceExit);
      exit(1);
    });
  });
}
