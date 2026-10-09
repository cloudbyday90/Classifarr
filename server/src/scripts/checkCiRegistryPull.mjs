/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
// CI-only CLI; root tooling is deliberately absent from the published server package.
// eslint-disable-next-line n/no-unpublished-import
import { registryCommand, registryFailure } from '../../../scripts/lib/registryCommand.mjs';

export const CI_DATABASE_IMAGE = 'pgvector/pgvector:0.8.7-pg18';

/** Pull only: no containers, DB connections, appdata or image removal. */
export async function compareRegistryPulls({ command = registryCommand, signal,
  report = record => process.stdout.write(`${JSON.stringify(record)}\n`) } = {}) {
  let passed = true;
  for (const client of ['docker_cli', 'testcontainers']) {
    if (signal?.aborted) return false;
    const started = performance.now();
    const result = client === 'docker_cli'
      ? await command('docker', ['pull', '--quiet', CI_DATABASE_IMAGE], { timeoutMs: 180_000, signal })
      : await command(process.execPath, [import.meta.filename, '--testcontainers'], { timeoutMs: 180_000, signal });
    // The child returns only a fixed category. All other output remains private.
    let code = registryFailure(result);
    const categories = ['credentials_rejected', 'rate_limit', 'tls_failure', 'transport_timeout', 'registry_unavailable', 'unknown_failure'];
    if (!result.ok && categories.includes(result.stdout?.trim())) code = result.stdout.trim();
    report({ stage: 'image_pull', client, image: CI_DATABASE_IMAGE, code,
      elapsedMs: Math.round(performance.now() - started) });
    passed = passed && result.ok;
  }
  return passed;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  if (process.argv[2] === '--testcontainers') {
    try {
      // eslint-disable-next-line n/no-unpublished-import -- CI-only development dependency.
      const { getContainerRuntimeClient, ImageName } = await import('testcontainers');
      const client = await getContainerRuntimeClient();
      await client.image.pull(ImageName.fromString(CI_DATABASE_IMAGE), { force: true });
      process.exitCode = 0;
    } catch (error) {
      process.stdout.write(`${registryFailure({ ok: false, stderr: String(error?.message ?? '') })}\n`);
      process.exitCode = 1;
    }
  } else {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once('SIGINT', cancel);
    process.once('SIGTERM', cancel);
    try { if (!await compareRegistryPulls({ signal: controller.signal })) process.exitCode = 1; }
    catch { process.stderr.write('Registry pull comparison failed.\n'); process.exitCode = 1; }
    finally {
      process.removeListener('SIGINT', cancel);
      process.removeListener('SIGTERM', cancel);
    }
  }
}
