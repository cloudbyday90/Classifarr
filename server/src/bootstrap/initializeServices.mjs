/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import db from '../config/database.mjs';
import defaultAuthService from '../services/auth.mjs';
import backfillOrchestrator from '../services/backfillOrchestrator.mjs';
import defaultApiKeyService from '../services/apiKeyService.shared.js';
import defaultEmbeddingMigrationService from '../services/embeddingMigrationService.mjs';
import defaultHealthCheckService from '../services/healthCheckService.mjs';
import defaultLibraryProfileService from '../services/libraryProfileService.mjs';
import defaultOllamaService from '../services/ollama.mjs';
import defaultSchedulerService from '../services/scheduler.mjs';
import defaultStartupService from '../services/startupService.mjs';
import * as graphRelationshipBackfillServiceModule from '../services/graphRelationshipBackfillService.mjs';
import defaultWebhookService from '../services/webhook.mjs';
import ratingNormalizer from '../utils/ratingNormalizer.mjs';

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
    console.error('Runtime wiring validation bootstrap failed:', error.message);
  }

  return runtimeWiringStatus;
}

async function revokeStartupSessions(authService) {
  try {
    const revoked = await authService.revokeAllRefreshTokensOnStartup();
    console.log(`Sessions cleared on startup (${revoked} non-persistent token(s) revoked)`);
  } catch (error) {
    console.warn('Startup session invalidation failed:', error.message);
  }
}

async function initializeDiscordBot(discordBot) {
  try {
    console.log('Initializing Discord bot...');
    await discordBot.initialize();
    console.log('Discord bot initialized successfully');
  } catch (error) {
    console.warn('Discord bot initialization failed:', error.message);
    console.warn('Continuing without Discord notifications...');
  }
}

function startQueueAndScheduler(queueService, schedulerService, runtimeWiringStatus) {
  if (!runtimeWiringStatus.ok) {
    console.error('Runtime wiring validation failed; queue and scheduler startup skipped', runtimeWiringStatus);
    return;
  }

  try {
    queueService.startWorker();
    console.log('Queue worker started successfully');
  } catch (error) {
    console.warn('Queue worker start failed:', error.message);
  }

  try {
    schedulerService.init();
    console.log('Scheduler service started successfully');
  } catch (error) {
    console.warn('Scheduler service start failed:', error.message);
  }
}

async function initializeProviderLock(providerLock) {
  try {
    await providerLock.init();
    console.log('ProviderLock configuration loaded');
  } catch (error) {
    console.warn('ProviderLock configuration load failed:', error.message);
  }
}

function startHealthHeartbeat(healthCheckService) {
  try {
    healthCheckService.startHeartbeat(15 * 60 * 1000);
    console.log('Health check heartbeat started (15 min interval)');
  } catch (error) {
    console.warn('Health check heartbeat failed to start:', error.message);
  }
}

function startOllamaPreflight(ollamaService) {
  try {
    ollamaService.startScheduledPreflight(24 * 60 * 60 * 1000);
    console.log('Ollama scheduled preflight check started (24 hour interval)');
  } catch (error) {
    console.warn('Ollama scheduled preflight check failed to start:', error.message);
  }
}

async function checkEmbeddingMigration(embeddingMigrationService) {
  try {
    await embeddingMigrationService.checkAndStartMigration();
    console.log('Embedding migration check completed');
  } catch (error) {
    console.warn('Embedding migration check failed:', error.message);
  }
}

async function initializeBackfillOrchestrator(backfillOrchestratorService) {
  try {
    await backfillOrchestratorService.init();
    console.log('Backfill orchestrator initialized');
  } catch (error) {
    console.warn('Backfill orchestrator initialization failed:', error.message);
  }
}

async function startGraphRelationshipBackfill(graphRelationshipBackfillService) {
  try {
    graphRelationshipBackfillService.checkAndBackfill().catch(error => {
      console.warn('Graph relationship backfill check failed:', error.message);
    });
  } catch (error) {
    console.warn('Graph relationship backfill service not available:', error.message);
  }
}

function startLibraryProfiles(libraryProfileService) {
  try {
    libraryProfileService.generateAllProfiles().then(results => {
      const success = results.filter(result => result.success).length;
      const failed = results.filter(result => !result.success).length;
      console.log(`Startup library profile generation complete: ${success} success, ${failed} failed`);
    }).catch(error => {
      console.warn('Startup library profile generation failed:', error.message);
    });
  } catch (error) {
    console.warn('Library profile service not available:', error.message);
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
      console.log(`Startup policy generation: Created ${result.rows.length} policies for libraries without one`);
    }
  } catch (error) {
    console.warn('Startup policy generation failed:', error.message);
  }
}

async function queueRatingNormalization(database, ratingNormalizerService) {
  try {
    const needsSQL = ratingNormalizerService.getNeedsNormalizationSQL();

    const result = await database.query(`
      SELECT COUNT(*) as count FROM media_server_items
      WHERE original_rating IS NULL
        AND content_rating IS NOT NULL
        AND ${needsSQL}
    `);

    const count = parseInt(result.rows[0].count, 10);

    if (count > 0) {
      console.log(`Auto-queuing first 1000 items for rating normalization (${count} total need normalization)`);

      await database.query(`
        INSERT INTO task_queue (task_type, priority, payload, status)
        SELECT 'rating_normalization', 5, jsonb_build_object('media_item_id', msi.id), 'pending'
        FROM media_server_items msi
        WHERE msi.original_rating IS NULL
          AND msi.content_rating IS NOT NULL
          AND ${needsSQL}
          AND NOT EXISTS (
            SELECT 1 FROM task_queue tq
            WHERE tq.task_type = 'rating_normalization'
              AND tq.status IN ('pending', 'processing')
              AND (tq.payload->>'media_item_id')::bigint = msi.id
          )
        LIMIT 1000
      `);
    }
  } catch (error) {
    console.warn('Startup rating normalization check failed:', error.message);
  }
}

async function ensureDefaultApiKey(apiKeyService) {
  try {
    await apiKeyService.ensureDefaultApiKey();
  } catch (error) {
    console.warn('Default API key generation failed:', error.message);
  }
}

async function ensureWebhookSecret(webhookService) {
  try {
    await webhookService.ensureSecretKey();
  } catch (error) {
    console.warn('Webhook secret key generation failed:', error.message);
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
  await queueRatingNormalization(database, ratingNormalizerService);
  await ensureDefaultApiKey(apiKeyService);
  await ensureWebhookSecret(webhookService);
}
