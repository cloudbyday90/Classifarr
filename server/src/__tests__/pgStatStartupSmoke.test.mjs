/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  buildPgStatStatementsRuntimeRemovalCommand,
  createSmokeRunNames,
  hasPgStatStatementsFatalStartup,
  hasPgStatStatementsMissingRuntimeWarning,
} from '../../../scripts/check-pg-stat-startup-smoke.mjs';

describe('pg_stat startup smoke helpers', () => {
  test('builds the runtime removal command used by the Docker smoke test', () => {
    const command = buildPgStatStatementsRuntimeRemovalCommand();

    expect(command).toContain('command -v pg_config');
    expect(command).toContain("find /usr/libexec -path '*/pg_config'");
    expect(command).toContain('rm -f "$PKGLIBDIR/pg_stat_statements.so"');
    expect(command).toContain('rm -f "$SHAREDIR/extension/pg_stat_statements.control"');
    expect(command).toContain('exec /app/docker-entrypoint.sh');
  });

  test('creates unique Docker object names for each smoke run', () => {
    const names = createSmokeRunNames('classifarr-pgss-smoke', 'run 1');

    expect(names).toEqual({
      freshVolume: 'classifarr-pgss-smoke-fresh-run-1',
      existingVolume: 'classifarr-pgss-smoke-existing-run-1',
      freshContainer: 'classifarr-pgss-smoke-fresh-run-1',
      baselineContainer: 'classifarr-pgss-smoke-existing-base-run-1',
      recoveryContainer: 'classifarr-pgss-smoke-existing-recovery-run-1',
    });
  });

  test('detects the historical fatal startup signature', () => {
    expect(
      hasPgStatStatementsFatalStartup(
        'FATAL: could not access file "pg_stat_statements": No such file or directory'
      )
    ).toBe(true);
    expect(hasPgStatStatementsFatalStartup('all clear')).toBe(false);
  });

  test('detects the new degraded-mode warning', () => {
    expect(
      hasPgStatStatementsMissingRuntimeWarning(
        'WARN: pg_stat_statements runtime files are missing for this PostgreSQL image.'
      )
    ).toBe(true);
    expect(hasPgStatStatementsMissingRuntimeWarning('all clear')).toBe(false);
  });
});
