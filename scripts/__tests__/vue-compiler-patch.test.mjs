/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { npmFixture, packFixture, loopback, repository } from './helpers/npmFixture.mjs';

const hash = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('client compiler patch is exact, attributable, hashed and available before Docker installation', async () => {
  const manifest = await json(resolve(repository, 'client/package.json'));
  const lock = await json(resolve(repository, 'client/package-lock.json'));
  const path = 'patches/@vue/language-core@3.3.14.patch';
  assert.deepEqual(manifest.patchedDependencies, { '@vue/language-core@3.3.14': path });
  assert.equal(manifest.devDependencies['vue-tsc'], '3.3.14');
  assert.equal(manifest.devDependencies.typescript, '6.0.3');
  assert.equal(lock.lockfileVersion, 4);
  const patch = await readFile(resolve(repository, 'client', path), 'utf8');
  assert.deepEqual(lock.packages['node_modules/@vue/language-core'].patched, { integrity: hash(patch), path });
  assert.deepEqual([...patch.matchAll(/^\+\+\+ b\/([^\t\r\n]+)/gm)].map(match => match[1]).sort(),
    ['lib/codegen/template/element.js', 'lib/codegen/template/vSlot.js', 'lib/codegen/utils/flattenProps.js']);
  assert.match(patch, /Upstream package MIT license applies/);
  const docker = await readFile(resolve(repository, 'Dockerfile'), 'utf8');
  assert.ok(docker.indexOf('COPY client/patches/ ./patches/') < docker.indexOf('RUN npm ci'));
});

test('real npm native patches reinstall automatically and refuse missing, changed, unused and inapplicable patches', async () => {
  const fixture = await npmFixture();
  let registry;
  try {
    const pkg = await packFixture(fixture, { name: 'classifarr-compiler-patch-control' });
    registry = await loopback((request, response) => {
      if (request.url === '/fixture.tgz') { response.end(pkg.bytes); return; }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ name: pkg.name, 'dist-tags': { latest: pkg.version }, versions: {
        [pkg.version]: { name: pkg.name, version: pkg.version,
          dist: { tarball: registry.origin + '/fixture.tgz', integrity: hash(pkg.bytes) } },
      } }));
    });
    const online = args => fixture.npm([...args, `--registry=${registry.origin}`], { online: true });
    await online(['install', `${pkg.name}@${pkg.version}`, '--ignore-scripts']);
    const edit = resolve(fixture.directory, 'compiler-edit');
    await online(['patch', 'add', `${pkg.name}@${pkg.version}`, `--edit-dir=${edit}`]);
    const original = await readFile(resolve(edit, 'bin.mjs'), 'utf8');
    const changed = original + '// owned patch control\n';
    await writeFile(resolve(edit, 'bin.mjs'), changed);
    await online(['patch', 'commit', edit]);
    const manifestPath = resolve(fixture.directory, 'package.json'), lockPath = resolve(fixture.directory, 'package-lock.json');
    const manifest = await json(manifestPath), lock = await json(lockPath);
    const ci = () => fixture.npm(['ci', '--ignore-scripts', `--registry=${registry.origin}`]);
    const path = manifest.patchedDependencies[`${pkg.name}@${pkg.version}`];
    const patchPath = resolve(fixture.directory, path), patch = await readFile(patchPath, 'utf8');
    assert.equal(lock.lockfileVersion, 4);
    assert.equal(lock.packages[`node_modules/${pkg.name}`].patched.integrity, hash(patch));
    for (let i = 0; i < 2; i++) {
      await ci();
      assert.equal(await readFile(resolve(fixture.directory, 'node_modules', pkg.name, 'bin.mjs'), 'utf8'), changed);
    }
    for (const kind of ['missing', 'changed', 'unused', 'inapplicable']) {
      await writeFile(manifestPath, JSON.stringify(manifest)); await writeFile(lockPath, JSON.stringify(lock)); await writeFile(patchPath, patch);
      if (kind === 'missing') await rm(patchPath);
      if (kind === 'changed') await writeFile(patchPath, patch + '\n');
      if (kind === 'unused') await writeFile(manifestPath, JSON.stringify({ ...manifest,
        patchedDependencies: { [`${pkg.name}@9.9.9`]: path } }));
      if (kind === 'inapplicable') {
        const broken = patch.replace(/^ #![^\r\n]*$/m, ' nonexistent original context');
        assert.notEqual(broken, patch);
        await writeFile(patchPath, broken);
        const updated = structuredClone(lock);
        updated.packages[`node_modules/${pkg.name}`].patched.integrity = hash(broken);
        await writeFile(lockPath, JSON.stringify(updated));
      }
      await assert.rejects(ci(), error => {
        const expected = kind === 'missing' ? /EPATCHNOTFOUND/ : kind === 'unused' ? /EPATCHUNUSED/
          : kind === 'inapplicable' ? /EPATCHFAILED/ : /Invalid: patch.*does not match/;
        assert.match(error.stderr, expected, kind);
        return error.code !== 0;
      });
    }
    for (const flag of ['--ignore-patch-failures', '--allow-unused-patches']) {
      await assert.rejects(fixture.npm(['ci', flag]), error => /ECIPATCHFLAG/.test(error.stderr));
    }
  } finally { await registry?.close(); await fixture.close(); }
});
