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
const PGVECTOR_TARGET_VERSION = '0.8.7';
const TARGET_PGVECTOR_IMAGE = `pgvector/pgvector:${PGVECTOR_TARGET_VERSION}-pg18`;
const MIGRATION_FILENAME = '20261002_120000_upgrade_pgvector_to_0_8_7.sql';
const migrationPath = path.resolve(
  import.meta.dirname,
  '../../../../database/migrations',
  MIGRATION_FILENAME,
);
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const previousMigrationSql = fs.readFileSync(path.join(path.dirname(migrationPath),
  '20260808_140000_upgrade_pgvector_to_0_8_6.sql'), 'utf8');

describe.each(['0.8.2', '0.8.6'])('pgvector extension upgrade from %s', previousVersion => {
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

    previousContainer = await new PostgreSqlContainer(`pgvector/pgvector:${previousVersion}-pg18`)
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
      expect(version.rows).toEqual([{ extversion: previousVersion }]);
      await expect(previousPool.query(migrationSql)).rejects.toThrow(/no update path/);
      expect((await previousPool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows)
        .toEqual([{ extversion: previousVersion }]);
      await previousPool.query('CREATE TABLE pgvector_upgrade_probe (embedding vector(3) NOT NULL)');
      await previousPool.query("INSERT INTO pgvector_upgrade_probe VALUES ('[1,2,3]')");
      await previousPool.query('CREATE INDEX pgvector_upgrade_probe_hnsw ON pgvector_upgrade_probe USING hnsw (embedding vector_l2_ops)');
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
      max: 1,
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

  test('upgrades persisted data and indexes to 0.8.7 without downgrade on replay', async () => {
    const before = await upgradePool.query(
      "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
    );
    expect(before.rows).toEqual([{ extversion: previousVersion }]);

    await upgradePool.query('CREATE ROLE pgvector_no_upgrade');
    await upgradePool.query('BEGIN');
    try {
      await upgradePool.query('SET LOCAL ROLE pgvector_no_upgrade');
      await expect(upgradePool.query(migrationSql)).rejects.toMatchObject({ code: '42501' });
    } finally {
      await upgradePool.query('ROLLBACK');
    }

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

    await upgradePool.query('SET enable_seqscan = off');
    const query = "SELECT embedding::text AS value FROM pgvector_upgrade_probe ORDER BY embedding <-> '[1,2,3]'::vector LIMIT 1";
    const plan = await upgradePool.query(`EXPLAIN (FORMAT JSON) ${query}`);
    expect(JSON.stringify(plan.rows)).toContain('pgvector_upgrade_probe_hnsw');
    expect((await upgradePool.query(query)).rows).toEqual([{ value: '[1,2,3]' }]);
    await expect(upgradePool.query(previousMigrationSql)).resolves.toBeDefined();
    await expect(upgradePool.query(migrationSql)).resolves.toBeDefined();
    expect((await upgradePool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows)
      .toEqual([{ extversion: PGVECTOR_TARGET_VERSION }]);
  });

  test('absent optional extension stays absent', async () => {
    await upgradePool.query('CREATE DATABASE without_vector');
    const pool = new Pool({ host: targetContainer.getHost(), port: targetContainer.getPort(),
      database: 'without_vector', user: targetContainer.getUsername(), password: targetContainer.getPassword() });
    try {
      await pool.query(migrationSql);
      expect((await pool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows).toEqual([]);
    } finally {
      await pool.end();
    }
  });

  test('newer extension catalogs are not downgraded', async () => {
    await upgradePool.query('BEGIN');
    try {
      // Only this disposable fixture changes catalog metadata; rollback restores it.
      await upgradePool.query("UPDATE pg_extension SET extversion = '0.10.0' WHERE extname = 'vector'");
      await upgradePool.query(previousMigrationSql);
      await upgradePool.query(migrationSql);
      expect((await upgradePool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'")).rows)
        .toEqual([{ extversion: '0.10.0' }]);
    } finally {
      await upgradePool.query('ROLLBACK');
    }
  });
});
