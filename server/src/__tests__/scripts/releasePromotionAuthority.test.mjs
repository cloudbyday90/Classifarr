/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertPromotionEvidence, loadPromotionAuthority } from '../../../../scripts/lib/releasePromotionAuthority.mjs';
import { runPromotion } from '../../../../scripts/promote-release-images.mjs';
import { SOURCE, DIGEST, WORKFLOW, ENV } from '../helpers/publishedRoutingFixture.mjs';
import { TAG, promotionEvidence } from '../helpers/releasePromotionFixture.mjs';

function fixture({ mutateRelease = () => {}, mutateEvidence = () => {}, fail = () => false } = {}) {
  const evidence = promotionEvidence(); mutateEvidence(evidence);
  const raw = JSON.stringify(evidence);
  const release = { tag_name: TAG, draft: false, immutable: true, id: 1,
    assets: [{ id: 2, size: Buffer.byteLength(raw), name: `${TAG}-evidence.json` }] };
  mutateRelease(release);
  const calls = [], files = [];
  const command = (binary, args) => {
    calls.push([binary, ...args].join(' '));
    if (fail(args)) throw new Error('secret upstream output');
    if (args[0] === 'api') return args[1].includes('/assets/') ? raw : JSON.stringify(release);
    if (args[0] === 'attestation') { files.push(args[2]); expect(readFileSync(args[2], 'utf8')).toBe(raw); }
    return '';
  };
  return { command, calls, files, evidence };
}

test('binds release, asset integrity, workflow provenance and trusted caller identity', () => {
  const f = fixture();
  expect(loadPromotionAuthority({ tag: TAG, sourceRevision: SOURCE, digest: DIGEST, workflow: WORKFLOW, ...f }))
    .toEqual({ tag: TAG, sourceRevision: SOURCE, digest: DIGEST, releaseId: 1 });
  expect(f.calls.some(call => call.includes(`release verify-asset ${TAG}`))).toBe(true);
  expect(f.calls.at(-1)).toContain(`--source-digest ${SOURCE} --source-ref refs/tags/${TAG}`);
  expect(f.calls.at(-1)).toContain('--predicate-type https://slsa.dev/provenance/v1 --deny-self-hosted-runners');
  expect(f.files.every(file => !existsSync(file))).toBe(true);
});

test.each([
  value => { value.draft = true; }, value => { value.immutable = false; }, value => { value.tag_name = 'v1.0.0'; },
  value => { value.assets = []; }, value => { value.assets.push(value.assets[0]); },
  value => { value.assets[0].size = 4194305; }, value => { value.assets[0].size = 1; },
  value => { value.assets[0].id = '../malicious'; },
])('untrusted release metadata cannot authorize a promotion', mutateRelease => {
  const f = fixture({ mutateRelease });
  expect(() => loadPromotionAuthority({ tag: TAG, ...f })).toThrow();
  expect(f.calls.every(call => call.startsWith('gh '))).toBe(true);
});

test.each([
  value => { value.schema_version = 'classifarr.release.candidate-evidence.v2'; },
  value => { value.published_routing.pop(); },
  value => { value.published_routing[1] = value.published_routing[0]; },
  value => { value.evidence_fingerprint.value = `sha256:${'f'.repeat(64)}`; },
  value => { value.source_repository = 'untrusted/repo'; },
])('incomplete or forged current evidence is refused', mutateEvidence => {
  const f = fixture({ mutateEvidence });
  expect(() => loadPromotionAuthority({ tag: TAG, ...f })).toThrow();
});

test.each([{ sourceRevision: 'b'.repeat(40) }, { digest: `sha256:${'b'.repeat(64)}` },
  { workflow: { ...WORKFLOW, runId: '456' } }, { workflow: { ...WORKFLOW, runAttempt: '3' } }, { tag: 'v1.2.3' }])(
  'receipt cannot choose its own expected source/digest/run/attempt/tag', expected => {
    expect(() => assertPromotionEvidence(promotionEvidence(), { tag: TAG, ...expected })).toThrow();
  });

test.each(['verify-asset', 'attestation', 'verify'])('CLI verification failure %s prevents registry access', flag => {
  const f = fixture({ fail: args => args.includes(flag) });
  const records = [];
  expect(() => runPromotion({ args: ['--write'], env: { SOURCE_TAG: TAG }, command: f.command,
    record: value => records.push(value) })).toThrow('release_promotion_failed');
  expect(f.calls.every(call => call.startsWith('gh '))).toBe(true);
  expect(records.at(-1).status).toBe('authority_check_failed');
  expect(JSON.stringify(records)).not.toContain('secret');
});

test('automatic invocation requires same-attempt evidence from trusted workflow context', () => {
  const f = fixture();
  expect(() => runPromotion({ args: ['--write'], env: { ...ENV, GITHUB_EVENT_NAME: 'push', SOURCE_TAG: TAG,
    GITHUB_REF: `refs/tags/${TAG}`, SOURCE_REVISION: SOURCE, IMAGE_DIGEST: DIGEST, GITHUB_RUN_ATTEMPT: '3' },
  command: f.command, record: () => {} })).toThrow('release_promotion_failed');
  expect(f.calls.every(call => call.startsWith('gh '))).toBe(true);
});

test('invalid real CLI invocation exits nonzero before any command', () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, '../../../../scripts/promote-release-images.mjs'), '--force'],
    { encoding: 'utf8', timeout: 10000 });
  expect(result.status).toBe(1);
});

test('manual Actions dispatch on main is rejected before accessing release or registry', () => {
  const f = fixture();
  expect(() => runPromotion({ args: ['--write'], env: { ...ENV, GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main', SOURCE_TAG: TAG }, command: f.command, record: () => {} })).toThrow();
  expect(f.calls).toEqual([]);
});
