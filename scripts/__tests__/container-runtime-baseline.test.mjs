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

test('all application stages and the provider fixture share a digest-pinned base', () => {
  assert.equal(arg('NODE_VERSION'), nodeVersion);
  assert.match(arg('ALPINE_RELEASE'), /^\d+\.\d+\.\d+$/);
  assert.equal(arg('ALPINE_RELEASE').split('.').slice(0, 2).join('.'), arg('ALPINE_VERSION'));
  assert.match(arg('NODE_IMAGE_DIGEST'), /^sha256:[a-f0-9]{64}$/);
  assert.ok(dockerfile.includes('FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION}@${NODE_IMAGE_DIGEST} AS node-runtime-base'));
  assert.deepEqual([...dockerfile.matchAll(/^FROM node-runtime-base AS (\S+)$/gm)].map(match => match[1]),
    ['frontend-builder', 'backend-builder', 'production']);
  const reference = `node:${nodeVersion}-alpine${arg('ALPINE_VERSION')}@${arg('NODE_IMAGE_DIGEST')}`;
  assert.equal(read('docker/ai-provider-fault-stub.Dockerfile').match(/^FROM (\S+)$/m)?.[1], reference);
});

test('the image rejects version overrides that disagree with its pinned base', () => {
  const baseStage = dockerfile.split('# Stage 1:')[0].split(' AS node-runtime-base')[1];
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
