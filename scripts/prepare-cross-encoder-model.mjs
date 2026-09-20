/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, link, rm, access, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { CROSS_ENCODER_REVISION } from '../server/src/services/localCrossEncoderConfig.mjs';
import { CROSS_ENCODER_ARTIFACTS } from './lib/cross-encoder-artifacts.mjs';

const directory = resolve(import.meta.dirname, '..', '.tmp', 'cross-encoder-model', CROSS_ENCODER_REVISION);
const exists = path => access(path).then(() => true, () => false);
async function verify(path, artifact, signal) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    signal?.throwIfAborted(); bytes += chunk.length;
    if (bytes > artifact.maxBytes) throw new Error('cross_encoder_artifact_size');
    hash.update(chunk);
  }
  if (hash.digest('hex') !== artifact.sha256) throw new Error('cross_encoder_artifact_mismatch');
}
/** An exclusive staging handle owns cleanup; publication never replaces an existing artifact. */
export async function stageCrossEncoderArtifact(target, artifact, { signal, fetchRequest = fetch } = {}) {
  signal?.throwIfAborted();
  const partial = `${target}.partial`, handle = await open(partial, 'wx');
  let bytes = 0;
  try {
    const abort = AbortSignal.any([AbortSignal.timeout(600_000), ...(signal ? [signal] : [])]);
    const response = await fetchRequest(artifact.url, { signal: abort });
    if (!response.ok || !response.body) {
      await Promise.allSettled([response.body?.cancel()]);
      throw new Error('cross_encoder_download_failed');
    }
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, encoding, callback) {
      bytes += chunk.length; callback(bytes > artifact.maxBytes ? new Error('cross_encoder_artifact_size') : null, chunk);
    } }), handle.createWriteStream(), { signal: abort });
    await verify(partial, artifact, abort); abort.throwIfAborted();
    await link(partial, target);
    return bytes;
  } finally {
    await Promise.allSettled([handle.close()]);
    await rm(partial, { force: true });
  }
}
/** Explicit preparation only; runtime never downloads artifacts. Existing files are verified, never overwritten. */
export async function prepareCrossEncoderModel({ signal } = {}) {
  await mkdir(directory, { recursive: true });
  for (const artifact of CROSS_ENCODER_ARTIFACTS) {
    signal?.throwIfAborted();
    const target = resolve(directory, artifact.name);
    if (await exists(target)) { await verify(target, artifact, signal); continue; }
    const bytes = await stageCrossEncoderArtifact(target, artifact, { signal });
    process.stdout.write(`Verified ${artifact.name} (${bytes} bytes).\n`);
  }
  return directory;
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const controller = new AbortController(), cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  prepareCrossEncoderModel({ signal: controller.signal }).then(() => process.stdout.write('Pinned cross-encoder artifacts verified.\n'))
    .catch(() => { process.stderr.write('Model preparation failed; no live service changed. Check downloads or existing artifact hashes.\n'); process.exitCode = controller.signal.aborted ? 130 : 1; })
    .finally(() => { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); });
}
