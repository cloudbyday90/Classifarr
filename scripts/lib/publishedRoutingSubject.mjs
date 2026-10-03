/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertSourceRevision, parsePublishedImageReference, EXPECTED_RELEASE_REPOSITORY,
  EXPECTED_SIGNER_WORKFLOW } from './publishedDigestConsumerSmoke.mjs';

export const ROUTING_PLATFORMS = Object.freeze(['linux/amd64', 'linux/arm64']);
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const indexTypes = ['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'];
const manifestTypes = ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'];

/** Match registry bytes, not a reserialized JSON object. Buildx may append a newline. */
export function verifiedManifest(raw, digest) {
  assert.match(digest, digestPattern);
  assert.equal(typeof raw, 'string');
  assert.ok(Buffer.byteLength(raw) <= 4 * 1024 * 1024);
  const bytes = [raw, raw.replace(/\r?\n$/, '')].find(value =>
    `sha256:${createHash('sha256').update(value).digest('hex')}` === digest);
  assert.notEqual(bytes, undefined);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schemaVersion, 2);
  return manifest;
}

/** Attested index -> platform manifest -> config digest -> exact local image ID. */
export function resolvePublishedRoutingSubject({ image, sourceRevision, platform, run = spawnSync }) {
  const parsed = parsePublishedImageReference(image);
  assert.equal(parsed.repository, 'ghcr.io/cloudbyday90/classifarr');
  const revision = assertSourceRevision(sourceRevision);
  assert.ok(ROUTING_PLATFORMS.includes(platform));
  const command = (binary, args, timeout = 60_000) => {
    let result;
    try { result = run(binary, args, { encoding: 'utf8', shell: false, windowsHide: true,
      timeout, maxBuffer: 4 * 1024 * 1024 }); } catch { /* Never expose CLI output or credentials. */ }
    if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') {
      throw new Error('published_routing_subject_command_failed');
    }
    return result.stdout;
  };
  assert.equal(command('docker', ['version', '--format', '{{.Server.Os}}/{{.Server.Arch}}']).trim(), platform);
  command('gh', ['attestation', 'verify', `oci://${parsed.image}`, '--repo', EXPECTED_RELEASE_REPOSITORY,
    '--signer-workflow', EXPECTED_SIGNER_WORKFLOW, '--source-digest', revision, '--deny-self-hosted-runners'], 120_000);
  const index = verifiedManifest(command('docker', ['buildx', 'imagetools', 'inspect', '--raw', parsed.image]), parsed.digest);
  assert.ok(indexTypes.includes(index.mediaType));
  assert.ok(Array.isArray(index.manifests));
  const matches = index.manifests.filter(item => `${item.platform?.os}/${item.platform?.architecture}` === platform);
  assert.equal(matches.length, 1);
  const descriptor = matches[0];
  assert.ok(manifestTypes.includes(descriptor.mediaType));
  assert.match(descriptor.digest, digestPattern);
  const manifest = verifiedManifest(command('docker', ['buildx', 'imagetools', 'inspect', '--raw',
    `${parsed.repository}@${descriptor.digest}`]), descriptor.digest);
  assert.equal(manifest.mediaType, descriptor.mediaType);
  assert.match(manifest.config?.digest ?? '', digestPattern);
  const childImage = `${parsed.repository}@${descriptor.digest}`;
  command('docker', ['pull', '--platform', platform, childImage], 300_000);
  const local = JSON.parse(command('docker', ['image', 'inspect', '--format', '{{json .}}', childImage]));
  // Classic Docker identifies images by config; containerd identifies the manifest.
  assert.ok([manifest.config.digest, descriptor.digest].includes(local.Id));
  if (local.Id === descriptor.digest) assert.equal(local.Descriptor?.digest, descriptor.digest);
  assert.equal(`${local.Os}/${local.Architecture}`, platform);
  assert.ok(local.RepoDigests?.includes(childImage));
  assert.equal(local.Config?.Labels?.['org.opencontainers.image.revision'], revision);
  return { image: parsed.image, platform, manifestDigest: descriptor.digest, configDigest: manifest.config.digest, imageId: local.Id,
    sourceRevision: revision, provenance: { repository: EXPECTED_RELEASE_REPOSITORY,
      signerWorkflow: EXPECTED_SIGNER_WORKFLOW, verified: true } };
}
