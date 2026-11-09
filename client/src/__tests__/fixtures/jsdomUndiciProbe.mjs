/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { setTimeout, clearTimeout } from 'node:timers';
import process from 'node:process';
const require = createRequire(import.meta.url), mode = process.argv[2];
assert.ok(['node-first', 'jsdom-first'].includes(mode));
const windows = [], servers = [], sockets = new Set();
const bounded = promise => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('consumer_probe_deadline')), 2000);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
});
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function listen(handler) {
  const server = createServer(handler); servers.push(server);
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
let origin, foreign, JSDOM, CookieJar, VirtualConsole;
const held = gate(), aborted = gate(), resource = gate(), resourceClosed = gate();
const seen = [];
try {
  foreign = await listen((req, res) => {
    seen.push({ url: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie });
    const allowed = req.url === '/redirect-target';
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowed ? origin : 'https://unrelated.invalid',
      'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,x-ordinary' });
    res.end(JSON.stringify({ authorization: req.headers.authorization ?? null, cookie: req.headers.cookie ?? null }));
  });
  origin = await listen((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/document' }).end(); }
    else if (req.url === '/document') res.writeHead(200, { 'content-type': 'text/html' }).end('<title>Retained JSDOM</title>');
    else if (req.url === '/same') res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      authorization: req.headers.authorization, cookie: req.headers.cookie, ordinary: req.headers['x-ordinary'] }));
    else if (req.url === '/cross') res.writeHead(302, { location: foreign + '/redirect-target' }).end();
    else if (req.url === '/hold') { res.once('close', aborted.resolve); held.resolve(); }
    else if (req.url === '/slow.js') { res.once('close', resourceClosed.resolve); resource.resolve(); }
    else res.writeHead(404).end('missing');
  });
  const native = async () => { const response = await globalThis.fetch(origin + '/document', { signal: globalThis.AbortSignal.timeout(1000) }); assert.match(await response.text(), /Retained JSDOM/); };
  if (mode === 'node-first') await native();
  ({ JSDOM, CookieJar, VirtualConsole } = require('jsdom'));
  const fetched = await JSDOM.fromURL(origin + '/redirect'); windows.push(fetched.window);
  assert.equal(fetched.window.document.title, 'Retained JSDOM');
  assert.equal(fetched.window.location.href, origin + '/document');
  await assert.rejects(JSDOM.fromURL(origin + '/missing'), /404/);
  if (mode === 'jsdom-first') await native();
  const jar = new CookieJar(); jar.setCookieSync('session=synthetic; Path=/', origin);
  const console = new VirtualConsole();
  const dom = new JSDOM('', { url: origin, cookieJar: jar, virtualConsole: console }); windows.push(dom.window);
  const xhr = (url, { credentials = false, auth = true } = {}) => bounded(new Promise(resolve => {
    const request = new dom.window.XMLHttpRequest(); request.open('GET', url);
    request.withCredentials = credentials; request.timeout = 1500;
    if (auth) request.setRequestHeader('Authorization', 'synthetic-auth');
    request.setRequestHeader('X-Ordinary', 'preserved');
    request.onload = () => resolve({ kind: 'load', status: request.status, body: request.responseText });
    request.onerror = () => resolve({ kind: 'error', status: request.status, body: request.responseText });
    request.ontimeout = () => resolve({ kind: 'timeout' }); request.send();
  }));
  const same = await xhr('/same', { credentials: true }); assert.equal(same.kind, 'load');
  assert.deepEqual(JSON.parse(same.body), { authorization: 'synthetic-auth', cookie: 'session=synthetic', ordinary: 'preserved' });
  const cross = await xhr('/cross'); assert.equal(cross.kind, 'load');
  assert.deepEqual(JSON.parse(cross.body), { authorization: null, cookie: null });
  const refused = await xhr(foreign + '/deny', { credentials: true });
  assert.deepEqual(refused, { kind: 'error', status: 0, body: '' });
  assert.ok(!seen.some(row => row.url === '/deny' && row.authorization));
  const request = new dom.window.XMLHttpRequest(); request.open('GET', '/hold');
  const abortEvent = new Promise(resolve => { request.onabort = resolve; }); request.send();
  await bounded(held.promise); request.abort(); await bounded(abortEvent); await bounded(aborted.promise);
  assert.equal(request.status, 0);
  const loading = new JSDOM(`<script src="${origin}/slow.js"></script>`, {
    url: origin, resources: {}, runScripts: 'dangerously', virtualConsole: console,
  }); windows.push(loading.window);
  await bounded(resource.promise); loading.window.close(); await bounded(resourceClosed.promise);
  assert.equal((await xhr('/same', { credentials: true })).kind, 'load');
  process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n');
} finally {
  for (const window of windows) window.close();
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
}
