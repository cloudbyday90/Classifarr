/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// eslint-disable-next-line n/no-unpublished-import -- Isolated offline development profiler, never server startup.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runCorpusProfileMeasurements } from './descriptionCorpusProfile/runner.mjs';

const execute = promisify(execFile);
const quiet = { timeout: 15000, maxBuffer: 65536, windowsHide: true };

class CorpusProfilePostgres extends PostgreSqlContainer {
  async beforeContainerCreated() {
    this.hostConfig.PidsLimit = 256;
    this.hostConfig.PortBindings = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '0' }] };
  }
}

export async function runDescriptionCorpusProfile(argv = process.argv.slice(2)) {
  if (!Array.isArray(argv) || argv.length) throw new Error('corpus_profile_accepts_no_arguments');
  const { stdout } = await execute('docker', ['image', 'inspect', 'postgres:18.6-alpine', '--format', '{{.Id}}'], quiet);
  const image = stdout.trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('corpus_profile_image_invalid');
  let ownedId;
  let report;
  try { report = await runLibraryScanRecoveryBenchmark({ argv,
    start: async password => {
      const container = await new CorpusProfilePostgres(image)
        .withDatabase('scan_recovery_benchmark').withUsername('benchmark').withPassword(password)
        // Testcontainers expresses memory in GiB; Docker inspection below verifies bytes.
        .withResourcesQuota({ memory: 1, cpu: 2 })
        .withPullPolicy({ shouldPull: () => 'never' }).withStartupTimeout(60000).start();
      ownedId = container.getId();
      try {
        const inspected = await execute('docker', ['inspect', ownedId, '--format',
          '{{json .Image}}|{{json .HostConfig.Memory}}|{{json .HostConfig.NanoCpus}}|{{json .HostConfig.PidsLimit}}|{{json .HostConfig.PortBindings}}'], quiet);
        const [actualImage, memory, cpus, pids, ports] = inspected.stdout.trim().split('|').map(value => JSON.parse(value));
        if (!['localhost', '127.0.0.1', '::1'].includes(container.getHost()) || actualImage !== image ||
            memory !== 1024 ** 3 || cpus !== 2e9 || pids !== 256 ||
            ports?.['5432/tcp']?.length !== 1 || ports['5432/tcp'][0].HostIp !== '127.0.0.1') {
          throw new Error('corpus_profile_container_limits_invalid');
        }
      } catch (error) {
        await container.stop();
        throw error;
      }
      return container;
    }, measure: runCorpusProfileMeasurements }); }
  finally {
    if (ownedId) {
      const remaining = await execute('docker', ['ps', '-aq', '--filter', `id=${ownedId}`], quiet);
      if (remaining.stdout.trim()) throw new Error('corpus_profile_container_cleanup_failed');
    }
  }
  return { ...report, databaseImageId: image, containerCleanupVerified: true };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runDescriptionCorpusProfile().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch(() => { process.stderr.write('Description corpus profile failed; no live recovery or configuration change requested.\n'); process.exitCode = 1; });
}
