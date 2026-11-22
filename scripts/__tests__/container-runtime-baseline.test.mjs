/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const nodeVersion = read('.nvmrc').trim();
const dockerfile = read('Dockerfile');
const arg = name => {
  const match = dockerfile.match(new RegExp(`^ARG ${name}=(\\S+)$`, 'm'));
  assert.ok(match, `Missing concrete Docker build argument ${name}`);
  return match[1];
};

for (const workspace of ['', 'client/', 'server/']) {
  test(`${workspace || 'root'} Node engine and lockfile follow the exact LTS baseline`, () => {
    assert.match(nodeVersion, /^24\.\d+\.\d+$/);
    const manifest = JSON.parse(read(`${workspace}package.json`));
    const lock = JSON.parse(read(`${workspace}package-lock.json`));
    assert.equal(manifest.engines.node, `>=${nodeVersion} <25`);
    assert.deepEqual(lock.packages[''].engines, manifest.engines);
  });
  if (workspace) {
    test(`${workspace} Node declarations stay on the deployed runtime major`, () => {
      const major = nodeVersion.split('.')[0];
      const manifest = JSON.parse(read(`${workspace}package.json`));
      const lock = JSON.parse(read(`${workspace}package-lock.json`));
      const declared = manifest.devDependencies['@types/node'];
      assert.match(declared, new RegExp(`^\\^${major}\\.\\d+\\.\\d+$`));
      assert.equal(lock.packages[''].devDependencies['@types/node'], declared);
      assert.equal(lock.packages['node_modules/@types/node'].version.split('.')[0], major);
    });
  }
}

test('builders and provider fixtures use the digest-pinned Node image', () => {
  assert.equal(arg('NODE_VERSION'), nodeVersion);
  assert.match(arg('ALPINE_RELEASE'), /^\d+\.\d+\.\d+$/);
  assert.equal(arg('ALPINE_RELEASE').split('.').slice(0, 2).join('.'), arg('ALPINE_VERSION'));
  assert.match(arg('NODE_IMAGE_DIGEST'), /^sha256:[a-f0-9]{64}$/);
  assert.ok(dockerfile.includes('FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}@${NODE_IMAGE_DIGEST} AS node-build-base'));
  assert.deepEqual([...dockerfile.matchAll(/^FROM node-build-base AS (\S+)$/gm)].map(match => match[1]),
    ['frontend-builder', 'backend-builder']);
  const reference = `node:${nodeVersion}-alpine${arg('ALPINE_VERSION')}@${arg('NODE_IMAGE_DIGEST')}`;
  assert.equal(read('docker/ai-provider-fault-stub.Dockerfile').match(/^FROM (\S+)$/m)?.[1], reference);
  assert.equal(read('scripts/fixtures/systemZlib/Dockerfile').match(/^ARG BASE_IMAGE=(\S+)$/m)?.[1], reference);
  for (const source of [dockerfile, read('docker/ai-provider-fault-stub.Dockerfile')]) {
    assert.ok(source.includes('apk add --no-cache zlib=1.4-r0'));
    assert.ok(source.includes('apk info --exists zlib=1.4-r0'));
  }
});

test('production inherits Alpine and copies only the Node binary from the builder base', () => {
  assert.match(arg('ALPINE_IMAGE_DIGEST'), /^sha256:[a-f0-9]{64}$/);
  const productionStart = 'FROM alpine:${ALPINE_RELEASE}@${ALPINE_IMAGE_DIGEST} AS production\n';
  assert.ok(dockerfile.includes(productionStart));
  const production = dockerfile.split(productionStart)[1];
  assert.deepEqual(production.match(/^COPY --from=node-build-base .*$/gm),
    ['COPY --from=node-build-base /usr/local/bin/node /usr/local/bin/node']);
  assert.match(production,
    /^ADD --chmod=0644 --checksum=sha256:[a-f0-9]{64} \\\n +https:\/\/raw\.githubusercontent\.com\/nodejs\/node\/[a-f0-9]{40}\/LICENSE \/usr\/local\/LICENSE$/m);
  for (const check of [
    'apk add --no-cache libstdc++ libatomic zlib=1.4-r0',
    'node --version)" = "v${NODE_VERSION}"',
    'cat /etc/alpine-release)" = "${ALPINE_RELEASE}"',
    'apk info --exists ca-certificates-bundle zlib=1.4-r0',
    'test ! -e /usr/local/lib/node_modules',
    '! command -v npm && ! command -v npx',
  ]) assert.ok(production.includes(check), `Missing production check: ${check}`);
});

test('the builder rejects version overrides that disagree with its pinned base', () => {
  const baseStage = dockerfile.split('# Stage 1:')[0].split(' AS node-build-base')[1];
  for (const name of ['NODE_VERSION', 'ALPINE_RELEASE', 'NPM_VERSION']) {
    assert.ok(baseStage.includes(`ARG ${name}\n`), `Stage must import ${name}`);
  }
  for (const check of [
    'test "$(node --version)" = "v${NODE_VERSION}"',
    'test "$(cat /etc/alpine-release)" = "${ALPINE_RELEASE}"',
    'test "$(npm --version)" = "${NPM_VERSION}"',
    'test "$(npx --version)" = "${NPM_VERSION}"',
  ]) assert.ok(baseStage.includes(check), `Missing version assertion: ${check}`);
});

test('build and tooling CI select Node from the version file', () => {
  for (const workflow of ['ci.yml', 'copyright-compliance.yml']) {
    const text = read(`.github/workflows/${workflow}`);
    const setups = text.split(/uses: actions\/setup-node@/).slice(1);
    assert.ok(setups.length > 0);
    for (const setup of setups) {
      assert.match(setup.split(/\n\s+- name:/)[0], /node-version-file: ['"]?\.nvmrc/);
    }
  }
});
