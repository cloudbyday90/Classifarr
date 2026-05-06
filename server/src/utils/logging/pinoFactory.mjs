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

import pino from 'pino';
import path from 'node:path';
import { LOG_CONFIG, SENSITIVE_FIELD_PATHS } from './logConfig.mjs';

/**
 * Build the pino serializer/formatter options. Separated from transport config
 * so that unit tests can verify the options independently.
 *
 * @param {{ level: string }} config - Subset of LOG_CONFIG.
 * @returns {import('pino').LoggerOptions}
 */
export function buildPinoOptions(config = LOG_CONFIG) {
  return {
    level: config.level,
    redact: {
      // Pino redact operates on top-level keys of the merging object.
      // SENSITIVE_FIELD_PATHS covers the flat fields that callers pass directly.
      paths: [...SENSITIVE_FIELD_PATHS],
      censor: '[REDACTED]',
    },
    formatters: {
      // Emit "level":"info" string instead of pino's default numeric level field.
      level: (label) => ({ level: label }),
    },
    base: { pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

/**
 * Build the pino transport destination for non-test environments.
 * Writes to stdout AND to two rolling log files (all + error-only).
 *
 * @param {{ logDir: string, maxFileSizeBytes: number, fileLoggingEnabled: boolean, level: string }} config
 * @returns {import('pino').DestinationStream}
 */
export function buildTransport(config = LOG_CONFIG) {
  const targets = [
    {
      target: 'pino/file',
      options: { destination: 1 },  // fd 1 = stdout
      level: config.level,
    },
  ];

  if (config.fileLoggingEnabled) {
    const sizeSpec = `${Math.floor(config.maxFileSizeBytes / (1024 * 1024))}m`;

    targets.push({
      target: 'pino-roll',
      options: {
        file: path.join(config.logDir, 'classifarr.log'),
        size: sizeSpec,
        mkdir: true,
      },
      level: config.level,
    });

    targets.push({
      target: 'pino-roll',
      options: {
        file: path.join(config.logDir, 'error.log'),
        size: sizeSpec,
        mkdir: true,
      },
      level: 'warn',
    });
  }

  return pino.transport({ targets });
}

/**
 * Create the root pino logger instance.
 *
 * In test environments (NODE_ENV === 'test') we bypass the worker-thread
 * transport entirely and write synchronously to stdout so that Jest can
 * capture output without flakiness.
 *
 * @param {object} [config] - Defaults to LOG_CONFIG.
 * @returns {import('pino').Logger}
 */
export function createRootLogger(config = LOG_CONFIG) {
  const options = buildPinoOptions(config);

  if (process.env.NODE_ENV === 'test') {
    // Use a plain object with a synchronous `write` method.
    // pino accepts any { write } object as a destination — no Writable needed.
    // Forwarding WARN/ERROR to console.warn/console.error preserves the
    // observable behavior that tests spy on, while completely avoiding
    // sonic-boom's fs.writeSync (which breaks when tests mock the `fs` module).
    const testStream = {
      write: (msg) => {
        try {
          const obj = JSON.parse(msg.trim());
          // pino numeric levels: 40 = warn, 50 = error, 60 = fatal
          if (obj.level >= 50) {
            console.error(obj.msg);
          } else if (obj.level >= 40) {
            console.warn(obj.msg);
          }
        } catch (_e) { /* ignore non-JSON */ }
      },
    };
    return pino(options, testStream);
  }

  return pino(options, buildTransport(config));
}
