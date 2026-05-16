/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  buildIncludedConfigFailurePreparationCommand,
  buildPg17UpgradeCarryoverPreparationCommand,
  buildPgStatStatementsRuntimeRemovalCommand,
  createSmokeRunNames,
  hasPostgresIncludeDirectiveDiagnostics,
  hasPostgres17To18UpgradeLog,
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

  test('builds the PG17 upgrade carryover preparation command', () => {
    const command = buildPg17UpgradeCarryoverPreparationCommand();

    expect(command).toContain('/usr/libexec/postgresql17');
    expect(command).toContain("dynamic_library_path = '/run/postgresql/pgvector, \\$libdir'");
    expect(command).toContain('createdb');
    expect(command).toContain('pg_ctl');
  });

  test('builds the included-config failure preparation command', () => {
    const command = buildIncludedConfigFailurePreparationCommand();

    expect(command).toContain("include_dir 'conf.d'");
    expect(command).toContain('/app/data/postgres/postgresql.auto.conf');
    expect(command).toContain('bad-library-path.conf');
    expect(command).toContain("dynamic_library_path = '/run/postgresql/pgvector, \\$libdir'");
  });

  test('creates unique Docker object names for each smoke run', () => {
    const names = createSmokeRunNames('classifarr-pgss-smoke', 'run 1');

    expect(names).toEqual({
      freshVolume: 'classifarr-pgss-smoke-fresh-run-1',
      existingVolume: 'classifarr-pgss-smoke-existing-run-1',
      upgradeVolume: 'classifarr-pgss-smoke-upgrade-run-1',
      includeVolume: 'classifarr-pgss-smoke-include-run-1',
      freshContainer: 'classifarr-pgss-smoke-fresh-run-1',
      baselineContainer: 'classifarr-pgss-smoke-existing-base-run-1',
      recoveryContainer: 'classifarr-pgss-smoke-existing-recovery-run-1',
      upgradeContainer: 'classifarr-pgss-smoke-upgrade-run-1',
      includeContainer: 'classifarr-pgss-smoke-include-run-1',
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

  test('detects the PG17 to PG18 upgrade log marker', () => {
    expect(
      hasPostgres17To18UpgradeLog('Auto-upgrading PostgreSQL 17 -> 18 (pg_upgrade)')
    ).toBe(true);
    expect(hasPostgres17To18UpgradeLog('all clear')).toBe(false);
  });

  test('detects include directive diagnostics in startup logs', () => {
    const logs = [
      'PostgreSQL include directives detected in /app/data/postgres/postgresql.conf:',
      "- line 3: include_dir 'conf.d'",
    ].join('\n');

    expect(
      hasPostgresIncludeDirectiveDiagnostics(
        logs,
        '/app/data/postgres/postgresql.conf',
        'include_dir',
        'conf.d'
      )
    ).toBe(true);
    expect(
      hasPostgresIncludeDirectiveDiagnostics(logs, '/app/data/postgres/postgresql.auto.conf', 'include_dir', 'conf.d')
    ).toBe(false);
  });
});
