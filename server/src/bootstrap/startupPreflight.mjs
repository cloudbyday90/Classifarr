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
import migrationRunner from '../config/migrations.mjs';
import postUpgradeService from '../services/postUpgradeService.mjs';
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

async function runPostUpgradeTasks(postUpgradeService) {
  try {
    const taskResult = await postUpgradeService.runPendingTasks();
    logger.info(`Post-upgrade tasks: ${taskResult.executed} executed, ${taskResult.skipped} already completed`);
  } catch (upgradeError) {
    logger.error('Post-upgrade task error:', { error: upgradeError.message });
  }
}

async function loadRuntimeSettings(runtimeSettings) {
  runtimeSettings.ensureRuntimeSettingsFile();
  await runtimeSettings.refreshFromDatabase();
  const effectiveOmdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
  logger.info('OMDb runtime configuration loaded', { config: effectiveOmdbRuntime });

  if (process.env.NODE_ENV === 'production' && runtimeSettings.getCorsOriginsList().length === 0) {
    logger.warn('CORS origin restriction is not configured in production.');
    logger.warn('Set one of: settings.cors_origin in DB/UI, runtime.json, or CORS_ORIGIN env var');
  }
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
  migrationRunnerService = migrationRunner,
  postUpgradeTaskService = postUpgradeService,
}) {
  await database.query('SELECT 1');
  logger.info('Database connected successfully');
  setLoggerDb(database);

  await runMigrations(migrationRunnerService);
  await prewarmHnswIndexes(database);
  await checkPgStatStatements(database);
  await runPostUpgradeTasks(postUpgradeTaskService);
  await loadRuntimeSettings(runtimeSettings);
  await recordAvxGuard(avxGuard);
}
