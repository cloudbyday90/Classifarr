/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runDockerCheckCommand } from './lib/dockerCheckCommand.mjs';
import { waitForContainerReady } from './lib/containerReadiness.mjs';
import { checkSchemaSnapshotWithContainer, SCHEMA_CHECK_CONTAINER_LABEL } from './check-schema-snapshot-container.mjs';

/** Opt-in real-Docker verification: no live settings, ports, mounts or provider calls. */
export async function verifyContainerStartupDiagnostics({ imageName = process.env.IMAGE_NAME || 'classifarr:test' } = {}) {
  const prefix = `classifarr-startup-diagnostic-${randomUUID()}`;
  const owned = [];
  const invoke = args => {
    const result = runDockerCheckCommand(args, { timeoutMs: 30_000 });
    assert.ok(result.ok, 'disposable_diagnostic_command_failed');
    return result.stdout.trim();
  };
  const start = (name, code, label = []) => {
    assert.equal(invoke(['ps', '-aq', '--filter', `name=^${name}$`]), '', 'diagnostic_target_not_empty');
    owned.push(name);
    invoke(['run', '-d', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', ...label, '--entrypoint', 'node', imageName, '--input-type=module', '-e', code]);
  };
  const scenarios = [
    { id: 'stderr_admission', code: 'console.error("Failed to start server: Restore verification is incomplete."); process.exit(1)', signal: 'restore_verification_incomplete' },
    { id: 'stdout_admission', code: 'console.log("Restore maintenance is active. Normal startup is blocked."); process.exit(1)', signal: 'restore_maintenance_active' },
    { id: 'unknown_private_error', code: 'console.error("password=synthetic-secret\\n::error::synthetic-secret"); process.exit(1)' },
    { id: 'exit_137_not_oom', code: 'process.exit(137)', exitCode: 137 },
    { id: 'running_unready', code: 'import http from "node:http"; http.createServer((_, res) => { res.writeHead(503); res.end(); }).listen(21324)', reason: 'readiness_timeout' },
    { id: 'ready', code: 'import http from "node:http"; http.createServer((_, res) => res.end("ok")).listen(21324)', ready: true },
  ];
  try {
    for (const scenario of scenarios) {
      const name = `${prefix}-${scenario.id}`;
      process.stdout.write(`CHECK ${scenario.id}\n`);
      start(name, scenario.code);
      const startedAt = Date.now();
      let failure;
      try { await waitForContainerReady(name, { timeoutMs: scenario.reason ? 3000 : 15_000 }); }
      catch (error) { failure = error; }
      if (scenario.ready) assert.equal(failure, undefined);
      else {
        assert.equal(failure?.code, scenario.reason || 'container_exited_before_ready');
        assert.ok(!failure.message.includes('synthetic-secret'));
        assert.equal(failure.diagnostic.state.oomKilled, false);
        if (scenario.signal) assert.ok(failure.diagnostic.signals.some(signal => signal.code === scenario.signal));
        if (scenario.exitCode) assert.equal(failure.diagnostic.state.exitCode, scenario.exitCode);
      }
      process.stdout.write(`PASS ${scenario.id} (${Date.now() - startedAt} ms)\n`);
    }
    // Same role label as a concurrent schema check: it must survive another run's cleanup.
    const sibling = `${prefix}-sibling`;
    start(sibling, 'setInterval(() => {}, 1000)', ['--label', SCHEMA_CHECK_CONTAINER_LABEL]);
    await checkSchemaSnapshotWithContainer({ imageName });
    assert.equal(invoke(['inspect', '--format', '{{.State.Running}}', sibling]), 'true');
    process.stdout.write('PASS fresh_schema_and_parallel_cleanup_isolation\n');
  } finally {
    // Exact random names owned by this invocation only; anonymous image volumes included.
    const results = owned.map(name => runDockerCheckCommand(['rm', '-f', '--volumes', name], { timeoutMs: 30_000 }));
    assert.ok(results.every(result => result.ok), `diagnostic_cleanup_failed:${prefix}`);
  }
}

if (import.meta.main) {
  try { await verifyContainerStartupDiagnostics(); }
  catch {
    process.stderr.write('Container startup diagnostic verification failed; inspect the failing scenario in isolation.\n');
    process.exitCode = 1;
  }
}
