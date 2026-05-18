/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  buildSchemaMigrationsTrackingSql,
  PROJECT_POSTGRES_MAJOR,
  SEED_MIGRATIONS,
  buildPgDumpArgs,
  choosePgDumpSource,
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

  test('includes clarification seed reconciliation in the auto-appended seed migration list', () => {
    expect(SEED_MIGRATIONS).toContain('20260517_235500_reconcile_clarification_seed_data.sql');
    expect(SEED_MIGRATIONS).toContain('20260518_011500_reconcile_bootstrap_sensitive_seed_data.sql');
    expect(SEED_MIGRATIONS).toContain('20260518_013000_reconcile_low_priority_seed_data.sql');
  });
});
