/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Actual independently installed dependencies, not mocked redirect implementations.
const trees = [
  ['root', new URL('../../', import.meta.url)],
  ['client', new URL('../../client/', import.meta.url)],
];
const headers = () => ({ aUtHoRiZaTiOn: 'synthetic-auth', cOoKiE: 'synthetic-cookie',
  'pRoXy-AuThOrIzAtIoN': 'synthetic-proxy', 'X^Token': 'synthetic-caret',
  'X|Token': 'synthetic-pipe', 'X+Token': 'synthetic-plus', 'X-Ordinary': 'keep' });
const customNames = ['x^token', 'x|token', 'x+token'];
const confidential = ['authorization', 'cookie', 'proxy-authorization', ...customNames];

test('dependency CI installs both tested trees before invoking the regression suite', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/copyright-compliance.yml', import.meta.url), 'utf8');
  const rootInstall = workflow.indexOf('run: npm ci');
  const clientInstall = workflow.indexOf('run: npm --prefix client ci');
  const suite = workflow.indexOf('run: npm run test:tooling:dependencies');
  assert.ok(rootInstall >= 0 && clientInstall > rootInstall && suite > clientInstall);
  assert.match(workflow, /client\/package-lock\.json/);
});

async function fixture(operation) {
  const servers = [], sources = [], targets = [];
  const listen = async handler => {
    const server = createServer(handler);
    servers.push(server);
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  };
  try {
    const target = await listen((req, res) => { targets.push(req.headers); res.end('ok'); });
    const source = await listen((req, res) => {
      if (req.url === '/target') { targets.push(req.headers); res.end('ok'); return; }
      sources.push(req.headers);
      res.writeHead(302, { location: req.url === '/same' ? '/target' : `${target}/target` }); res.end();
    });
    await operation({ source, sources, targets });
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => {
      server.closeAllConnections(); server.close(resolve);
    })));
  }
}

function request(lib, url, options = {}) {
  return new Promise((resolve, reject) => {
    let req;
    const timer = setTimeout(() => {
      req?.destroy(); reject(new Error('redirect_test_timeout'));
    }, 3000);
    const done = (error, response) => {
      clearTimeout(timer);
      if (error) reject(error); else resolve(response);
    };
    try {
      req = lib.http.get(url, { maxRedirects: 2, ...options }, res => {
        res.on('error', done); res.resume();
        res.on('end', () => done(null, res));
      });
      req.on('error', done);
    } catch (error) { done(error); }
  });
}

function assertInitialAndOrdinary(sources, targets) {
  assert.equal(sources.length, 1); assert.equal(targets.length, 1);
  for (const name of confidential) assert.equal(typeof sources[0][name], 'string');
  assert.equal(targets[0]['x-ordinary'], 'keep');
}

for (const [name, base] of trees) {
  const lib = (await import(new URL('node_modules/follow-redirects/index.js', base))).default;
  const axios = (await import(new URL('node_modules/axios/index.js', base))).default;

  test(`${name}: exact patched lock, manifest override and installed package agree`, async () => {
    const json = async path => JSON.parse(await readFile(new URL(path, base), 'utf8'));
    assert.equal((await json('package.json')).overrides['follow-redirects'], '1.16.1');
    assert.equal((await json('package-lock.json')).packages['node_modules/follow-redirects'].version, '1.16.1');
    assert.equal((await json('node_modules/follow-redirects/package.json')).version, '1.16.1');
  });

  for (const kind of ['object', 'array']) {
    test(`${name}: ${kind} strips built-in and regex-token custom secrets across origins`, async () => {
      await fixture(async ({ source, sources, targets }) => {
        const input = headers();
        const raw = kind === 'array' ? ['Host', new URL(source).host, ...Object.entries(input).flat()] : input;
        const response = await request(lib, `${source}/cross`, { headers: raw, sensitiveHeaders: customNames });
        assert.equal(response.statusCode, 200);
        assertInitialAndOrdinary(sources, targets);
        for (const key of confidential) assert.equal(targets[0][key], undefined, key);
      });
    });

    test(`${name}: ${kind} preserves same-origin headers and a normal response`, async () => {
      await fixture(async ({ source, sources, targets }) => {
        const input = headers();
        const raw = kind === 'array' ? ['Host', new URL(source).host, ...Object.entries(input).flat()] : input;
        assert.equal((await request(lib, `${source}/same`, { headers: raw, sensitiveHeaders: customNames })).statusCode, 200);
        assertInitialAndOrdinary(sources, targets);
        for (const [key, value] of Object.entries(headers())) assert.equal(targets[0][key.toLowerCase()], value);
      });
    });
  }

  test(`${name}: redirect limits still reject a redirect before reaching the destination`, async () => {
    await fixture(async ({ source, sources, targets }) => {
      await assert.rejects(request(lib, `${source}/cross`, { maxRedirects: 0 }), { code: 'ERR_FR_TOO_MANY_REDIRECTS' });
      assert.equal(sources.length, 1); assert.equal(targets.length, 0);
    });
  });

  test(`${name}: actual Axios Node adapter retains its own credential boundary and GET behavior`, async () => {
    await fixture(async ({ source, sources, targets }) => {
      const response = await axios.get(`${source}/cross`, { adapter: 'http', proxy: false,
        timeout: 3000, maxRedirects: 2, headers: headers() });
      assert.equal(response.status, 200); assert.equal(response.data, 'ok');
      assertInitialAndOrdinary(sources, targets);
      for (const key of confidential.slice(0, 3)) assert.equal(targets[0][key], undefined);
      // No custom sensitiveHeaders option was supplied to Axios. Do not pretend
      // the direct-library reproduction demonstrates an application Axios leak.
      for (const key of customNames) assert.equal(targets[0][key], sources[0][key]);
    });
  });
}
