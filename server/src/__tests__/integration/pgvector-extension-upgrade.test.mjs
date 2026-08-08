/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Docker from 'dockerode';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { getDockerConnection } from './runtime.mjs';

const { Pool } = pg;
const PGVECTOR_PREVIOUS_VERSION = '0.8.2';
const PGVECTOR_TARGET_VERSION = '0.8.6';
const PREVIOUS_PGVECTOR_IMAGE = `pgvector/pgvector:${PGVECTOR_PREVIOUS_VERSION}-pg18`;
const TARGET_PGVECTOR_IMAGE = `pgvector/pgvector:${PGVECTOR_TARGET_VERSION}-pg18`;
const MIGRATION_FILENAME = '20260808_140000_upgrade_pgvector_to_0_8_6.sql';
const migrationPath = path.resolve(
  import.meta.dirname,
  '../../../../database/migrations',
  MIGRATION_FILENAME,
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

describe('pgvector extension upgrade', () => {
  let docker;
  let upgradePool;
  let previousContainer;
  let targetContainer;
  let volumeName;

  beforeAll(async () => {
    const { options } = getDockerConnection();
    docker = new Docker(options);
    volumeName = `classifarr_pgvector_upgrade_${crypto.randomUUID().replaceAll('-', '')}`;
    await docker.createVolume({ Name: volumeName });

    previousContainer = await new PostgreSqlContainer(PREVIOUS_PGVECTOR_IMAGE)
      .withDatabase('classifarr')
      .withUsername('test')
      .withPassword('test')
      .withBindMounts([{ source: volumeName, target: '/var/lib/postgresql' }])
      .start();

    const previousPool = new Pool({
      host: previousContainer.getHost(),
      port: previousContainer.getPort(),
      database: previousContainer.getDatabase(),
      user: previousContainer.getUsername(),
      password: previousContainer.getPassword(),
    });
    try {
      await previousPool.query('CREATE EXTENSION vector');
      const version = await previousPool.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
      );
      expect(version.rows).toEqual([{ extversion: PGVECTOR_PREVIOUS_VERSION }]);
    } finally {
      await previousPool.end();
    }

    await previousContainer.stop();
    previousContainer = null;

    targetContainer = await new PostgreSqlContainer(TARGET_PGVECTOR_IMAGE)
      .withDatabase('classifarr')
      .withUsername('test')
      .withPassword('test')
      .withBindMounts([{ source: volumeName, target: '/var/lib/postgresql' }])
      .start();

    upgradePool = new Pool({
      host: targetContainer.getHost(),
      port: targetContainer.getPort(),
      database: targetContainer.getDatabase(),
      user: targetContainer.getUsername(),
      password: targetContainer.getPassword(),
    });
  });

  afterAll(async () => {
    if (upgradePool) {
      await upgradePool.end();
      upgradePool = null;
    }

    if (targetContainer) {
      await targetContainer.stop();
      targetContainer = null;
    }

    if (previousContainer) {
      await previousContainer.stop();
      previousContainer = null;
    }

    if (docker && volumeName) {
      await docker.getVolume(volumeName).remove();
    }
  });

  test('upgrades a persisted 0.8.2 extension to 0.8.6 and preserves vector indexing', async () => {
    const before = await upgradePool.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    );
    expect(before.rows).toEqual([{ extversion: PGVECTOR_PREVIOUS_VERSION }]);

    await upgradePool.query('BEGIN');
    try {
      await upgradePool.query(migrationSql);
      await upgradePool.query('COMMIT');
    } catch (error) {
      await upgradePool.query('ROLLBACK');
      throw error;
    }

    const after = await upgradePool.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    );
    expect(after.rows).toEqual([{ extversion: PGVECTOR_TARGET_VERSION }]);

    await upgradePool.query('CREATE TABLE pgvector_upgrade_probe (embedding vector(3) NOT NULL)');
    await upgradePool.query("INSERT INTO pgvector_upgrade_probe (embedding) VALUES ('[1,2,3]')");
    await upgradePool.query(
      'CREATE INDEX pgvector_upgrade_probe_hnsw ON pgvector_upgrade_probe USING hnsw (embedding vector_l2_ops)',
    );

    await expect(upgradePool.query(migrationSql)).resolves.toBeDefined();
  });
});
