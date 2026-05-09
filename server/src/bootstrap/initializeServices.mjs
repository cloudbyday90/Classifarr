/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createLogger } from '../utils/logger.mjs';
import * as db from '../config/database.mjs';
import * as defaultAuthService from '../services/auth.mjs';
import { backfillOrchestrator } from '../services/backfillOrchestrator.mjs';
import * as defaultApiKeyService from '../services/apiKeyService.mjs';
import { embeddingMigrationService as defaultEmbeddingMigrationService } from '../services/embeddingMigrationService.mjs';
import * as defaultHealthCheckService from '../services/healthCheckService.mjs';
import { libraryProfileService as defaultLibraryProfileService } from '../services/libraryProfileService.mjs';
import { ollamaService as defaultOllamaService } from '../services/ollama.mjs';
import { schedulerService as defaultSchedulerService } from '../services/scheduler.mjs';
import { startupService as defaultStartupService } from '../services/startupService.mjs';
import * as graphRelationshipBackfillServiceModule from '../services/graphRelationshipBackfillService.mjs';
import { webhookService as defaultWebhookService } from '../services/webhook.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';
import { RatingNormalizationQueueService } from '../services/ratingNormalizationQueueService.mjs';

const logger = createLogger('Bootstrap');

function validateRuntimeWiring(startupService) {
  let runtimeWiringStatus = { ok: true, checked: 0, issues: [] };

  try {
    runtimeWiringStatus = startupService.validateRuntimeWiring();
  } catch (error) {
    runtimeWiringStatus = {
      ok: false,
      checked: 0,
      issues: [{
        module: './services/startupService',
        expected: 'runtime wiring validation',
        actual: error.message,
      }],
    };
    logger.error('Runtime wiring validation bootstrap failed:', { error: error.message });
  }

  return runtimeWiringStatus;
}

async function revokeStartupSessions(authService) {
  try {
    const revoked = await authService.revokeAllRefreshTokensOnStartup();
    logger.info(`Sessions cleared on startup (${revoked} non-persistent token(s) revoked)`);
  } catch (error) {
    logger.warn('Startup session invalidation failed:', { error: error.message });
  }
}

async function initializeDiscordBot(discordBot) {
  try {
    logger.info('Initializing Discord bot...');
    await discordBot.initialize();
    logger.info('Discord bot initialized successfully');
  } catch (error) {
    logger.warn('Discord bot initialization failed:', { error: error.message });
    logger.warn('Continuing without Discord notifications...');
  }
}

function startQueueAndScheduler(queueService, schedulerService, runtimeWiringStatus) {
  if (!runtimeWiringStatus.ok) {
    logger.error('Runtime wiring validation failed; queue and scheduler startup skipped', { runtimeWiringStatus });
    return;
  }

  try {
    queueService.startWorker();
    logger.info('Queue worker started successfully');
  } catch (error) {
    logger.warn('Queue worker start failed:', { error: error.message });
  }

  try {
    schedulerService.init();
    logger.info('Scheduler service started successfully');
  } catch (error) {
    logger.warn('Scheduler service start failed:', { error: error.message });
  }
}

async function initializeProviderLock(providerLock) {
  try {
    await providerLock.init();
    logger.info('ProviderLock configuration loaded');
  } catch (error) {
    logger.warn('ProviderLock configuration load failed:', { error: error.message });
  }
}

function startHealthHeartbeat(healthCheckService) {
  try {
    healthCheckService.startHeartbeat(15 * 60 * 1000);
    logger.info('Health check heartbeat started (15 min interval)');
  } catch (error) {
    logger.warn('Health check heartbeat failed to start:', { error: error.message });
  }
}

function startOllamaPreflight(ollamaService) {
  try {
    ollamaService.startScheduledPreflight(24 * 60 * 60 * 1000);
    logger.info('Ollama scheduled preflight check started (24 hour interval)');
  } catch (error) {
    logger.warn('Ollama scheduled preflight check failed to start:', { error: error.message });
  }
}

async function checkEmbeddingMigration(embeddingMigrationService) {
  try {
    await embeddingMigrationService.checkAndStartMigration();
    logger.info('Embedding migration check completed');
  } catch (error) {
    logger.warn('Embedding migration check failed:', { error: error.message });
  }
}

async function initializeBackfillOrchestrator(backfillOrchestratorService) {
  try {
    await backfillOrchestratorService.init();
    logger.info('Backfill orchestrator initialized');
  } catch (error) {
    logger.warn('Backfill orchestrator initialization failed:', { error: error.message });
  }
}

async function startGraphRelationshipBackfill(graphRelationshipBackfillService) {
  try {
    graphRelationshipBackfillService.checkAndBackfill().catch(error => {
      logger.warn('Graph relationship backfill check failed:', { error: error.message });
    });
  } catch (error) {
    logger.warn('Graph relationship backfill service not available:', { error: error.message });
  }
}

function startLibraryProfiles(libraryProfileService) {
  try {
    libraryProfileService.generateAllProfiles().then(results => {
      const success = results.filter(result => result.success).length;
      const failed = results.filter(result => !result.success).length;
      logger.info(`Startup library profile generation complete: ${success} success, ${failed} failed`);
    }).catch(error => {
      logger.warn('Startup library profile generation failed:', { error: error.message });
    });
  } catch (error) {
    logger.warn('Library profile service not available:', { error: error.message });
  }
}

async function generateMissingPolicies(database) {
  try {
    const result = await database.query(`
      INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
      SELECT 
        l.id,
        l.name || ' Policy',
        'Auto-generated policy for ' || l.name,
        true,
        5,
        85,
        60
      FROM libraries l
      WHERE NOT EXISTS (
        SELECT 1 FROM library_policies lp WHERE lp.library_id = l.id
      )
      RETURNING library_id
    `);

    if (result.rows.length > 0) {
      logger.info(`Startup policy generation: Created ${result.rows.length} policies for libraries without one`);
    }
  } catch (error) {
    logger.warn('Startup policy generation failed:', { error: error.message });
  }
}

async function ensureDefaultApiKey(apiKeyService) {
  try {
    await apiKeyService.ensureDefaultApiKey();
  } catch (error) {
    logger.warn('Default API key generation failed:', { error: error.message });
  }
}

async function ensureWebhookSecret(webhookService) {
  try {
    await webhookService.ensureSecretKey();
  } catch (error) {
    logger.warn('Webhook secret key generation failed:', { error: error.message });
  }
}

export async function initializeServices({
  discordBot,
  queueService,
  providerLock,
  authService = defaultAuthService,
  apiKeyService = defaultApiKeyService,
  embeddingMigrationService = defaultEmbeddingMigrationService,
  healthCheckService = defaultHealthCheckService,
  libraryProfileService = defaultLibraryProfileService,
  ollamaService = defaultOllamaService,
  schedulerService = defaultSchedulerService,
  startupService = defaultStartupService,
  webhookService = defaultWebhookService,
  backfillOrchestratorService = backfillOrchestrator,
  graphRelationshipBackfillService = graphRelationshipBackfillServiceModule,
  ratingNormalizerService = ratingNormalizer,
  ratingNormalizationQueueService,
  database = db,
}) {
  const runtimeWiringStatus = validateRuntimeWiring(startupService);

  await revokeStartupSessions(authService);
  await initializeDiscordBot(discordBot);
  startQueueAndScheduler(queueService, schedulerService, runtimeWiringStatus);
  await initializeProviderLock(providerLock);
  startHealthHeartbeat(healthCheckService);
  startOllamaPreflight(ollamaService);
  await checkEmbeddingMigration(embeddingMigrationService);
  await initializeBackfillOrchestrator(backfillOrchestratorService);
  await startGraphRelationshipBackfill(graphRelationshipBackfillService);
  startLibraryProfiles(libraryProfileService);
  await generateMissingPolicies(database);
  const startupRatingNormalizationQueue = ratingNormalizationQueueService || new RatingNormalizationQueueService({
    db: database,
    ratingNormalizer: ratingNormalizerService,
  });
  await startupRatingNormalizationQueue.queueStartupBackfill();
  await ensureDefaultApiKey(apiKeyService);
  await ensureWebhookSecret(webhookService);
}
