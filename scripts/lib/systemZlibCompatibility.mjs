/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { docker, fixture, runZlibContainer, withSystemZlibProbe } from './systemZlibDocker.mjs';

export async function verifySystemZlibImage(image, sourceRevision) {
  assert.match(image, /^(?:sha256:[a-f0-9]{64}|classifarr:[a-z0-9][a-z0-9_.-]{0,80})$/);
  assert.match(sourceRevision, /^[a-f0-9]{40,64}$/);
  const imageId = docker(['image', 'inspect', '--format', '{{.Id}}', image]);
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(docker(['image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', imageId]), sourceRevision);
  const architecture = docker(['image', 'inspect', '--format', '{{.Architecture}}', imageId]);
  assert.ok(['amd64', 'arm64'].includes(architecture));
  const platform = `linux/${architecture}`;
  runZlibContainer(imageId, ['/sbin/apk', 'info', '--exists', 'zlib=1.4-r0'], { platform });
  const native = await withSystemZlibProbe(platform, async directory => JSON.parse(runZlibContainer(imageId,
    ['/bin/sh', '-c', 'cp /probe/zlib-probe /tmp/zlib-probe && chmod 0555 /tmp/zlib-probe && exec /tmp/zlib-probe'],
    // Keep the private export directory off the mount; host/container UIDs can differ.
    { mounts: [{ source: resolve(directory, 'zlib-probe'), target: '/probe/zlib-probe' }], platform })));
  assert.deepEqual(native, { version: '1.4', dynamicLibrary: true, offsetBytes: 8, resetClearsHeader: true,
    exactBoundaryEnds: true, roundtrip: true, truncation: true, seek: true });
  const mounts = [{ source: fixture, target: '/zlib-fixture' }];
  const postgres = JSON.parse(runZlibContainer(imageId, ['/bin/sh', '/zlib-fixture/pg-roundtrip.sh'], { mounts, platform, timeoutMs: 120000 }));
  assert.deepEqual(postgres, { postgres17: true, postgres18: true, rowsPerMajor: 32, gzipCustomRoundtrip: true });
  const curl = JSON.parse(runZlibContainer(imageId, ['node', '/zlib-fixture/curl.mjs'], { mounts, platform }));
  assert.equal(curl.curlCompressed, true);
  return { schemaVersion: 'classifarr.system-zlib.v1', sourceRevision, imageId, architecture,
    package: 'zlib-1.4-r0', native, postgres, curlCompressed: true, nodeZlib: curl.nodeZlib, cleanup: 'passed' };
}
