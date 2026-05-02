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

async function runMigrations(migrationRunner) {
  try {
    const result = await migrationRunner.run();
    console.log(`Migrations complete (${result.total} total, ${result.applied} newly applied)`);
  } catch (migrationError) {
    console.error('Migration error:', migrationError.message);
  }
}

async function prewarmHnswIndexes(database) {
  try {
    const prewarmResult = await database.prewarmHnswIndexes();
    if (prewarmResult.loaded) {
      console.log(`HNSW indexes prewarmed: ${prewarmResult.blocks.text} text blocks, ${prewarmResult.blocks.image} image blocks`);
    }
  } catch (prewarmError) {
    console.warn('HNSW prewarm skipped:', prewarmError.message);
  }
}

async function checkPgStatStatements(database) {
  try {
    const pgssResult = await database.checkPgStatStatements();
    if (pgssResult.active) {
      console.log('pg_stat_statements: active — query profiling is available');
    } else {
      console.warn(`pg_stat_statements: inactive — ${pgssResult.reason}`);
    }
  } catch (pgssError) {
    console.warn('pg_stat_statements check failed:', pgssError.message);
  }
}

async function runPostUpgradeTasks(postUpgradeService) {
  try {
    const taskResult = await postUpgradeService.runPendingTasks();
    console.log(`Post-upgrade tasks: ${taskResult.executed} executed, ${taskResult.skipped} already completed`);
  } catch (upgradeError) {
    console.error('Post-upgrade task error:', upgradeError.message);
  }
}

async function loadRuntimeSettings(runtimeSettings) {
  runtimeSettings.ensureRuntimeSettingsFile();
  await runtimeSettings.refreshFromDatabase();
  const effectiveOmdbRuntime = runtimeSettings.getOmdbRuntimeConfig();
  console.log('OMDb runtime configuration loaded', effectiveOmdbRuntime);

  if (process.env.NODE_ENV === 'production' && runtimeSettings.getCorsOriginsList().length === 0) {
    console.warn('WARNING: CORS origin restriction is not configured in production.');
    console.warn('Set one of:');
    console.warn('  - settings.cors_origin in DB/UI');
    console.warn(`  - ${runtimeSettings.getRuntimeSettingsFilePath()} (runtime.json)`);
    console.warn('  - CORS_ORIGIN environment variable');
  }
}

async function recordAvxGuard(avxGuard) {
  try {
    const guardResult = await avxGuard.run();
    if (guardResult?.selected) {
      console.log(`pgvector variant selected: ${guardResult.selected}`);
    }
  } catch (guardError) {
    console.warn('AVX guard failed:', guardError.message);
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
  console.log('Database connected successfully');
  setLoggerDb(database);

  await runMigrations(migrationRunnerService);
  await prewarmHnswIndexes(database);
  await checkPgStatStatements(database);
  await runPostUpgradeTasks(postUpgradeTaskService);
  await loadRuntimeSettings(runtimeSettings);
  await recordAvxGuard(avxGuard);
}
