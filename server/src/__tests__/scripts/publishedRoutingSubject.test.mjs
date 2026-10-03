/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { resolvePublishedRoutingSubject, verifiedManifest } from '../../../../scripts/lib/publishedRoutingSubject.mjs';
import { SOURCE } from '../helpers/publishedRoutingFixture.mjs';

const hash = text => `sha256:${createHash('sha256').update(text).digest('hex')}`;
function fixture({ platform = 'linux/amd64', store = 'classic', changeIndex = () => {}, changeLocal = () => {}, failAt = -1 } = {}) {
  const configDigest = `sha256:${'e'.repeat(64)}`;
  const manifest = JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: { digest: configDigest } });
  const child = hash(manifest);
  const index = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [
    { digest: child, mediaType: 'application/vnd.oci.image.manifest.v1+json', platform: { os: 'linux', architecture: platform.split('/')[1] } },
  ] };
  changeIndex(index);
  const rawIndex = JSON.stringify(index);
  const repository = 'ghcr.io/cloudbyday90/classifarr', image = `${repository}@${hash(rawIndex)}`;
  const local = { Id: store === 'classic' ? configDigest : child, Descriptor: { digest: child },
    Os: 'linux', Architecture: platform.split('/')[1], RepoDigests: [`${repository}@${child}`],
    Config: { Labels: { 'org.opencontainers.image.revision': SOURCE } } };
  changeLocal(local);
  const outputs = [platform, '', `${rawIndex}\n`, manifest, '', JSON.stringify(local)];
  const run = jest.fn((_binary, _args, options) => {
    expect(options.shell).toBe(false);
    expect(options.maxBuffer).toBe(4 * 1024 * 1024);
    expect(options.timeout).toBeGreaterThan(0);
    const call = run.mock.calls.length - 1;
    return { status: call === failAt ? 1 : 0, stdout: outputs[call], stderr: 'PRIVATE' };
  });
  return { input: { image, sourceRevision: SOURCE, platform, run }, child, configDigest, repository, run };
}

describe('published routing subject', () => {
  test.each(['linux/amd64', 'linux/arm64'])('verifies signed index through native child on %s', platform => {
    const { input, child, configDigest, run, repository } = fixture({ platform });
    const result = resolvePublishedRoutingSubject(input);
    expect(result).toMatchObject({ image: input.image, manifestDigest: child, configDigest, imageId: configDigest, platform });
    expect(run.mock.calls[1][1]).toEqual(['attestation', 'verify', `oci://${input.image}`, '--repo', 'cloudbyday90/Classifarr',
      '--signer-workflow', 'cloudbyday90/Classifarr/.github/workflows/ci.yml', '--source-digest', SOURCE, '--deny-self-hosted-runners']);
    expect(run.mock.calls[4][1]).toEqual(['pull', '--platform', platform, `${repository}@${child}`]);
    expect(run.mock.calls.map(call => call[1].join(' ')).join(' ')).not.toMatch(/latest|build --|image rm/);
  });
  test('supports containerd manifest IDs without accepting the parent index as a child', () => {
    const { input, child } = fixture({ store: 'containerd' });
    expect(resolvePublishedRoutingSubject(input).imageId).toBe(child);
  });
  test('refuses emulated or wrong-host architecture before verifying or pulling', () => {
    const { input, run } = fixture();
    run.mockReturnValueOnce({ status: 0, stdout: 'linux/arm64' });
    expect(() => resolvePublishedRoutingSubject(input)).toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });
  test.each([0, 1, 2, 3, 4, 5])('fails closed at command %s', failAt => {
    const { input, run } = fixture({ failAt });
    expect(() => resolvePublishedRoutingSubject(input)).toThrow('published_routing_subject_command_failed');
    expect(run).toHaveBeenCalledTimes(failAt + 1);
  });
  test.each([
    value => { value.Id = `sha256:${'f'.repeat(64)}`; },
    value => { value.Architecture = 'arm64'; },
    value => { value.RepoDigests = []; },
    value => { value.Config.Labels['org.opencontainers.image.revision'] = '0'.repeat(40); },
  ])('rejects unrelated local image evidence', changeLocal => {
    expect(() => resolvePublishedRoutingSubject(fixture({ changeLocal }).input)).toThrow();
  });
  test.each([
    value => { value.manifests = []; },
    value => { value.manifests.push(value.manifests[0]); },
    value => { value.manifests[0].digest = 'latest'; },
    value => { value.mediaType = 'text/plain'; },
  ])('rejects ambiguous or unsupported index', changeIndex => {
    const { input, run } = fixture({ changeIndex });
    expect(() => resolvePublishedRoutingSubject(input)).toThrow();
    expect(run.mock.calls.some(call => call[1][0] === 'pull')).toBe(false);
  });
  test('rejects wrong bytes instead of reserializing untrusted JSON', () => {
    const raw = '{"schemaVersion":2}';
    expect(verifiedManifest(raw + '\n', hash(raw))).toEqual({ schemaVersion: 2 });
    expect(() => verifiedManifest(raw + ' ', hash(raw))).toThrow();
    expect(() => verifiedManifest(raw, hash(raw + ' '))).toThrow();
  });
  test('rejects tags, arbitrary registries and unsupported platforms before commands', () => {
    for (const overrides of [{ image: 'ghcr.io/cloudbyday90/classifarr:latest' },
      { image: `evil.invalid/classifarr@sha256:${'a'.repeat(64)}` },
      { image: `docker.io/cloudbyday90/classifarr@sha256:${'a'.repeat(64)}` }, { platform: 'linux/386' }]) {
      const { input, run } = fixture();
      expect(() => resolvePublishedRoutingSubject({ ...input, ...overrides })).toThrow();
      expect(run).not.toHaveBeenCalled();
    }
  });
});
