/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { realpathSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { createLoopbackServer } from './discordTransportSupport.mjs';

const mode = process.argv[2];
let target = 'undici';
if (process.argv[3] !== undefined) {
  assert.ok(process.argv[3].length <= 4096);
  const url = new URL(process.argv[3]);
  assert.equal(url.protocol, 'file:'); assert.equal(url.search, ''); assert.equal(url.hash, '');
  const path = realpathSync(fileURLToPath(url));
  assert.ok(path.endsWith(`${sep}node_modules${sep}undici${sep}index.js`));
  assert.equal(JSON.parse(readFileSync(join(dirname(path), 'package.json'), 'utf8')).name, 'undici');
  target = url.href;
}
const { Agent, fetch, request, interceptors, cacheStores } = await import(target);
const agents = [], servers = [];
const server = async handler => { const value = await createLoopbackServer(handler); servers.push(value); return value; };
const agent = (...middleware) => {
  const base = new Agent(); agents.push(base); return middleware.length ? base.compose(...middleware) : base;
};
const cache = () => interceptors.cache({ store: new cacheStores.MemoryCacheStore({ maxCount: 32, maxSize: 65536, maxEntrySize: 8192 }) });
const read = async (url, dispatcher, headers) => {
  const response = await request(url, { dispatcher, headers, signal: AbortSignal.timeout(2000) });
  return { status: response.statusCode, body: await response.body.text() };
};
try {
  if (mode === 'integrity') {
    const payload = 'integrity-control';
    const source = await server((_req, res) => res.end(payload));
    const dispatcher = agent();
    for (const algorithm of ['sha256', 'sha384', 'sha512']) {
      const correct = `${algorithm}-${createHash(algorithm).update(payload).digest('base64')}`;
      const wrong = `${algorithm}-${createHash(algorithm).update('different').digest('base64')}`;
      for (const separator of ['', ' ', '\t', '\n', '\r', '\f', '\t\r\n ']) {
        const options = { dispatcher, signal: AbortSignal.timeout(2000) };
        assert.equal(await (await fetch(source.origin, { ...options, integrity: separator + correct + separator })).text(), payload);
        await assert.rejects(fetch(source.origin, { ...options, integrity: separator + wrong + separator }),
          error => error instanceof TypeError && error.cause?.message === 'integrity mismatch');
      }
    }
  } else if (mode === 'headers') {
    const seen = [];
    const destination = await server((req, res) => { seen.push(req.headers); res.end('target'); });
    const source = await server((req, res) => {
      if (req.url === '/same') { res.writeHead(302, { location: '/target' }); res.end(); }
      else if (req.url === '/cross') { res.writeHead(302, { location: destination.origin }); res.end(); }
      else if (req.url === '/loop') { res.writeHead(302, { location: '/loop' }); res.end(); }
      else { seen.push(req.headers); res.end('target'); }
    });
    // Exercise both compositions, including the normalizer outside redirect
    // described by GHSA-9v6h-8rgp-m69f.
    const redirect = () => interceptors.redirect({ maxRedirections: 3, throwOnMaxRedirect: true,
      stripHeadersOnCrossOriginRedirect: ['x-private'] });
    const entries = [['Host', 'synthetic.invalid'], ['Authorization', 'synthetic-auth'], ['Cookie', 'synthetic=cookie'],
      ['Proxy-Authorization', 'synthetic-proxy'], ['X-Private', 'synthetic-private'], ['X-Control', 'ordinary']];
    for (const dispatcher of [agent(redirect(), cache()), agent(cache(), redirect())]) {
      for (const headers of [Object.fromEntries(entries), entries.flat(), entries]) {
        assert.equal((await read(source.origin + '/same', dispatcher, headers)).body, 'target');
        const same = seen.at(-1);
        assert.equal(same.host, new URL(source.origin).host);
        assert.equal(same.authorization, 'synthetic-auth'); assert.equal(same.cookie, 'synthetic=cookie');
        assert.equal((await read(source.origin + '/cross', dispatcher, headers)).body, 'target');
        const cross = seen.at(-1);
        for (const name of ['authorization', 'cookie', 'proxy-authorization', 'x-private']) assert.equal(cross[name], undefined, name);
        assert.equal(cross['x-control'], 'ordinary'); assert.equal(cross.host, new URL(destination.origin).host);
      }
      await assert.rejects(read(source.origin + '/loop', dispatcher));
    }
  } else if (mode === 'hops') {
    const calls = new Map(); let source;
    const foreign = await server((_req, res) => { res.writeHead(302, { location: source.origin + '/final' }); res.end(); });
    source = await server((req, res) => {
      calls.set(req.url, (calls.get(req.url) ?? 0) + 1);
      if (req.url === '/bounce') res.writeHead(302, { location: foreign.origin, 'cache-control': 'public, max-age=60' });
      else if (req.url === '/no-store') res.writeHead(302, { location: '/final', 'cache-control': 'no-store' });
      else if (req.url === '/vary') res.writeHead(302, { location: '/final', vary: 'X-User', 'cache-control': 'public, max-age=60' });
      else if (req.url === '/ordinary') res.writeHead(302, { location: '/final', 'cache-control': 'public, max-age=60' });
      else { res.writeHead(200, { 'cache-control': 'public, max-age=60' }); res.end('final-' + (req.headers['x-user'] ?? 'public')); return; }
      res.end();
    });
    const dispatcher = agent(interceptors.redirect({ maxRedirections: 5 }), cache());
    for (const path of ['/bounce', '/no-store']) {
      await read(source.origin + path, dispatcher); await nextTurn(); await read(source.origin + path, dispatcher);
      assert.equal(calls.get(path), 2, path + ' must not be cached under the initial key');
    }
    assert.equal((await read(source.origin + '/vary', dispatcher, { 'x-user': 'first' })).body, 'final-first');
    await nextTurn();
    assert.equal((await read(source.origin + '/vary', dispatcher, { 'x-user': 'second' })).body, 'final-second');
    assert.equal(calls.get('/vary'), 2);
    await read(source.origin + '/ordinary', dispatcher); await nextTurn(); await read(source.origin + '/ordinary', dispatcher);
    assert.equal(calls.get('/ordinary'), 1, 'legitimate same-origin redirect remains cacheable');
  } else if (mode === 'credentials') {
    let calls = 0;
    const source = await server((req, res) => {
      calls++;
      if (req.url.startsWith('/me')) { res.writeHead(302, { location: '/profile', 'cache-control': 'public, max-age=60' }); res.end(); }
      else { res.writeHead(200, { 'cache-control': 'public, max-age=60' }); res.end(req.headers.authorization ?? req.headers.cookie ?? req.headers['proxy-authorization'] ?? 'anonymous'); }
    });
    const dispatcher = agent(interceptors.redirect({ maxRedirections: 3 }), cache());
    for (const [index, name] of ['Authorization', 'Cookie', 'Proxy-Authorization'].entries()) {
      const url = source.origin + '/me' + index;
      assert.equal((await read(url, dispatcher, { [name]: 'first-user' })).body, 'first-user'); await nextTurn();
      assert.equal((await read(url, dispatcher, { [name]: 'second-user' })).body, 'second-user'); await nextTurn();
      assert.equal((await read(url, dispatcher)).body, 'anonymous');
    }
    assert.equal(calls, 18, 'each credential-bearing alias and subsequent anonymous request reaches the origin');
  } else if (mode === 'revalidation') {
    let calls = 0;
    const foreign = await server((_req, res) => { res.writeHead(304, { 'cache-control': 'max-age=60', etag: '"synthetic"' }); res.end(); });
    const source = await server((req, res) => {
      calls++;
      if (req.headers['if-none-match']) { res.writeHead(302, { location: foreign.origin }); res.end(); }
      else { res.writeHead(200, { 'cache-control': 'max-age=0, must-revalidate', etag: '"synthetic"' }); res.end(req.headers.authorization ? 'private-initial-body' : 'public-refetch'); }
    });
    const dispatcher = agent(interceptors.redirect({ maxRedirections: 3 }), cache());
    assert.equal((await read(source.origin, dispatcher, { authorization: 'first-user' })).body, 'private-initial-body'); await nextTurn();
    const result = await read(source.origin, dispatcher, { 'cache-control': 'no-cache' });
    assert.equal(result.status, 200); assert.equal(result.body, 'public-refetch'); assert.equal(calls, 3);
  } else if (mode === 'replay') {
    let calls = 0;
    const source = await server((_req, res) => { calls++; res.writeHead(200, { 'cache-control': 'max-age=60' }); res.end('too-large-for-dump'); });
    const base = agent(), cached = base.compose(cache());
    assert.equal((await read(source.origin, cached)).body, 'too-large-for-dump'); await nextTurn();
    const bounded = cached.compose(interceptors.dump({ maxSize: 4 }));
    await assert.rejects(read(source.origin, bounded), { code: 'UND_ERR_ABORTED' });
    assert.equal(calls, 1, 'refusal came from cache replay');
    assert.equal((await read(source.origin, cached)).body, 'too-large-for-dump');
  } else throw new Error('unknown_probe_mode');
  process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n');
} finally {
  await Promise.all(agents.map(value => value.destroy()));
  await Promise.all(servers.map(value => value.close()));
}
