/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0 - See LICENSE file for details.
 */

import {
  extractPostgresConfigIncludeDirectives,
  formatPostgresConfigIncludeDiagnostics,
  normalizeDynamicLibraryPathText,
  normalizeDynamicLibraryPathValue,
  rewritePgStatStatementsConfigText,
} from '../../../scripts/lib/postgres-config-file.mjs';

describe('postgres config file helpers', () => {
  test('rewrites shared_preload_libraries while preserving other entries', () => {
    const input = [
      "shared_preload_libraries = 'auto_explain, pg_stat_statements'",
      'pg_stat_statements.track = top',
      'pg_stat_statements.max = 5000',
    ].join('\n');

    const output = rewritePgStatStatementsConfigText(input, {
      enablePgss: false,
      appendIfMissing: false,
    });

    expect(output).toContain(
      "shared_preload_libraries = 'auto_explain'"
    );
    expect(output).not.toContain('pg_stat_statements.track = top');
    expect(output).not.toContain('pg_stat_statements.max = 5000');
  });

  test('does not append pg_stat_statements settings to auto.conf style files when absent', () => {
    const output = rewritePgStatStatementsConfigText("work_mem = '4MB'", {
      enablePgss: true,
      appendIfMissing: false,
    });

    expect(output).toBe("work_mem = '4MB'");
  });

  test('normalizes historical comma-separated dynamic_library_path values', () => {
    expect(
      normalizeDynamicLibraryPathValue('/run/postgresql/pgvector, $libdir')
    ).toBe('/run/postgresql/pgvector:$libdir');
  });

  test('prepends the staged pgvector path while preserving additional library paths', () => {
    const input = "dynamic_library_path = '/legacy/path, $libdir:/custom/path'";
    const output = normalizeDynamicLibraryPathText(input, {
      stagingPath: '/run/postgresql/pgvector',
    });

    expect(output).toBe(
      "dynamic_library_path = '/run/postgresql/pgvector:/legacy/path:$libdir:/custom/path'"
    );
  });

  test('extracts include directives from PostgreSQL config text', () => {
    const input = [
      "include 'postgresql.custom.conf'",
      "include_if_exists 'local.conf'",
      "include_dir 'conf.d'",
    ].join('\n');

    expect(extractPostgresConfigIncludeDirectives(input)).toEqual([
      { directive: 'include', target: 'postgresql.custom.conf', lineNumber: 1 },
      { directive: 'include_if_exists', target: 'local.conf', lineNumber: 2 },
      { directive: 'include_dir', target: 'conf.d', lineNumber: 3 },
    ]);
  });

  test('formats include diagnostics for upgrade/startup reporting', () => {
    const diagnostics = formatPostgresConfigIncludeDiagnostics(
      "include_dir 'conf.d'",
      'postgresql.conf'
    );

    expect(diagnostics).toContain('PostgreSQL include directives detected in postgresql.conf:');
    expect(diagnostics).toContain("- line 1: include_dir 'conf.d'");
  });
});
