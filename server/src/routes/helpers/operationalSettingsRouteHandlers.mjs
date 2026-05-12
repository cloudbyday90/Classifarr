/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import rateLimit from 'express-rate-limit';
import { sslTestLimiterConfig } from '../../config/rateLimits.mjs';
import { createDiscordSettingsHandlers } from './discordSettingsHandlers.mjs';
import { createGeneralSettingsHandlers } from './generalSettingsHandlers.mjs';
import { createPathTestingHandlers } from './pathTestingHandlers.mjs';
import { createProviderLockHandlers } from './providerLockHandlers.mjs';
import { createSetupHandlers } from './setupHandlers.mjs';
import { createSslSettingsHandlers } from './sslSettingsHandlers.mjs';
import { createWebhookSettingsHandlers } from './webhookSettingsHandlers.mjs';

export function createOperationalSettingsRouteHandlers({
  database,
  logger,
  discordBotService,
  webhookService,
  httpClient,
  pathTestService,
  providerLock,
  startupService,
  runtimeSettings,
}) {
  const discordHandlers = createDiscordSettingsHandlers({
    db: database,
    discordBotService,
    logger,
  });

  const webhookHandlers = createWebhookSettingsHandlers({
    webhookService,
    httpClient,
  });

  const sslHandlers = createSslSettingsHandlers({ db: database });

  const pathTestingHandlers = createPathTestingHandlers({
    pathTestService,
  });

  const providerLockHandlers = createProviderLockHandlers({
    providerLock,
  });

  const setupHandlers = createSetupHandlers({
    startupService,
  });

  const generalSettingsHandlers = createGeneralSettingsHandlers({
    db: database,
    runtimeSettings,
  });

  return {
    discordHandlers,
    generalSettingsHandlers,
    pathTestingHandlers,
    providerLockHandlers,
    setupHandlers,
    sslHandlers,
    sslTestLimiter: rateLimit(sslTestLimiterConfig),
    webhookHandlers,
  };
}