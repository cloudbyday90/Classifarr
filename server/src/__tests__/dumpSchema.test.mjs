/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  assertMigrationSourceIsCurrent,
  assertSeedMigrationCoverage,
  buildSchemaMigrationsTrackingSql,
  buildPsqlArgs,
  findDeclaredSeedReconciliationMigrations,
  fetchAppliedMigrations,
  getMissingDeclaredSeedMigrations,
  parseAppliedMigrationsOutput,
  PROJECT_POSTGRES_MAJOR,
  SEED_MIGRATIONS,
  SEED_RECONCILIATION_MARKER,
  buildPgDumpArgs,
  choosePgDumpSource,
  isDeclaredSeedReconciliationMigration,
  isPgDumpVersionMismatchError,
  normalizeSnapshotForComparison,
  parsePostgresMajorVersion,
  stripSchemaMigrationsDumpArtifacts,
  shouldQuoteAllIdentifiers,
} from '../../../scripts/dump-schema.mjs';

describe('dump-schema tooling', () => {
  test('parses PostgreSQL major versions from pg_dump output', () => {
    expect(parsePostgresMajorVersion('pg_dump (PostgreSQL) 18.4')).toBe(18);
    expect(parsePostgresMajorVersion('pg_dump (PostgreSQL) 17.10')).toBe(17);
    expect(parsePostgresMajorVersion('unexpected output')).toBeNull();
  });

  test('adds quote-all-identifiers when host tooling differs from embedded PostgreSQL', () => {
    expect(shouldQuoteAllIdentifiers(PROJECT_POSTGRES_MAJOR)).toBe(false);
    expect(shouldQuoteAllIdentifiers(17)).toBe(true);

    expect(
      buildPgDumpArgs({
        host: 'localhost',
        port: '5432',
        user: 'classifarr',
        dbName: 'classifarr',
        quoteAllIdentifiers: true,
      })
    ).toContain('--quote-all-identifiers');
  });

  test('builds psql args for deterministic migration introspection', () => {
    expect(buildPsqlArgs({
      host: 'localhost',
      port: '5432',
      user: 'classifarr',
      dbName: 'classifarr',
      sql: 'SELECT filename FROM public.schema_migrations ORDER BY filename',
    })).toEqual([
      '--no-psqlrc',
      '--tuples-only',
      '--no-align',
      '--host',
      'localhost',
      '--port',
      '5432',
      '--username',
      'classifarr',
      '--dbname',
      'classifarr',
      '--command',
      'SELECT filename FROM public.schema_migrations ORDER BY filename',
    ]);
  });

  test('prefers explicit DUMP_CONTAINER over other sources', () => {
    const source = choosePgDumpSource({
      env: { DUMP_CONTAINER: 'classifarr-prod', PREFER_CONTAINER_PG_DUMP: 'true' },
      execFileSyncImpl: () => 'classifarr\n',
    });

    expect(source).toEqual({
      type: 'docker-exec',
      containerName: 'classifarr-prod',
      reason: 'DUMP_CONTAINER was provided',
    });
  });

  test('prefers running docker compose classifarr service by default', () => {
    const source = choosePgDumpSource({
      env: {},
      execFileSyncImpl: () => 'classifarr\nredis\n',
    });

    expect(source.type).toBe('docker-compose');
  });

  test('falls back to host when no containerized pg_dump source is available', () => {
    const source = choosePgDumpSource({
      env: {},
      execFileSyncImpl: () => {
        throw new Error('docker unavailable');
      },
    });

    expect(source.type).toBe('host');
  });

  test('parses applied migrations from psql output', () => {
    expect(parseAppliedMigrationsOutput('\n002_add.sql\r\n001_add.sql\n\n')).toEqual([
      '001_add.sql',
      '002_add.sql',
    ]);
  });

  test('reads applied migrations from the selected dump source', () => {
    const commands = [];
    const appliedMigrations = fetchAppliedMigrations({
      env: { DUMP_CONTAINER: 'schema-check' },
      execFileSyncImpl: (command, args) => {
        commands.push([command, args]);
        return '002_add.sql\n001_add.sql\n';
      },
      log: { log: jest.fn() },
    });

    expect(appliedMigrations).toEqual(['001_add.sql', '002_add.sql']);
    expect(commands).toHaveLength(1);
    expect(commands[0][0]).toBe('docker');
    expect(commands[0][1]).toEqual(expect.arrayContaining([
      'exec',
      '-i',
      'schema-check',
      'psql',
    ]));
  });

  test('fails when the source database has not applied every migration file', () => {
    expect(() => assertMigrationSourceIsCurrent({
      appliedMigrations: ['001_add.sql'],
      migrationFiles: ['001_add.sql', '002_add.sql'],
    })).toThrow('Source database is missing applied migration(s): 002_add.sql');
  });

  test('returns applied migrations ordered like repo files when the source is current', () => {
    expect(assertMigrationSourceIsCurrent({
      appliedMigrations: ['002_add.sql', '001_add.sql', '999_unused.sql'],
      migrationFiles: ['001_add.sql', '002_add.sql'],
    })).toEqual(['001_add.sql', '002_add.sql']);
  });

  test('detects pg_dump version mismatch errors', () => {
    expect(
      isPgDumpVersionMismatchError(
        new Error('pg_dump: error: aborting because of server version mismatch')
      )
    ).toBe(true);

    expect(isPgDumpVersionMismatchError(new Error('some other failure'))).toBe(false);
  });

  test('normalizes generated timestamps and line endings so drift checks stay deterministic', () => {
    const firstSnapshot = '-- Classifarr Database Schema Snapshot\r\n-- Generated: 2026-05-16T18:00:00.000Z\r\n-- Latest Migration: 20260516_183500_reconcile_pg_stat_statements_state.sql\r\n';
    const secondSnapshot = '-- Classifarr Database Schema Snapshot\n-- Generated: 2026-05-16T18:15:00.000Z\n-- Latest Migration: 20260516_183500_reconcile_pg_stat_statements_state.sql\n';

    expect(normalizeSnapshotForComparison(firstSnapshot)).toBe(
      normalizeSnapshotForComparison(secondSnapshot)
    );
  });

  test('strips dumped schema_migrations artifacts so the generator can add one canonical tracking table', () => {
    const schemaSql = [
      '--',
      '-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -',
      '--',
      '',
      'CREATE TABLE public.schema_migrations (',
      '    id integer NOT NULL,',
      '    filename character varying(255) NOT NULL',
      ');',
      '',
      '--',
      '-- Name: idx_schema_migrations_applied; Type: INDEX; Schema: public; Owner: -',
      '--',
      '',
      'CREATE INDEX idx_schema_migrations_applied ON public.schema_migrations USING btree (applied_at DESC);',
      '',
      '--',
      '-- Name: schema_migrations_id_seq1; Type: SEQUENCE; Schema: public; Owner: -',
      '--',
      '',
      'CREATE SEQUENCE public.schema_migrations_id_seq1',
      '    AS integer',
      '    START WITH 1',
      '    INCREMENT BY 1',
      '    NO MINVALUE',
      '    NO MAXVALUE',
      '    CACHE 1;',
      '',
      '--',
      '-- Name: TABLE schema_migrations; Type: COMMENT; Schema: public; Owner: -',
      '--',
      '',
      "COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations';",
      '',
      '--',
      '-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -',
      '--',
      '',
      'CREATE SEQUENCE public.users_id_seq',
      '    AS integer',
      '    START WITH 1',
      '    INCREMENT BY 1',
      '    NO MINVALUE',
      '    NO MAXVALUE',
      '    CACHE 1;',
      '',
    ].join('\n');

    const stripped = stripSchemaMigrationsDumpArtifacts(schemaSql);

    expect(stripped).not.toContain('CREATE TABLE public.schema_migrations');
    expect(stripped).not.toContain('idx_schema_migrations_applied');
    expect(stripped).not.toContain('schema_migrations_id_seq1');
    expect(stripped).not.toContain('COMMENT ON TABLE public.schema_migrations');
    expect(stripped).toContain('users_id_seq');
  });

  test('builds the canonical schema_migrations tracking DDL', () => {
    const trackingSql = buildSchemaMigrationsTrackingSql();

    expect(trackingSql).toContain('CREATE TABLE public.schema_migrations (');
    expect(trackingSql).toContain("migration_type character varying(50) DEFAULT 'sql'::character varying");
    expect(trackingSql).toContain('description text');
    expect(trackingSql).toContain('CREATE INDEX idx_schema_migrations_applied');
    expect(trackingSql).toContain('CREATE INDEX idx_schema_migrations_type');
  });

  test('detects declared seed reconciliation migrations via marker comment', () => {
    const sampleSql = `-- Migration: Example\n-- ${SEED_RECONCILIATION_MARKER}\nINSERT INTO settings (key, value) VALUES ('x', 'y');`;
    const ordinarySql = '-- Migration: Example\nINSERT INTO settings (key, value) VALUES (\'x\', \'y\');';

    expect(isDeclaredSeedReconciliationMigration(sampleSql)).toBe(true);
    expect(isDeclaredSeedReconciliationMigration(ordinarySql)).toBe(false);
  });

  test('declared seed reconciliation migrations are all covered by SEED_MIGRATIONS', () => {
    const declaredSeedMigrations = findDeclaredSeedReconciliationMigrations();

    expect(declaredSeedMigrations).toEqual([
      '20260517_235500_reconcile_clarification_seed_data.sql',
      '20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql',
      '20260518_013000_reconcile_low_priority_seed_data.sql',
      '20260614_110500_reconcile_web_search_provider_seed_data.sql',
      '20260625_011500_reconcile_web_search_provider_retention_seed_data.sql',
      '20260625_030000_add_web_search_provider_route_decision_retention.sql',
    ]);
    expect(getMissingDeclaredSeedMigrations({
      declaredSeedMigrations,
      seedMigrations: SEED_MIGRATIONS,
    })).toEqual([]);
  });

  test('throws when a declared seed reconciliation migration is omitted from SEED_MIGRATIONS', () => {
    expect(() => assertSeedMigrationCoverage({
      seedMigrations: SEED_MIGRATIONS.filter(filename => filename !== '20260518_013000_reconcile_low_priority_seed_data.sql'),
    })).toThrow('SEED_MIGRATIONS is missing declared seed reconciliation migration(s): 20260518_013000_reconcile_low_priority_seed_data.sql');
  });
});
