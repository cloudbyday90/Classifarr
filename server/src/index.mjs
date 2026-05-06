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

/* eslint-disable no-console */
import dotenv from 'dotenv';
import db from './config/database.mjs';
import runtimeSettings from './config/runtimeSettings.mjs';
import discordBot from './services/discordBot.mjs';
import providerLock from './services/providerLock.mjs';
import queueService from './services/queueService.mjs';
import avxGuard from './services/avxGuard.mjs';
import { createApp } from './bootstrap/createApp.mjs';
import { initializeServices } from './bootstrap/initializeServices.mjs';
import { registerProcessHandlers, startHttpServer } from './bootstrap/runtimeLifecycle.mjs';
import { runStartupPreflight } from './bootstrap/startupPreflight.mjs';
import { createLogger, setLoggerDb } from './utils/logger.mjs';

dotenv.config({ quiet: true });

const logger = createLogger('Server');
const DEFAULT_PORT = process.env.PORT || 21324;

let server = null;

export async function startServer({
  database = db,
  discordBotService = discordBot,
  queueWorkerService = queueService,
  providerLockService = providerLock,
  runtimeSettingsService = runtimeSettings,
  avxGuardService = avxGuard,
  port = DEFAULT_PORT,
} = {}) {
  const app = createApp({
    database,
    runtimeSettings: runtimeSettingsService,
    port,
  });

  await runStartupPreflight({
    database,
    setLoggerDb,
    runtimeSettings: runtimeSettingsService,
    avxGuard: avxGuardService,
  });

  await initializeServices({
    discordBot: discordBotService,
    queueService: queueWorkerService,
    providerLock: providerLockService,
  });

  server = await startHttpServer({ app, port });
  return server;
}

export function registerServerProcessHandlers({
  processRef = process,
  queueWorkerService = queueService,
  loggerService = logger,
} = {}) {
  registerProcessHandlers({
    processRef,
    queueService: queueWorkerService,
    getServer: () => server,
    logger: loggerService,
  });
}

export async function main() {
  registerServerProcessHandlers();

  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
