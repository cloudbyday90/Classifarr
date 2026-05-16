/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  PROJECT_POSTGRES_MAJOR,
  buildPgDumpArgs,
  choosePgDumpSource,
  isPgDumpVersionMismatchError,
  parsePostgresMajorVersion,
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
});
