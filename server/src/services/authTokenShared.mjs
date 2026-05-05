/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import crypto from 'node:crypto';
import { REMEMBER_ME_EXPIRY_DAYS, SESSION_EXPIRY_HOURS } from './authShared.mjs';

function generateRefreshTokenString() {
  return crypto.randomBytes(48).toString('base64url');
}

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resolveRefreshTokenExpiry(rememberMe = false, slideFromDate = null) {
  const expiresAt = new Date();

  if (rememberMe) {
    const base = slideFromDate ? new Date(Math.max(slideFromDate, Date.now())) : expiresAt;
    expiresAt.setTime(base.getTime());
    expiresAt.setDate(expiresAt.getDate() + REMEMBER_ME_EXPIRY_DAYS);
    return expiresAt;
  }

  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);
  return expiresAt;
}

export {
  generateRefreshTokenString,
  hashToken,
  resolveRefreshTokenExpiry,
};
