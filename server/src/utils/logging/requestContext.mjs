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
import { types } from 'node:util';
import { sanitizeData } from './sanitize.mjs';
import { requestLogQuery, requestLogUrl } from './requestLogPrivacy.mjs';
import { isNativeError } from './nativeError.mjs';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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
 * @returns {Record<string, unknown> | null}
 */
export function getRequestContext(req) {
  if (!req) return null;

  const context = sanitizeData({
    method: req.method,
    url: requestLogUrl(req.url),
    path: req.path,
    params: req.params,
    query: requestLogQuery(req.query),
    headers: {
      'user-agent': req.get?.('user-agent'),
      'content-type': req.get?.('content-type'),
      'origin': req.get?.('origin'),
    },
    ip: req.ip ?? req.socket?.remoteAddress,
    userId: req.user?.id,
  });

  return isRecord(context) ? context : null;
}

/**
 * Extracts an Error instance from the `data` object or `options.error`.
 * Handles both native Error objects and plain objects with a `.stack` string
 * (e.g., errors that have been JSON-serialised and re-hydrated).
 *
 * @param {unknown} data
 * @param {{ error?: unknown }} options
 * @returns {Error | null}
 */
export function extractError(data, options = {}) {
  const optionError = ownDataValue(options, 'error');
  if (!types.isProxy(optionError) && isNativeError(optionError)) return optionError;
  // Preserve the existing data-container boundary; array side properties were
  // never upstream error references, even though array indices are loggable.
  if (!data || typeof data !== 'object' || types.isProxy(data) || Array.isArray(data)) return null;

  for (const key of ['error', 'err', 'exception', 'cause']) {
    const candidate = ownDataValue(data, key);
    if (!types.isProxy(candidate) && isNativeError(candidate)) return candidate;
  }

  // Hydrate only own string data properties; stack materialization for a native
  // Error remains the separate existing persistence policy (including its hook).
  const maybe = ownDataValue(data, 'error');
  if (!maybe || typeof maybe !== 'object' || types.isProxy(maybe)) return null;
  const prototype = Object.getPrototypeOf(maybe);
  if (prototype !== null && prototype !== Object.prototype) return null;
  const stack = ownDataValue(maybe, 'stack');
  if (typeof stack !== 'string') return null;
  const message = ownDataValue(maybe, 'message'), name = ownDataValue(maybe, 'name');
  const error = new Error(typeof message === 'string' ? message : 'Upstream error');
  if (typeof name === 'string') error.name = name;
  error.stack = stack;
  return error;
}

function ownDataValue(value, key) {
  if (!value || typeof value !== 'object' || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}
