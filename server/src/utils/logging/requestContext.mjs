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

import os from 'node:os';
import { sanitizeData } from './sanitize.mjs';

/**
 * Builds a snapshot of system-level context at the moment of the log call.
 * Intended for inclusion in persisted error_log rows (system_context column).
 *
 * @returns {{ nodeVersion: string, platform: string, arch: string,
 *             uptime: number, memory: object, hostname: string }}
 */
export function getSystemContext() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: process.memoryUsage(),
    },
    hostname: os.hostname(),
  };
}

/**
 * Extracts and sanitizes request context from an Express `req` object.
 * Sensitive header values are redacted via sanitizeData.
 *
 * @param {import('express').Request | null | undefined} req
 * @returns {object | null}
 */
export function getRequestContext(req) {
  if (!req) return null;

  return sanitizeData({
    method: req.method,
    url: req.url,
    path: req.path,
    params: req.params,
    query: req.query,
    headers: {
      'user-agent': req.get?.('user-agent'),
      'content-type': req.get?.('content-type'),
      'origin': req.get?.('origin'),
    },
    ip: req.ip ?? req.socket?.remoteAddress,
    userId: req.user?.id,
  });
}

/**
 * Extracts an Error instance from the `data` object or `options.error`.
 * Handles both native Error objects and plain objects with a `.stack` string
 * (e.g., errors that have been JSON-serialised and re-hydrated).
 *
 * @param {object | null | undefined} data
 * @param {{ error?: unknown }} options
 * @returns {Error | null}
 */
export function extractError(data, options = {}) {
  if (options?.error instanceof Error) return options.error;

  if (!data || typeof data !== 'object') return null;

  for (const candidate of [data.error, data.err, data.exception, data.cause]) {
    if (candidate instanceof Error) return candidate;
  }

  // Plain object with a .stack string — re-hydrate as an Error for stack_trace persistence.
  const maybe = data.error;
  if (maybe && typeof maybe === 'object' && typeof maybe.stack === 'string') {
    const e = new Error(maybe.message || 'Upstream error');
    e.name = maybe.name || e.name;
    e.stack = maybe.stack;
    return e;
  }

  return null;
}
