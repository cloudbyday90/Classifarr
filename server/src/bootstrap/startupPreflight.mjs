/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { migrationRunner } from '../config/migrations.mjs';
import { clarificationService } from '../services/clarificationService.mjs';
import { policyThresholdIntegrityService } from '../services/policyThresholdIntegrityService.mjs';
import { postUpgradeService } from '../services/postUpgradeService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('Preflight');

async function runMigrations(migrationRunner) {
  try {
    const result = await migrationRunner.run();
    logger.info(`Migrations complete (${result.total} total, ${result.applied} newly applied)`);
  } catch (migrationError) {
    logger.error('Migration error:', { error: migrationError.message });
  }
}

async function prewarmHnswIndexes(database) {
  try {
    const prewarmResult = await database.prewarmHnswIndexes();
    if (prewarmResult.loaded) {
      logger.info(`HNSW indexes prewarmed: ${prewarmResult.blocks.text} text blocks, ${prewarmResult.blocks.image} image blocks`);
    }
  } catch (prewarmError) {
    logger.warn('HNSW prewarm skipped:', { error: prewarmError.message });
  }
}

async function checkPgStatStatements(database) {
  try {
    const pgssResult = await database.checkPgStatStatements();
    if (pgssResult.active) {
      logger.info('pg_stat_statements: active — query profiling is available');
    } else {
      logger.warn(`pg_stat_statements: inactive`, { reason: pgssResult.reason });
    }
  } catch (pgssError) {
    logger.warn('pg_stat_statements check failed:', { error: pgssError.message });
  }
}

async function ensurePgStatStatements(database) {
  if (typeof database.ensurePgStatStatements !== 'function') {
    return;
  }

  try {
    const ensureResult = await database.ensurePgStatStatements();
    if (ensureResult?.ensured) {
      logger.info('pg_stat_statements: extension installed automatically during startup');
    }
  } catch (pgssError) {
    logger.warn('pg_stat_statements ensure failed:', { error: pgssError.message });
  }
}

async function runPostUpgradeTasks(postUpgradeService) {
  try {
    const taskResult = await postUpgradeService.runPendingTasks();
    logger.info(`Post-upgrade tasks: ${taskResult.executed} executed, ${taskResult.skipped} already completed`);
  } catch (upgradeError) {
    logger.error('Post-upgrade task error:', { error: upgradeError.message });
  }
}

async function auditClarificationSeedIntegrity(clarificationService) {
  try {
    await clarificationService.auditSeedIntegrity({ source: 'startup_preflight' });
  } catch (integrityError) {
    logger.warn('Clarification seed integrity audit failed:', { error: integrityError.message });
  }
}

async function auditPolicyThresholdIntegrity(policyThresholdIntegrityService) {
  try {
    await policyThresholdIntegrityService.auditPersistedThresholds({ source: 'startup_preflight' });
  } catch (integrityError) {
    logger.warn('Policy threshold integrity audit failed:', { error: integrityError.message });
  }
}

async function loadRuntimeSettings(runtimeSettings) {
  runtimeSettings.ensureRuntimeSettingsFile();
  await runtimeSettings.refreshFromDatabase();
  const effectiveOmdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
  logger.info('OMDb runtime configuration loaded', { config: effectiveOmdbRuntime });
}

async function recordAvxGuard(avxGuard) {
  try {
    const guardResult = await avxGuard.run();
    if (guardResult?.selected) {
      logger.info(`pgvector variant selected: ${guardResult.selected}`);
    }
  } catch (guardError) {
    logger.warn('AVX guard failed:', { error: guardError.message });
  }
}

export async function runStartupPreflight({
  database = db,
  setLoggerDb,
  runtimeSettings,
  avxGuard,
  clarificationService: clarificationSeedService = clarificationService,
  policyThresholdIntegrityService: policyThresholdIntegrityAuditService = policyThresholdIntegrityService,
  migrationRunnerService = migrationRunner,
  postUpgradeTaskService = postUpgradeService,
}) {
  await database.query('SELECT 1');
  logger.info('Database connected successfully');
  setLoggerDb(database);

  await runMigrations(migrationRunnerService);
  await auditClarificationSeedIntegrity(clarificationSeedService);
  await auditPolicyThresholdIntegrity(policyThresholdIntegrityAuditService);
  await prewarmHnswIndexes(database);
  await ensurePgStatStatements(database);
  await checkPgStatStatements(database);
  await runPostUpgradeTasks(postUpgradeTaskService);
  await loadRuntimeSettings(runtimeSettings);
  await recordAvxGuard(avxGuard);
}
