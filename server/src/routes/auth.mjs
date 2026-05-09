/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import * as db from '../config/database.mjs';
import {
  authenticate,
  auditLog,
  generateAccessToken,
  generateRefreshToken,
  getCookieOptions,
  getRefreshTokenCookieOptions,
  hashPassword,
  hashToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  validatePasswordStrength,
  validateRefreshToken,
  verifyPassword,
} from '../services/auth.mjs';
import * as runtimeSettings from '../config/runtimeSettings.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import { issueCsrfToken, clearCsrfToken } from '../middleware/csrf.mjs';
import { resolveSecureCookieFlag } from '../utils/cookieSecurity.shared.js';
import { createAuthRouter } from './authRouteShared.mjs';

export const router = createAuthRouter({
  express,
  rateLimit,
  db,
  authenticate,
  auditLog,
  generateAccessToken,
  generateRefreshToken,
  getCookieOptions,
  getRefreshTokenCookieOptions,
  hashPassword,
  hashToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  validatePasswordStrength,
  validateRefreshToken,
  verifyPassword,
  runtimeSettings,
  authenticateToken,
  issueCsrfToken,
  clearCsrfToken,
  resolveSecureCookieFlag,
});
