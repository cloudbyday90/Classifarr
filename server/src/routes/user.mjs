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
import db from '../config/database.mjs';
import {
  auditLog,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from '../services/auth.mjs';
import authMiddleware from '../middleware/auth.mjs';
import { createUserRouter } from './userRouteShared.mjs';

const { authenticateToken } = authMiddleware;

const router = createUserRouter({
  express,
  rateLimit,
  db,
  auditLog,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
  authenticateToken,
});

export default router;
