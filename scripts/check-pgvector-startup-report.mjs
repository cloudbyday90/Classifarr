#!/usr/bin/env node
/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from './check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';

// Ordinary entrypoint, disposable data, no network/providers/ports. Never a live repair.
export async function checkPgvectorStartupReport(imageName) {
  assert.match(imageName, /^sha256:[a-f0-9]{64}$/, 'An exact local image ID is required');
  for (const staging of ['auto', 'disabled', 'invalid-fixture-value']) {
    const runSpec = createSchemaCheckRunSpec();
    const command = (args, options) => {
      if (args[0] === 'rm') {
        assert.deepEqual(args, ['rm', '-f', runSpec.containerName]);
        const owner = runDockerCheckCommand(['inspect', runSpec.containerName, '--format',
          '{{ index .Config.Labels "io.classifarr.role" }}']);
        if (!owner.ok || owner.stdout.trim() !== 'schema-snapshot-check') {
          return { ok: false, stdout: '', stderr: 'cleanup_ownership_unverified' };
        }
      }
      return runDockerCheckCommand(args[0] === 'run'
        ? ['run', '--network', 'none', '--memory', '1g', '--cpus', '2', '--pids-limit', '256',
          '-e', `PGVECTOR_RUNTIME_STAGING=${staging}`, ...args.slice(1)] : args, options);
    };
    await withSchemaCheckContainer({ imageName, runSpec, command, action: async () => {
      const result = command(['exec', '-e', 'LOG_LEVEL=fatal', '-e', 'FILE_LOGGING_ENABLED=false',
        '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=1000',
        runSpec.containerName, 'node', '--input-type=module', '-e', `
          import { pool } from './src/config/database.mjs';
          import { readPgvectorStatus } from './src/services/pgvectorStatus.mjs';
          try { console.log(JSON.stringify(await readPgvectorStatus(pool))); }
          finally { await pool.end(); }
        `], { timeoutMs: 20_000 });
      assert.ok(result.ok, 'startup_report_probe_failed');
      const status = JSON.parse(result.stdout);
      assert.equal(status.pgvectorSelection.status, 'other_process');
      const report = status.pgvectorSelection.report;
      assert.equal(report.databaseScope, 'embedded_entrypoint');
      assert.ok(report.selectedAt && report.databaseStartedAt && report.recordedAt);
      assert.equal(status.pgvectorVariant, report.selectedVariant);
      assert.equal(status.pgvectorBuild, report.build);
      assert.equal(status.cpuAvx, report.cpuAvx);
      assert.equal(status.cpuAvx2, report.cpuAvx2);
      assert.equal(status.lastChecked, report.recordedAt);
      if (staging !== 'auto') {
        assert.equal(report.selectedVariant, 'generic');
        assert.equal(report.reason, staging === 'disabled' ? 'staging_disabled' : 'staging_invalid');
      } else {
        assert.notEqual(report.reason, 'unknown');
      }
      console.log(JSON.stringify({ imageName, staging, reason: report.reason, variant: report.selectedVariant,
        databaseScope: report.databaseScope, reportBytes: JSON.stringify(report).length }));
    } });
    const remaining = command(['ps', '-aq', '--filter', `name=^${runSpec.containerName}$`]);
    assert.ok(remaining.ok);
    assert.equal(remaining.stdout.trim(), '');
    assert.equal(existsSync(runSpec.hostDataPath), false);
  }
  console.log('PASS: three pgvector startup report cases; owned containers and data removed.');
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await checkPgvectorStartupReport(process.argv[2]);
}
