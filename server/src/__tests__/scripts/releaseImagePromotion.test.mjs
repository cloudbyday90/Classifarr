/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { promoteReleaseImages, verifyPromotionGraph } from '../../../../scripts/lib/releaseImagePromotion.mjs';
import { createPromotionCommand } from '../../../../scripts/lib/releasePromotionCommand.mjs';

const hash = raw => `sha256:${createHash('sha256').update(raw).digest('hex')}`;
const childType = 'application/vnd.oci.image.manifest.v1+json';
const children = ['amd64', 'arm64', 'unknown'].map((arch, i) => JSON.stringify({ schemaVersion: 2,
  mediaType: childType, config: { digest: `sha256:${String(i).repeat(64)}` }, layers: [] }));
const index = JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: children.map((raw, i) => ({ mediaType: childType, digest: hash(raw),
    platform: { os: i === 2 ? 'unknown' : 'linux', architecture: ['amd64', 'arm64', 'unknown'][i] } })) });
const oldIndex = index.replace('"schemaVersion":2', '"schemaVersion":2,"annotations":{"old":"true"}');
const sourceRevision = 'a'.repeat(40), previousRevision = 'b'.repeat(40);
const subject = { digest: hash(index), sourceRevision, tag: 'v1.2.3', releaseId: 12 };

function fixture({ same = false, fail = () => false, corrupt = false } = {}) {
  const latest = new Map(['docker.io', 'ghcr.io'].map(host => [`${host}/cloudbyday90/classifarr`, same ? subject.digest : hash(oldIndex)]));
  const calls = [], records = [];
  const command = (binary, args) => {
    const call = [binary, ...args].join(' ');
    calls.push(call);
    if (fail(call, calls)) throw new Error('secret should never escape');
    const ref = args.at(-1), repository = ref.split(/[@:]/)[0];
    if (args.includes('create')) { latest.set(args[4].replace(':latest', ''), subject.digest); return ''; }
    if (args.includes('{{json .Manifest}}')) return JSON.stringify({ digest: latest.get(repository) });
    if (args.includes('{{json .Image}}')) return JSON.stringify({ config: { Labels: { 'org.opencontainers.image.revision': previousRevision } } });
    if (args.includes('--raw')) {
      const digest = ref.split('@')[1];
      if (digest === hash(index)) return corrupt ? '{}' : index;
      if (digest === hash(oldIndex)) return oldIndex;
      const child = children.find(raw => hash(raw) === digest);
      if (!child) throw new Error('unexpected manifest');
      return child;
    }
    return '';
  };
  return { command, calls, records, record: value => records.push(structuredClone(value)), latest };
}

test('dry-run preflights both registries and all children without writing or pulling', () => {
  const f = fixture();
  expect(promoteReleaseImages({ subject, ...f }).status).toBe('dry_run_passed');
  expect(f.calls.filter(call => call.includes(' create ') || call.includes(' pull '))).toEqual([]);
  expect(f.calls.some(call => call.includes(`@${hash(children[2])}`))).toBe(true);
  expect(f.calls.filter(call => call.startsWith('git merge-base'))).toHaveLength(2);
});

test('writes exact indexes only after the pair passes and verifies both aliases with pulls', () => {
  const f = fixture();
  expect(promoteReleaseImages({ subject, ...f, write: true }).status).toBe('passed');
  expect(f.calls.filter(call => call.includes(' create '))).toEqual([
    `docker buildx imagetools create --tag docker.io/cloudbyday90/classifarr:latest docker.io/cloudbyday90/classifarr@${subject.digest}`,
    `docker buildx imagetools create --tag ghcr.io/cloudbyday90/classifarr:latest ghcr.io/cloudbyday90/classifarr@${subject.digest}`,
  ]);
  expect(f.calls.filter(call => call.includes(' pull '))).toHaveLength(2);
  expect(f.records.at(-1).registries.every(item => item.status === 'verified')).toBe(true);
});

test.each([
  'gh attestation verify', 'git merge-base', '{{json .Manifest}}', `@${hash(children[2])}`,
])('preflight failure %s prevents every mutation', failing => {
  const f = fixture({ fail: call => call.includes(failing) });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow('release_image_promotion_failed');
  expect(f.calls.some(call => call.includes(' create '))).toBe(false);
  expect(JSON.stringify(f.records)).not.toContain('secret');
});

test('rejects altered manifest bytes before writing', () => {
  const f = fixture({ corrupt: true });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow();
  expect(f.calls.some(call => call.includes(' create '))).toBe(false);
});

test('partial promotion remains visible and does not roll back the successful registry', () => {
  const f = fixture({ fail: call => call.includes('create --tag ghcr.io') });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow('release_image_promotion_failed');
  expect(f.records.at(-1).status).toBe('failed');
  expect(f.records.at(-1).registries.map(item => item.status)).toEqual(['verified', 'write_started']);
  expect(f.records.at(-1).phase).toBe('alias_write');
  expect(f.records.at(-1).activeRepository).toBe('ghcr.io/cloudbyday90/classifarr');
  expect(f.calls.filter(call => call.includes(' create '))).toHaveLength(2);
});

test('a failed second-registry preflight withholds the first-registry write too', () => {
  const f = fixture({ fail: call => call.includes('ghcr.io/') });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow();
  expect(f.records.at(-1).registries).toHaveLength(1);
  expect(f.calls.some(call => call.includes(' create '))).toBe(false);
});

test('retry after partial failure writes only the outstanding registry', () => {
  let unavailable = true;
  const f = fixture({ fail: call => unavailable && call.includes('create --tag ghcr.io') });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow();
  unavailable = false; f.calls.length = 0;
  expect(promoteReleaseImages({ subject, ...f, write: true }).status).toBe('passed');
  expect(f.calls.filter(call => call.includes(' create '))).toEqual([
    `docker buildx imagetools create --tag ghcr.io/cloudbyday90/classifarr:latest ghcr.io/cloudbyday90/classifarr@${subject.digest}`,
  ]);
});

test('post-write pull failure is not reported as success or rolled back', () => {
  const f = fixture({ fail: call => call.startsWith('docker pull') });
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow();
  expect(f.records.at(-1).registries.map(item => item.status)).toEqual(['write_started', 'preflight_passed']);
  expect(f.records.at(-1).phase).toBe('native_pull');
  expect(f.calls.filter(call => call.includes(' create '))).toHaveLength(1);
});

test('retry with already promoted aliases verifies without rewriting', () => {
  const f = fixture({ same: true });
  expect(promoteReleaseImages({ subject, ...f, write: true }).status).toBe('passed');
  expect(f.calls.some(call => call.includes(' create '))).toBe(false);
  expect(f.calls.filter(call => call.includes(' pull '))).toHaveLength(2);
});

test('alias changed between preflight and write aborts without overwriting it', () => {
  const f = fixture();
  const original = f.command;
  let reads = 0;
  f.command = (binary, args) => {
    if (args.includes('{{json .Manifest}}') && ++reads === 3) return JSON.stringify({ digest: `sha256:${'9'.repeat(64)}` });
    return original(binary, args);
  };
  expect(() => promoteReleaseImages({ subject, ...f, write: true })).toThrow();
  expect(f.calls.some(call => call.includes(' create '))).toBe(false);
});

test('missing/duplicate architecture, nested graph and too many children are rejected', () => {
  for (const mutate of [value => value.manifests.pop() && value.manifests.pop(),
    value => { value.manifests[1].platform.architecture = 'amd64'; },
    value => { value.manifests[0].mediaType = 'application/vnd.oci.image.index.v1+json'; },
    value => { value.manifests = Array(17).fill(value.manifests[0]); }]) {
    const value = JSON.parse(index); mutate(value); const raw = JSON.stringify(value);
    expect(() => verifyPromotionGraph(() => raw, `ghcr.io/cloudbyday90/classifarr@${hash(raw)}`)).toThrow();
  }
});

test.each([{ status: 1, stdout: 'secret' }, { status: 0, stdout: '', error: new Error('secret') }, null])('command rejects failed/truncated/timed-out results without leaking output', result => {
  expect(() => createPromotionCommand(() => result)('gh', ['api'])).toThrow('release_promotion_command_failed');
});

test('command has explicit timeout, output cap and no shell', () => {
  let received;
  createPromotionCommand((...args) => { received = args; return { status: 0, stdout: '{}' }; })('docker', ['version']);
  expect(received[2]).toEqual({ encoding: 'utf8', shell: false, windowsHide: true, timeout: 120000, maxBuffer: 4194304 });
});
