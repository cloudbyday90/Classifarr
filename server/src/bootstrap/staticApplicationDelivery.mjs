/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import path from 'node:path';
import express from 'express';

export const APP_SHELL_CACHE_CONTROL = 'no-cache';
export const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const ONE_YEAR_MS = 31_536_000_000;

/**
 * Serve the built client without allowing the SPA fallback to masquerade as a
 * retired JavaScript or stylesheet asset. Vite changes hashed asset paths on
 * every build, so assets are immutable while the HTML entry point must be
 * revalidated to discover the new paths.
 */
export function registerStaticApplicationDelivery({ app, publicDir } = {}) {
  const assetsDir = path.join(publicDir, 'assets');
  const appShellPath = path.join(publicDir, 'index.html');

  app.use('/assets', express.static(assetsDir, {
    immutable: true,
    maxAge: ONE_YEAR_MS,
    index: false,
  }));
  app.use('/assets', (_req, res) => {
    res.status(404).json({ error: 'Asset not found' });
  });

  app.use(express.static(publicDir, {
    index: false,
  }));

  app.get('{*splat}', (_req, res, next) => {
    res.set('Cache-Control', APP_SHELL_CACHE_CONTROL);
    res.sendFile(appShellPath, (error) => {
      if (error) next(error);
    });
  });
}
