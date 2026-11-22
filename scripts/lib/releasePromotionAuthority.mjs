/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertReleaseTag, validateReleaseCandidateEvidence, RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION,
  ROUTING_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION } from './releaseCandidateEvidence.mjs';
import { EXPECTED_RELEASE_REPOSITORY, EXPECTED_SIGNER_WORKFLOW } from './publishedDigestConsumerSmoke.mjs';

function assertReleaseEvidence(evidence, tag) {
  const validation = validateReleaseCandidateEvidence(evidence);
  assert.equal(validation.ok, true);
  assert.equal(evidence.tag, assertReleaseTag(tag));
  return validation.evidence;
}

export function assertPromotionEvidence(evidence, { tag, sourceRevision, digest, workflow } = {}) {
  assert.equal(evidence?.schema_version, RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION);
  const subject = assertReleaseEvidence(evidence, tag);
  if (sourceRevision) assert.equal(subject.sourceRevision, sourceRevision);
  if (digest) assert.equal(subject.digest, digest);
  if (workflow) {
    for (const receipt of evidence.published_routing) assert.deepEqual(receipt.workflow, workflow);
    assert.deepEqual(evidence.published_scheduled_recovery.workflow, workflow);
  }
  return subject;
}

/** Only an immutable published release with an attested current-schema asset is authority. */
export function loadPromotionAuthority({ tag, sourceRevision, digest, workflow, command }) {
  return loadVerifiedRelease({ tag, command, check: evidence => assertPromotionEvidence(evidence, { tag, sourceRevision, digest, workflow }) });
}

/** Historical rehearsal can read a signed v3 release without authorizing promotion. */
export function loadHistoricalReleaseEvidence({ tag, command }) {
  return loadVerifiedRelease({ tag, command, check: evidence => {
    assert.ok([ROUTING_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION, RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION].includes(evidence?.schema_version));
    return assertReleaseEvidence(evidence, tag);
  } });
}

function loadVerifiedRelease({ tag, command, check }) {
  assertReleaseTag(tag);
  const repo = EXPECTED_RELEASE_REPOSITORY;
  const release = JSON.parse(command('gh', ['api', `repos/${repo}/releases/tags/${tag}`]));
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false);
  assert.equal(release.immutable, true);
  assert.ok(Number.isSafeInteger(release.id) && release.id > 0);
  const assets = release.assets?.filter(asset => asset.name === `${tag}-evidence.json`);
  assert.equal(assets?.length, 1);
  const asset = assets[0];
  assert.ok(Number.isSafeInteger(asset.id) && asset.id > 0);
  assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size <= 4 * 1024 * 1024);
  command('gh', ['release', 'verify', tag, '--repo', repo]);
  const raw = command('gh', ['api', `repos/${repo}/releases/assets/${asset.id}`, '-H', 'Accept: application/octet-stream']);
  assert.equal(Buffer.byteLength(raw), asset.size);
  const evidence = JSON.parse(raw);
  const subject = check(evidence);
  const directory = mkdtempSync(join(tmpdir(), 'classifarr-promotion-'));
  try {
    const file = join(directory, `${tag}-evidence.json`);
    writeFileSync(file, raw, { flag: 'wx', mode: 0o600 });
    command('gh', ['release', 'verify-asset', tag, file, '--repo', repo]);
    command('gh', ['attestation', 'verify', file, '--repo', repo, '--signer-workflow', EXPECTED_SIGNER_WORKFLOW,
      '--source-digest', subject.sourceRevision, '--source-ref', `refs/tags/${tag}`,
      '--predicate-type', 'https://slsa.dev/provenance/v1', '--deny-self-hosted-runners']);
  } finally {
    // Only this mkdtemp-owned evidence directory is removed.
    rmSync(directory, { recursive: true, force: true });
  }
  return { ...subject, releaseId: release.id };
}
