/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));
const npmVersion = '12.2.0';

for (const workspace of ['', 'client/', 'server/']) {
  test(`${workspace || 'root'} keeps package-manager and lockfile requirements aligned`, () => {
    const manifest = json(`${workspace}package.json`);
    assert.equal(manifest.packageManager, `npm@${npmVersion}`);
    assert.equal(manifest.engines.npm, `>=${npmVersion} <13`);
    assert.deepEqual(json(`${workspace}package-lock.json`).packages[''].engines, manifest.engines);
    assert.match(read(`${workspace}.npmrc`), /^strict-allow-scripts=true$/m);
    assert.doesNotMatch(read(`${workspace}.npmrc`), /ignore-scripts|dangerously-allow-all-scripts/);
  });

  test(`${workspace || 'root'} records every locked installer and only allows bcrypt`, () => {
    const { allowScripts = {} } = json(`${workspace}package.json`);
    const packages = json(`${workspace}package-lock.json`).packages;
    const installerKeys = Object.entries(packages)
      .filter(([, metadata]) => metadata.hasInstallScript)
      .map(([location, metadata]) => `${metadata.name ?? location.split('node_modules/').at(-1)}@${metadata.version}`);
    assert.deepEqual(Object.keys(allowScripts).sort(), installerKeys.sort());
    for (const [identity, allowed] of Object.entries(allowScripts)) {
      assert.equal(allowed, workspace === 'server/' && identity === 'bcrypt@6.0.0', identity);
    }
  });
}

test('Playwright uses one exact reviewed version across its manifest and locked package chain', () => {
  const manifest = json('client/package.json');
  const { packages } = json('client/package-lock.json');
  const version = manifest.devDependencies['@playwright/test'];
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(packages[''].devDependencies['@playwright/test'], version);
  for (const name of ['@playwright/test', 'playwright', 'playwright-core']) {
    const entry = packages[`node_modules/${name}`];
    assert.equal(entry.version, version, name);
    assert.equal(entry.dev, true, `${name} must remain test-only`);
    assert.ok(!entry.hasInstallScript, `${name} must not install browsers implicitly`);
  }
  assert.equal(packages['node_modules/@playwright/test'].dependencies.playwright, version);
  assert.equal(packages['node_modules/playwright'].dependencies['playwright-core'], version);
});

test('Vue compiler dependencies retain exact reviewed manifest and lock versions', () => {
  const manifest = json('client/package.json');
  const { packages } = json('client/package-lock.json');
  for (const name of ['typescript', 'vue-tsc']) {
    const version = manifest.devDependencies[name];
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(packages[''].devDependencies[name], version);
    assert.equal(packages[`node_modules/${name}`].version, version);
  }
  // Version changes still require the real positive/negative Vue compiler suite.
});

test('Docker and CI use the same npm release and carry the install policy into builds', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, new RegExp(`^ARG NPM_VERSION=${npmVersion.replaceAll('.', '\\.')}$`, 'm'));
  for (const workspace of ['client', 'server']) {
    assert.ok(dockerfile.includes(`COPY ${workspace}/package*.json ${workspace}/.npmrc ./`));
  }
  for (const workflow of ['ci.yml', 'copyright-compliance.yml']) {
    const pins = [...read(`.github/workflows/${workflow}`).matchAll(/npm install --global npm@([^\s]+)/g)];
    assert.equal(pins.length, workflow === 'ci.yml' ? 3 : 1);
    assert.ok(pins.every(([, version]) => version === npmVersion));
  }
});

// Exercise npm itself, not a reimplementation of its authorization semantics.
// Local file dependencies and --offline avoid registry access; the fixture only
// writes a marker in its own temporary install directory.
for (const decision of ['unreviewed', 'denied', 'allowed']) {
  test(`npm strict policy: ${decision} installer`, () => {
    const npmCli = process.env.npm_execpath;
    assert.ok(npmCli && existsSync(npmCli), 'Run through npm run test:tooling:dependencies with npm 12.2.0.');
    const directory = mkdtempSync(resolve(tmpdir(), 'classifarr-npm-policy-'));
    try {
      const fixture = resolve(directory, 'fixture');
      mkdirSync(fixture);
      writeFileSync(resolve(fixture, 'package.json'), JSON.stringify({
        name: 'classifarr-installer-fixture', version: '1.0.0', type: 'module',
        scripts: { install: 'node install.mjs' },
      }));
      writeFileSync(resolve(fixture, 'install.mjs'),
        "import { writeFileSync } from 'node:fs'; writeFileSync(new URL('installed.txt', import.meta.url), 'ran');\n");
      writeFileSync(resolve(directory, 'package.json'), JSON.stringify({
        name: 'classifarr-policy-test', private: true, type: 'module',
        dependencies: { 'classifarr-installer-fixture': 'file:./fixture' },
        allowScripts: decision === 'unreviewed' ? {} : {
          'file:./fixture': decision === 'allowed',
        },
      }));
      writeFileSync(resolve(directory, '.npmrc'), 'strict-allow-scripts=true\ninstall-links=true\n');
      for (const config of ['user.npmrc', 'global.npmrc']) writeFileSync(resolve(directory, config), '');
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
        /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE)$/i.test(key)));
      Object.assign(env, {
        npm_config_userconfig: resolve(directory, 'user.npmrc'),
        npm_config_globalconfig: resolve(directory, 'global.npmrc'),
        npm_config_cache: resolve(directory, 'cache'),
        NODE_OPTIONS: '--trace-deprecation',
      });
      const npm = args => execFileSync(process.execPath,
        [npmCli, ...args, '--offline', '--no-audit', '--no-fund'],
        { cwd: directory, env, shell: false, windowsHide: true, encoding: 'utf8', timeout: 30_000, stdio: 'pipe' });
      npm(['install', '--package-lock-only', '--ignore-scripts']);
      if (decision === 'unreviewed') {
        assert.throws(() => npm(['ci']), error =>
          error.status !== 0 && /ESTRICTALLOWSCRIPTS/.test(String(error.stderr)));
      } else {
        npm(['ci']);
      }
      assert.equal(existsSync(resolve(directory, 'node_modules/classifarr-installer-fixture/installed.txt')),
        decision === 'allowed');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
