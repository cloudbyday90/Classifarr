/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, test } from '@jest/globals';

import {
  APP_SHELL_CACHE_CONTROL,
  HASHED_ASSET_CACHE_CONTROL,
  registerStaticApplicationDelivery,
} from '../../bootstrap/staticApplicationDelivery.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

async function buildApp() {
  const publicDir = await mkdtemp(path.join(os.tmpdir(), 'classifarr-static-'));
  temporaryDirectories.push(publicDir);
  await mkdir(path.join(publicDir, 'assets'));
  await writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>Classifarr</title>');
  await writeFile(path.join(publicDir, 'assets', 'index-current.css'), 'body { color: white; }');

  const app = express();
  registerStaticApplicationDelivery({ app, publicDir });
  return app;
}

describe('static application delivery', () => {
  test('serves hashed assets as immutable content', async () => {
    const response = await request(await buildApp()).get('/assets/index-current.css');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(HASHED_ASSET_CACHE_CONTROL);
    expect(response.type).toBe('text/css');
  });

  test('does not turn a retired hashed asset into the application shell', async () => {
    const response = await request(await buildApp()).get('/assets/index-retired.css');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Asset not found' });
    expect(response.type).toBe('application/json');
  });

  test('revalidates the application shell for client-side routes', async () => {
    const response = await request(await buildApp()).get('/command-center');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(APP_SHELL_CACHE_CONTROL);
    expect(response.type).toBe('text/html');
  });
});
