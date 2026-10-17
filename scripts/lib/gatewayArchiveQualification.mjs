/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createSchemaCheckRunSpec, withSchemaCheckContainer } from '../check-schema-snapshot-container.mjs';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';

const driver = '/fixtures/archiveQualificationDriver.mjs';
const fixtureDirectory = 'scripts/fixtures/ollamaGatewayRehearsal';
const docker = args => execFileSync('docker', args, {
  encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 1048576,
});
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const records = output => output.trim().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const report = value => process.stdout.write(`${JSON.stringify(value)}\n`);

async function qualifyCase(image, shape) {
  const spec = createSchemaCheckRunSpec(), suffix = spec.containerName.slice('classifarr-schema-check-'.length);
  const labelKey = 'io.classifarr.archive-qualification', label = `${labelKey}=${suffix}`;
  const volumes = Object.fromEntries(['archives', 'receipts', 'socket', 'configuration', 'fixtures'].map(name =>
    [name, `classifarr-archive-${name}-${suffix}`]));
  const workers = Object.fromEntries(['archiver', 'verifier','cleanup'].map(name => [name, `classifarr-${name}-${suffix}`]));
  const mount = (name, target, readonly = false) => ['--mount', `type=volume,source=${volumes[name]},target=${target}${readonly ? ',readonly' : ''}`];
  const ownedRemove = name => {
    if (!docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim()) return;
    assert.equal(inspect(name).Config.Labels[labelKey], suffix);
    docker(['rm', '-f', name]);
    assert.equal(docker(['ps', '-aq', '--filter', `name=^${name}$`]).trim(), '');
  };
  const command = (args, options) => runDockerCheckCommand(args[0] === 'run' && args.includes('--label') ? [
    'run', '--network', 'none', '--memory', '2g', '--memory-swap', '2g', '--cpus', '2', '--pids-limit', '512',
    ...mount('archives', '/archives'), ...mount('receipts', '/receipts'), ...mount('socket', '/var/run/postgresql'),
    ...mount('configuration', '/configuration'), ...mount('fixtures', '/fixtures'),
    '--tmpfs', '/quota:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev', ...args.slice(1),
  ] : args, options);
  try {
    for (const volume of Object.values(volumes)) {
      assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
      docker(['volume', 'create', '--label', label, volume]);
    }
    await withSchemaCheckContainer({ imageName: image, runSpec: spec, command, action: async () => {
      const source = spec.containerName;
      docker(['exec', '--user', '0:0', source, 'chown', '1000:1000', '/archives', '/receipts', '/configuration', '/fixtures']);
      docker(['exec', '--user', '0:0', source, 'chmod', '700', '/archives', '/receipts', '/configuration', '/fixtures']);
      for (const name of ['archiveQualificationData.mjs', 'archiveQualificationDriver.mjs', 'archiveQualificationResources.mjs',
        'cleanupQualification.mjs','cleanupQueryDiagnostics.mjs']) {
        docker(['cp', resolve(fixtureDirectory, name), `${source}:/fixtures/${name}`]);
      }
      const fixture = action => {
        const output = docker(['exec', '--user', '1000:1000', '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', source,
          'node', '/fixtures/archiveQualificationData.mjs', action, shape]);
        return JSON.parse(output);
      };
      const create = (kind, mode = 'normal') => {
        const name = workers[kind]; ownedRemove(name);
        const archiveWorker = kind !== 'verifier', memory = archiveWorker ? '256m' : '1536m';
        docker(['create', '--name', name, '--label', label, '--network', 'none', '--read-only', '--init', '--no-healthcheck',
          '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
          '--memory', memory, '--memory-swap', memory, '--cpus', archiveWorker ? '0.5' : '1', '--pids-limit', archiveWorker ? '32' : '64',
          ...mount('archives', '/archives', kind !== 'archiver'), ...mount('receipts', '/receipts', archiveWorker), ...mount('fixtures', '/fixtures', true),
          ...(archiveWorker ? [...mount('socket', '/source-socket', true), ...mount('configuration', '/configuration', true)] : [
            '--tmpfs', '/verification:rw,size=1g,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev']),
          '--tmpfs', '/tmp:rw,size=16m,uid=1000,gid=1000,mode=0700,noexec,nosuid,nodev',
          '-e', 'CLASSIFARR_GATEWAY_FIXTURE=isolated', '--entrypoint', 'node', image, driver, kind, mode]);
        const value = inspect(name);
        assert.equal(value.Image, image); assert.equal(value.HostConfig.NetworkMode, 'none');
        assert.equal(value.HostConfig.ReadonlyRootfs, true); assert.equal(value.Config.User, '1000:1000');
        assert.equal(value.HostConfig.Memory, archiveWorker ? 268435456 : 1610612736);
        assert.equal(value.HostConfig.MemorySwap, value.HostConfig.Memory);
        assert.equal(value.HostConfig.NanoCpus, archiveWorker ? 500000000 : 1000000000);
        assert.equal(value.HostConfig.PidsLimit, archiveWorker ? 32 : 64);
        assert.ok(value.Mounts.every(m => (archiveWorker ? ['/archives','/receipts','/fixtures','/source-socket','/configuration'] :
          ['/archives','/receipts','/fixtures']).includes(m.Destination)));
        if (!archiveWorker) assert.ok(value.Config.Env.every(item => !/PASSWORD=|TOKEN=|CONFIG_FILE=/.test(item)));
        docker(['start', name]); return { name, started: Date.now(), kind };
      };
      const wait = async (run, boundary = false) => {
        for (;;) {
          // Inspect before reading logs: an exit observed after an older log read can hide the final metric record.
          const state = inspect(run.name).State;
          const logs = records(docker(['logs', run.name]));
          const limit = logs.find(record => record.fixture === 'limits');
          if (limit) {
            assert.equal(limit.memory, run.kind !== 'verifier' ? '268435456' : '1610612736');
            assert.equal(limit.swap, '0'); assert.equal(limit.pids, run.kind !== 'verifier' ? '32' : '64');
            const [quota, period] = limit.cpu.split(' ').map(Number);
            assert.equal(quota / period, run.kind !== 'verifier' ? 0.5 : 1);
          }
          if (boundary && logs.some(record => record.fixture === 'boundary')) return logs;
          if (!state.Running) {
            assert.equal(state.OOMKilled, false); assert.equal(state.ExitCode, 0, JSON.stringify(logs));
            assert.ok(!boundary, 'qualification_boundary_missed'); assert.ok(limit, 'qualification_limits_missing');
            const metrics = logs.find(record => record.fixture === 'metrics'); assert.ok(metrics, 'qualification_metrics_missing');
            report({ scenario: shape, ...metrics, elapsedMs: Date.now() - run.started }); return logs;
          }
          assert.ok(Date.now() - run.started < 220000, 'qualification_observation_deadline');
          await delay(100);
        }
      };
      const run = async (kind, mode) => wait(create(kind, mode));
      const hasState = (logs, state) => assert.ok(logs.some(item => item.state === state), JSON.stringify(logs));
      const kill = run => {
        assert.equal(inspect(run.name).Config.Labels[labelKey], suffix);
        docker(['kill', '--signal', 'SIGKILL', run.name]);
        const value = inspect(run.name); assert.equal(value.State.Running, false); assert.equal(value.State.OOMKilled, false);
        assert.equal(value.State.ExitCode, 137);
      };
      const resume = run => {
        const boundary = records(docker(['logs', run.name])).find(item => item.fixture === 'boundary');
        assert.ok(boundary && Number.isSafeInteger(boundary.pid) && boundary.pid > 1);
        assert.equal(inspect(run.name).Config.Labels[labelKey], suffix);
        assert.equal(inspect(run.name).State.Running, true);
        // One small process; a second Node diagnostic process would itself consume the worker's PID budget.
        docker(['exec', run.name, '/bin/kill', '-CONT', String(boundary.pid)]);
      };
      try {
        report({ scenario: shape, stage: 'setup' }); fixture('setup');
        if (shape === 'cleanup') {
          hasState(await run('archiver'),'awaiting_verification'); hasState(await run('verifier'),'verified');
          hasState(await run('archiver'),'awaiting_verification'); hasState(await run('verifier'),'verified');
          fixture('accept-old'); hasState(await run('archiver'),'unchanged');
          const before = fixture('inspect'); assert.equal(before.protections.length,1);
          fixture('cleanup-tamper');
          const blocked = await run('cleanup'); hasState(blocked,'cleanup_blocked');
          assert.ok(blocked.some(row => row.reason === 'gateway_archive_protection_fence'));
          assert.equal(fixture('cleanup-inspect').operations.length,0);
          fixture('cleanup-repair-fixture'); hasState(await run('cleanup'),'completed');
          const confirmed = fixture('cleanup-inspect').operations[0]; assert.ok(confirmed.confirmed_at);
          assert.equal(confirmed.deleted_bindings,100); assert.equal(confirmed.attempt,1);
          hasState(await run('cleanup'),'unchanged'); assert.deepEqual(fixture('cleanup-inspect').operations[0],confirmed);
          assert.equal(fixture('inspect').admission.binding_count,79900);
          assert.equal(fixture('inspect').admission.attempts,'80000');
          for (let cycle=0;cycle<3;cycle++) {
            if (cycle) { fixture('admit'); fixture('due'); }
            hasState(await run('archiver'),'awaiting_verification'); hasState(await run('verifier'),'verified');
            hasState(await run('archiver'),'unchanged');
            const latest = fixture('inspect').jobs.at(-1);
            if (!cycle) assert.deepEqual(latest.receipt.preserves,[]);
          }
          const after = fixture('inspect');
          assert.equal(after.admission.binding_count,79902); assert.equal(after.admission.attempts,'80002');
          assert.equal(after.jobs[2].status,'retired'); assert.equal(after.archives.length,4);
          assert.ok(after.jobs.slice(0,2).every(job => job.recovery_protection_id && job.status === 'verified'));
          assert.ok(after.jobs.at(-1).receipt.preserves.includes(after.jobs[2].id));
          fixture('cleanup-top-up'); hasState(await run('archiver'),'not_due');
          assert.equal(fixture('inspect').protections.length,2);
          const cadence = await run('cleanup'); hasState(cadence,'cleanup_blocked');
          assert.ok(cadence.some(row => row.reason === 'gateway_cleanup_cooldown'));
          assert.deepEqual(fixture('cleanup-inspect').operations,[confirmed]);
          fixture('cleanup-due');
          const scheduled = fixture('cleanup-inspect').operations[0];
          assert.deepEqual({ ...scheduled,last_attempt_at: confirmed.last_attempt_at },confirmed);
          fixture('cleanup-commit-cut'); assert.equal(fixture('cleanup-inspect').operations[1].confirmed_at,null);
          hasState(await run('cleanup'),'unchanged');
          const recovered = fixture('cleanup-inspect').operations;
          assert.equal(recovered.length,2); assert.ok(recovered[1].confirmed_at); assert.deepEqual(recovered[0],scheduled);
          assert.equal(fixture('inspect').admission.binding_count,79900); assert.equal(fixture('inspect').admission.attempts,'80100');
          report({ scenario: shape,state: 'deleted_and_rotation_continued',deletedBindings: 200,attempts: '80100',retainedArchives: 4 });
        } else if (shape === 'protection') {
          const before = fixture('fingerprint');
          hasState(await run('archiver'),'awaiting_verification'); hasState(await run('verifier'),'verified');
          hasState(await run('archiver'),'awaiting_verification');
          const copies = fixture('inspect'); assert.deepEqual(copies.jobs.map(job => job.attempt),[1,2]);
          assert.equal(copies.jobs[0].revision,copies.jobs[1].revision);
          hasState(await run('verifier'),'verified'); hasState(await run('archiver'),'unchanged');
          const held = fixture('inspect'); assert.equal(held.protections.length,1); assert.ok(held.protections[0].ready_at);
          assert.ok(held.jobs.every(job => job.recovery_protection_id === held.protections[0].id));
          assert.equal(held.protections[0].minimum_recovery_days,30);
          hasState(await run('archiver'),'unchanged'); assert.equal(fixture('inspect').jobs.length,2);
          assert.deepEqual(fixture('fingerprint'),before);
          report({ scenario: shape,state: 'two_copies_protected',attempts: [1,2],historyUnchanged: true });
        } else if (shape === 'cancel') {
          const before = fixture('fingerprint');
          hasState(await run('archiver', 'cancel'), 'cancelled');
          const cancelled = fixture('inspect'); assert.equal(cancelled.jobs.length, 1);
          assert.equal(cancelled.jobs[0].status, 'failed'); assert.equal(cancelled.jobs[0].reason, 'cancelled');
          assert.equal(cancelled.jobs[0].attempt, 1); assert.ok(cancelled.jobs[0].retry_after);
          hasState(await run('archiver'), 'cooldown');
          assert.deepEqual(fixture('fingerprint'), before);
          assert.equal(fixture('inspect').jobs.length, 1);
        } else if (shape === 'oversize') {
          hasState(await run('archiver'), 'awaiting_verification');
          hasState(await run('verifier'), 'verified'); hasState(await run('archiver'), 'unchanged');
          const prior = fixture('inspect').jobs[0]; fixture('wide'); report({ scenario: shape, ...fixture('size') });
          hasState(await run('archiver'), 'export_failed');
          const failed = fixture('inspect'); assert.equal(failed.jobs.length, 2);
          assert.equal(failed.jobs[1].attempt, 1); assert.equal(failed.jobs[1].status, 'failed');
          assert.deepEqual(failed.jobs[0].receipt, prior.receipt); assert.equal(failed.jobs[0].manifest_sha256, prior.manifest_sha256);
          assert.equal(failed.archives.length, 1); assert.equal(failed.admission.attempts, '100000');
          hasState(await run('archiver'), 'cooldown'); assert.equal(fixture('inspect').jobs.length, 2);
        } else {
          const exporting = create('archiver', 'pause'); const boundary = await wait(exporting, true);
          assert.ok(boundary.find(item => item.fixture === 'boundary').bytes > 0);
          report({ scenario: shape, ...boundary.find(item => item.fixture === 'boundary'), action: 'resume_after_concurrent_admission' });
          const first = fixture('inspect'); assert.equal(first.jobs[0].status, 'exporting'); assert.equal(first.counts.dumps, 1);
          assert.equal(fixture('admit').attempts, '99999'); resume(exporting);
          hasState(await wait(exporting), 'awaiting_verification');
          hasState(await run('verifier'), 'verified'); hasState(await run('archiver'), 'not_due');
          const initial = fixture('inspect'); assert.equal(initial.jobs[0].content.request_binding.count, 99998);
          assert.equal(initial.counts.bindings, 99999); fixture('due');
          hasState(await run('archiver'), 'awaiting_verification');
          const beforeRestore = fixture('fingerprint'), pending = fixture('inspect');
          const restoring = create('verifier', 'pause'); const restoreBoundary = await wait(restoring, true);
          assert.ok(restoreBoundary.find(item => item.fixture === 'boundary').restoredRows > 0);
          report({ scenario: shape, ...restoreBoundary.find(item => item.fixture === 'boundary'), action: 'kill' });
          kill(restoring);
          const afterKill = fixture('inspect'); assert.equal(afterKill.jobs[1].status, 'awaiting_verification');
          assert.equal(afterKill.receipts.length, 1); assert.deepEqual(fixture('fingerprint'), beforeRestore);
          hasState(await run('archiver'), 'awaiting_verification');
          assert.equal(fixture('inspect').jobs[1].id, pending.jobs[1].id);
          hasState(await run('verifier', 'cancel'), 'verification_blocked');
          assert.equal(fixture('inspect').receipts.length, 1);
          assert.equal(fixture('inspect').jobs[1].attempt, 1);
          hasState(await run('verifier'), 'verified'); fixture('accept-old'); hasState(await run('archiver'), 'unchanged');
          assert.equal(fixture('admit').attempts, '100000'); fixture('due');
          hasState(await run('archiver'), 'awaiting_verification');
          hasState(await run('verifier'), 'verified');
          hasState(await run('archiver'), 'unchanged');
          const rotated = fixture('inspect'); assert.equal(rotated.jobs[0].status, 'verified');
          assert.equal(rotated.archives.length, 3); assert.equal(rotated.jobs.filter(job => job.status === 'verified').length, 3);
          assert.equal(rotated.protections.length,1); assert.ok(rotated.protections[0].ready_at);
          assert.ok(rotated.jobs.every(job => job.attempt === 1 && job.version === 7 && job.receipt.purgeAuthorized === false));
          report({ scenario: shape, stage: 'restored_and_protected', dumps: rotated.jobs.map(job => job.bytes),
            content: rotated.jobs[2].content, attempts: rotated.admission.attempts });
          report({ scenario: shape, ...fixture('size') });
          assert.equal(fixture('full').state, 'history_full'); fixture('changed'); fixture('due');
          const beforeCrash = fixture('fingerprint');
          const interrupted = create('archiver', 'pause'); await wait(interrupted, true);
          report({ scenario: shape, ...records(docker(['logs', interrupted.name])).find(item => item.fixture === 'boundary'), action: 'kill' });
          const admitted = fixture('inspect'); assert.equal(admitted.jobs[3].status, 'exporting'); assert.equal(admitted.counts.dumps, 1);
          kill(interrupted); assert.deepEqual(fixture('fingerprint'), beforeCrash);
          hasState(await run('archiver'), 'pending'); const blocked = fixture('inspect');
          assert.equal(blocked.jobs[3].status, 'interrupted'); assert.equal(blocked.jobs[3].attempt, 1);
          fixture('due'); hasState(await run('archiver'), 'pending');
          assert.equal(fixture('inspect').jobs.length, 4); assert.equal(blocked.admission.attempts, '100000');
          report({ scenario: shape, ...fixture('quota') });
        }
        report({ scenario: shape, state: 'passed', providerCalls: 0, syntheticDeletedBindings: shape === 'cleanup' ? 200 : 0 });
      } catch (error) {
        if (shape === 'cleanup') {
          try { report({ scenario: shape,cleanupDiagnostic: fixture('cleanup-diagnose') }); }
          catch { report({ scenario: shape,cleanupDiagnostic: 'unavailable' }); }
        }
        try { report({ scenario: shape, diagnostic: fixture('diagnose') }); } catch { report({ scenario: shape, diagnostic: 'unavailable' }); }
        throw error;
      } finally { for (const name of Object.values(workers)) ownedRemove(name); }
    } });
  } finally {
    for (const name of Object.values(workers)) ownedRemove(name);
    for (const volume of Object.values(volumes)) {
      if (docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim()) {
        assert.equal(JSON.parse(docker(['volume', 'inspect', volume]))[0].Labels[labelKey], suffix);
        docker(['volume', 'rm', volume]);
      }
      assert.equal(docker(['volume', 'ls', '-q', '--filter', `name=^${volume}$`]).trim(), '');
    }
    assert.equal(existsSync(spec.hostDataPath), false);
    report({ scenario: shape, cleanup: 'verified' });
  }
}

export async function runGatewayArchiveQualification(image, revision, cleanupOnly = false) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/); assert.match(revision, /^[a-f0-9]{40}$/);
  assert.equal(JSON.parse(docker(['image', 'inspect', image]))[0].Config.Labels['org.opencontainers.image.revision'], revision);
  for (const shape of cleanupOnly ? ['cleanup'] : ['capacity', 'oversize', 'cancel','protection','cleanup']) await qualifyCase(image, shape);
  report({ qualification: 'passed', image, revision });
}
