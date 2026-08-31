/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ForbiddenError } from '../utils/appError.mjs';

/**
 * Rechecks the administrator and authenticated actor boundary for every
 * redacted-review operation. The parent policies router has the same broad
 * guard, but these endpoints are deliberately safe when registered elsewhere.
 */
export function requireReviewProjectionAdministrator(req) {
  const actorId = Number(req.user?.id);
  if (req.user?.role !== 'admin' || !Number.isInteger(actorId) || actorId <= 0) {
    throw new ForbiddenError('Admin access required');
  }
  return actorId;
}

export function createReviewProjectionLimiter(rateLimit, config) {
  return typeof rateLimit === 'function' ? rateLimit(config) : (_req, _res, next) => next();
}

export function preventReviewProjectionResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}
