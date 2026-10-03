/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { ROUTING_PLATFORMS, verifiedManifest } from './publishedRoutingSubject.mjs';
import { PUBLISHED_IMAGE_REPOSITORIES, EXPECTED_RELEASE_REPOSITORY, EXPECTED_SIGNER_WORKFLOW,
  assertSourceRevision, parsePublishedImageReference } from './publishedDigestConsumerSmoke.mjs';

const indexTypes = ['application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.list.v2+json'];
const childTypes = ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'];
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function inspect(command, reference, format) {
  return command('docker', ['buildx', 'imagetools', 'inspect', ...format, reference]);
}

export function verifyPromotionGraph(command, image) {
  const { repository, digest } = parsePublishedImageReference(image);
  const index = verifiedManifest(inspect(command, image, ['--raw']), digest);
  assert.ok(indexTypes.includes(index.mediaType));
  assert.ok(Array.isArray(index.manifests) && index.manifests.length >= 2 && index.manifests.length <= 16);
  assert.equal(new Set(index.manifests.map(item => item.digest)).size, index.manifests.length);
  for (const platform of ROUTING_PLATFORMS) {
    assert.equal(index.manifests.filter(item => `${item.platform?.os}/${item.platform?.architecture}` === platform).length, 1);
  }
  // Include attestation children (unknown/unknown), not just runnable architectures.
  for (const child of index.manifests) {
    assert.match(child.digest ?? '', digestPattern);
    assert.ok(childTypes.includes(child.mediaType));
    const manifest = verifiedManifest(inspect(command, `${repository}@${child.digest}`, ['--raw']), child.digest);
    assert.equal(manifest.mediaType, child.mediaType);
    assert.match(manifest.config?.digest ?? '', digestPattern);
  }
  return index;
}

function attest(command, image, revision) {
  command('gh', ['attestation', 'verify', `oci://${image}`, '--repo', EXPECTED_RELEASE_REPOSITORY,
    '--signer-workflow', EXPECTED_SIGNER_WORKFLOW, '--source-digest', revision, '--deny-self-hosted-runners']);
}

function currentDigest(command, repository) {
  // Missing aliases and transport/auth failures all stop; absence is not inferred from CLI text.
  const result = JSON.parse(inspect(command, `${repository}:latest`, ['--format', '{{json .Manifest}}']));
  assert.match(result.digest ?? '', digestPattern);
  return result.digest;
}

function assertForwardPromotion(command, repository, current, subject) {
  if (current === subject.digest) return;
  const image = `${repository}@${current}`;
  const index = verifyPromotionGraph(command, image);
  const child = index.manifests.find(item => item.platform?.os === 'linux' && item.platform?.architecture === 'amd64');
  const config = JSON.parse(inspect(command, `${repository}@${child.digest}`, ['--format', '{{json .Image}}']));
  const revision = assertSourceRevision(config?.config?.Labels?.['org.opencontainers.image.revision']);
  attest(command, image, revision);
  // Serialization alone cannot prevent a delayed old run from rolling latest back.
  command('git', ['merge-base', '--is-ancestor', revision, subject.sourceRevision]);
}

/** Both registries preflight before writing; retry safely after a partial promotion. */
export function promoteReleaseImages({ subject, command, write = false, record = () => {} }) {
  assertSourceRevision(subject.sourceRevision);
  assert.match(subject.digest, digestPattern);
  const receipt = { schemaVersion: 'classifarr.release.image-promotion.v2', status: 'checking',
    tag: subject.tag, sourceRevision: subject.sourceRevision, digest: subject.digest,
    releaseId: subject.releaseId, phase: 'preflight', activeRepository: null, registries: [] };
  const phase = (name, repository) => {
    receipt.phase = name; receipt.activeRepository = repository; record(receipt);
  };
  record(receipt);
  try {
    for (const repository of PUBLISHED_IMAGE_REPOSITORIES) {
      const image = `${repository}@${subject.digest}`;
      phase('candidate_provenance', repository);
      attest(command, image, subject.sourceRevision);
      phase('candidate_graph', repository);
      verifyPromotionGraph(command, image);
      phase('current_alias', repository);
      const current = currentDigest(command, repository);
      phase('source_ancestry', repository);
      assertForwardPromotion(command, repository, current, subject);
      receipt.registries.push({ repository, previousDigest: current, status: 'preflight_passed' });
    }
    // Recheck the pair before the first mutation; all workflow writers share one lock.
    for (const registry of receipt.registries) {
      phase('alias_recheck', registry.repository);
      assert.equal(currentDigest(command, registry.repository), registry.previousDigest);
    }
    if (!write) {
      receipt.status = 'dry_run_passed';
      phase('complete', null);
      return receipt;
    }
    for (const registry of receipt.registries) {
      phase('alias_recheck', registry.repository);
      assert.equal(currentDigest(command, registry.repository), registry.previousDigest);
      registry.status = 'write_started';
      phase('alias_write', registry.repository);
      if (registry.previousDigest !== subject.digest) {
        command('docker', ['buildx', 'imagetools', 'create', '--tag', `${registry.repository}:latest`,
          `${registry.repository}@${subject.digest}`], 300_000);
      }
      phase('alias_verification', registry.repository);
      assert.equal(currentDigest(command, registry.repository), subject.digest);
      verifyPromotionGraph(command, `${registry.repository}@${subject.digest}`);
      phase('native_pull', registry.repository);
      command('docker', ['pull', `${registry.repository}:latest`], 300_000);
      assert.equal(currentDigest(command, registry.repository), subject.digest);
      registry.status = 'verified';
      record(receipt);
    }
    receipt.status = 'passed';
    phase('complete', null);
    return receipt;
  } catch {
    receipt.status = 'failed';
    record(receipt);
    throw new Error('release_image_promotion_failed');
  }
}
