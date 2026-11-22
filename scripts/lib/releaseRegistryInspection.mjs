/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { ROUTING_PLATFORMS, verifiedManifest } from './publishedRoutingSubject.mjs';
import { parsePublishedImageReference, PUBLISHED_IMAGE_REPOSITORIES } from './publishedDigestConsumerSmoke.mjs';

const indexTypes = ['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'];
const childTypes = ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'];
const digestPattern = /^sha256:[a-f0-9]{64}$/;

export function inspectRegistryReference(command, reference, format) {
  return command('docker', ['buildx', 'imagetools', 'inspect', ...format, reference]);
}

export function readRegistryDigest(command, reference) {
  const result = JSON.parse(inspectRegistryReference(command, reference, ['--format', '{{json .Manifest}}']));
  assert.match(result.digest ?? '', digestPattern);
  return result.digest;
}

export function verifyPromotionGraph(command, image, { routingSubjects = [] } = {}) {
  const { repository, digest } = parsePublishedImageReference(image);
  const index = verifiedManifest(inspectRegistryReference(command, image, ['--raw']), digest);
  assert.ok(indexTypes.includes(index.mediaType));
  assert.ok(Array.isArray(index.manifests) && index.manifests.length >= 2 && index.manifests.length <= 16);
  assert.equal(new Set(index.manifests.map(item => item.digest)).size, index.manifests.length);
  for (const platform of ROUTING_PLATFORMS) {
    assert.equal(index.manifests.filter(item => `${item.platform?.os}/${item.platform?.architecture}` === platform).length, 1);
  }
  const expectedConfigs = new Map(routingSubjects.map(({ platform, manifestDigest, configDigest }) => {
    const child = index.manifests.find(item => `${item.platform?.os}/${item.platform?.architecture}` === platform);
    assert.equal(child?.digest, manifestDigest);
    return [manifestDigest, configDigest];
  }));
  // Include attestation children (unknown/unknown), not just runnable architectures.
  for (const child of index.manifests) {
    assert.match(child.digest ?? '', digestPattern);
    assert.ok(childTypes.includes(child.mediaType));
    const manifest = verifiedManifest(inspectRegistryReference(command, `${repository}@${child.digest}`, ['--raw']), child.digest);
    assert.equal(manifest.mediaType, child.mediaType);
    assert.match(manifest.config?.digest ?? '', digestPattern);
    if (expectedConfigs.has(child.digest)) assert.equal(manifest.config.digest, expectedConfigs.get(child.digest));
  }
  return index;
}

export function readReleaseRegistryTags(command, tag) {
  return PUBLISHED_IMAGE_REPOSITORIES.map(repository => ({ repository,
    versionDigest: readRegistryDigest(command, `${repository}:${tag}`),
    latestDigest: readRegistryDigest(command, `${repository}:latest`),
  }));
}
