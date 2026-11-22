/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyPublishedRelease } from '../../../../scripts/verify-published-release.mjs';
import { PUBLISHED_IMAGE_REPOSITORIES } from '../../../../scripts/lib/publishedDigestConsumerSmoke.mjs';
import { NOW, SOURCE, WORKFLOW, receipt } from '../helpers/publishedRoutingFixture.mjs';
import { TAG, promotionEvidence } from '../helpers/releasePromotionFixture.mjs';

const runId = Number(WORKFLOW.runId), runAttempt = Number(WORKFLOW.runAttempt);
const path = `repos/cloudbyday90/Classifarr/actions/runs/${runId}/attempts/${runAttempt}`;
const indexType = 'application/vnd.oci.image.index.v1+json';
const childType = 'application/vnd.oci.image.manifest.v1+json';
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const olderDigest = hash('older release');
const completed = { status: 'completed', conclusion: 'success' };

function registryGraph() {
  const blobs = new Map(), routing = [receipt(), receipt('linux/arm64')];
  const manifests = routing.map(value => {
    const { configDigest, platform } = value.subject;
    const raw = JSON.stringify({ schemaVersion: 2, mediaType: childType, config: { digest: configDigest } });
    const digest = hash(raw);
    blobs.set(digest, raw);
    value.subject.manifestDigest = digest;
    return { platform: { os: 'linux', architecture: platform.split('/')[1] }, mediaType: childType, digest };
  });
  const raw = JSON.stringify({ schemaVersion: 2, mediaType: indexType, manifests });
  const digest = hash(raw);
  blobs.set(digest, raw);
  for (const value of routing) value.subject.image = `ghcr.io/cloudbyday90/classifarr@${digest}`;
  return { digest, blobs, evidence: promotionEvidence({ digest, routing }) };
}

function job(name, steps, label = 'ubuntu-latest') {
  return { name, run_id: runId, run_attempt: runAttempt, head_sha: SOURCE, ...completed,
    labels: [label], steps: steps.map(name => ({ name, ...completed })) };
}

function fixture({ attemptChange = () => {}, jobsChange = () => {}, evidenceChange = () => {},
  referenceDigest = (_reference, _read, digest) => digest, graphChange = (_reference, raw) => raw, fail = () => false } = {}) {
  const { digest, blobs, evidence } = registryGraph();
  evidenceChange(evidence);
  const rawEvidence = JSON.stringify(evidence);
  const attempt = { id: runId, run_attempt: runAttempt, path: '.github/workflows/ci.yml', event: 'push',
    head_branch: TAG, head_sha: SOURCE, ...completed };
  attemptChange(attempt);
  const jobs = [job('Published Routing (amd64)', ['Verify and rehearse published routing'], 'ubuntu-24.04'),
    job('Published Routing (arm64)', ['Verify and rehearse published routing', 'Rehearse release arm64 scheduled recovery',
      'Upload release arm64 scheduled recovery receipt'], 'ubuntu-24.04-arm'),
    job('Release Candidate Publication', ['Create and verify immutable GitHub release']),
    job('Promote accepted images to latest / Promote verified release digest to latest', ['Verify release and promote exact indexes'])];
  const jobList = { jobs, total_count: jobs.length };
  jobsChange(jobList);
  const reads = new Map();
  const command = jest.fn((binary, args) => {
    if (fail(binary, args)) throw new Error('private command output');
    if (binary === 'gh') {
      if (args[0] === 'api') {
        if (args[1] === path) return JSON.stringify(attempt);
        if (args[1] === `${path}/jobs?per_page=100`) return JSON.stringify(jobList);
        if (args[1].endsWith(`/releases/tags/${TAG}`)) return JSON.stringify({ tag_name: TAG, draft: false, immutable: true,
          id: 11, assets: [{ id: 12, name: `${TAG}-evidence.json`, size: Buffer.byteLength(rawEvidence) }] });
        if (args[1].endsWith('/releases/assets/12')) return rawEvidence;
      }
      if (args[0] === 'release' && args[1] === 'verify') return '';
      if (args[0] === 'release' && args[1] === 'verify-asset') {
        expect(readFileSync(args[3], 'utf8')).toBe(rawEvidence);
        return '';
      }
      if (args[0] === 'attestation' && args[1] === 'verify') return '';
    }
    if (binary === 'docker' && args.slice(0, 3).join(' ') === 'buildx imagetools inspect') {
      const reference = args.at(-1);
      if (args[3] === '--raw') return graphChange(reference, blobs.get(reference.split('@')[1]));
      const read = (reads.get(reference) ?? 0) + 1;
      reads.set(reference, read);
      return JSON.stringify({ digest: referenceDigest(reference, read, digest) });
    }
    throw new Error('unexpected command');
  });
  const args = ['--tag', TAG, '--source-revision', SOURCE, '--digest', digest, '--run-id', WORKFLOW.runId, '--run-attempt', WORKFLOW.runAttempt];
  return { digest, command, reads, args, verify: () => verifyPublishedRelease(args, { command, now: () => NOW }) };
}

test('requires signed evidence, exact attempt and matching references before and after graph reads', () => {
  const { command, reads, digest, verify } = fixture();
  expect(verify()).toEqual({ schemaVersion: 'classifarr.release.verification.v1', status: 'passed', observedAt: NOW, failureStage: null,
    release: { tag: TAG, sourceRevision: SOURCE, digest, releaseId: 11 }, workflow: WORKFLOW,
    registries: PUBLISHED_IMAGE_REPOSITORIES.map(repository => ({ repository, versionDigest: digest, latestDigest: digest })) });
  expect([...reads.values()]).toEqual([2, 2, 2, 2]);
  for (const [binary, args] of command.mock.calls) {
    if (binary === 'docker') expect(args.slice(0, 3)).toEqual(['buildx', 'imagetools', 'inspect']);
    else expect(args).not.toContain('--method');
  }
});

test.each([
  ['registry_tags', (ref, _read, digest) => ref === `${PUBLISHED_IMAGE_REPOSITORIES[0]}:latest` ? olderDigest : digest],
  ['registry_tags', (ref, _read, digest) => ref.endsWith(`:${TAG}`) ? olderDigest : digest],
  ['registry_recheck', (ref, read, digest) => read === 2 && ref.endsWith(':latest') ? olderDigest : digest],
])('reports %s when current aliases disagree or change', (failureStage, referenceDigest) => {
  const { verify } = fixture({ referenceDigest });
  expect(verify()).toMatchObject({ status: 'blocked', failureStage,
    registries: expect.arrayContaining([expect.objectContaining({ repository: PUBLISHED_IMAGE_REPOSITORIES[0] })]) });
});

test('refuses wrong graph bytes despite matching tag digests', () => {
  const { verify } = fixture({ graphChange: (_reference, raw) => `${raw} ` });
  expect(verify()).toMatchObject({ status: 'blocked', failureStage: 'registry_graph' });
});

test.each(['manifestDigest', 'configDigest'])('refuses an attested but inconsistent arm64 %s', field => {
  const { verify } = fixture({ evidenceChange: evidence => {
    const arm = evidence.published_routing[1];
    arm.subject[field] = olderDigest;
    if (field === 'configDigest') {
      arm.subject.imageId = olderDigest;
      arm.routing.candidateImageId = olderDigest;
    }
    evidence.published_scheduled_recovery.subject = { ...arm.subject };
    delete evidence.evidence_fingerprint;
    evidence.evidence_fingerprint = { algorithm: 'sha256', value: hash(JSON.stringify(evidence)) };
  } });
  expect(verify()).toMatchObject({ status: 'blocked', failureStage: 'registry_graph' });
});

test.each([{ run_attempt: 1 }, { head_sha: 'f'.repeat(40) }, { head_branch: 'main' }, { event: 'workflow_dispatch' },
  { conclusion: 'failure' }])('refuses the wrong or failed workflow attempt before touching registries', change => {
  const { command, verify } = fixture({ attemptChange: attempt => Object.assign(attempt, change) });
  expect(verify()).toMatchObject({ status: 'blocked', failureStage: 'workflow' });
  expect(command.mock.calls.every(([binary]) => binary === 'gh')).toBe(true);
});

test.each([
  value => { value.jobs.pop(); },
  value => { value.jobs[2] = value.jobs[0]; },
  value => { value.jobs[1].labels = ['ubuntu-24.04']; },
  value => { value.jobs[1].steps[1].conclusion = 'skipped'; },
  value => { value.jobs[3].run_attempt -= 1; },
])('refuses missing, duplicate, skipped or unrelated jobs', jobsChange => {
  const { verify } = fixture({ jobsChange });
  expect(verify()).toMatchObject({ status: 'blocked', failureStage: 'workflow' });
});

test('refuses a different expected attempt and legacy evidence before reading workflow or registry data', () => {
  const f = fixture();
  expect(verifyPublishedRelease([...f.args.slice(0, -1), '9'], { command: f.command }))
    .toMatchObject({ status: 'blocked', failureStage: 'release' });
  expect(f.command.mock.calls.every(([, args]) => !args[1]?.includes('/actions/'))).toBe(true);
  expect(fixture({ evidenceChange: value => { value.schema_version = 'classifarr.release.candidate-evidence.v3'; } }).verify())
    .toMatchObject({ status: 'blocked', failureStage: 'release' });
});

test('sanitizes verification errors and refuses unknown arguments before execution', () => {
  const { verify, command, args } = fixture({ fail: (binary, value) => binary === 'gh' && value[0] === 'attestation' });
  const authFailure = verify();
  expect(authFailure).toMatchObject({ status: 'blocked', failureStage: 'release' });
  expect(JSON.stringify(authFailure)).not.toContain('private command output');
  command.mockClear();
  expect(verifyPublishedRelease([...args, '--write'], { command })).toMatchObject({ status: 'blocked', failureStage: 'input' });
  expect(command).not.toHaveBeenCalled();
});

test('real entry point exits nonzero and returns bounded JSON for invalid input', () => {
  const script = fileURLToPath(new URL('../../../../scripts/verify-published-release.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--write'], { encoding: 'utf8', timeout: 10_000 });
  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'blocked', failureStage: 'input' });
  expect(result.stderr).toBe('');
});
