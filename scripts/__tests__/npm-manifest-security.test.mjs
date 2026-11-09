/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { npmContext, npmFixture, loopback } from './helpers/npmFixture.mjs';

test('bundled pacote verifies a real signature and rejects cached manifest identity substitutions', async () => {
  const fixture = await npmFixture(), { pacote } = npmContext();
  let registry;
  try {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const keyid = 'SHA256:' + createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
    const name = 'classifarr-signed-control', integrity = 'sha512-' + createHash('sha512').update('synthetic-tarball-not-downloaded').digest('base64');
    const make = (packageName = name, version = '1.0.0', id = `${packageName}@${version}`) => ({
      name: packageName, version, _id: id,
      dist: { tarball: registry.origin + '/must-not-fetch.tgz', integrity,
        signatures: [{ keyid, sig: sign('SHA256', Buffer.from(`${id}:${integrity}`), privateKey).toString('base64') }] },
    });
    let packument, requests = 0, tarballs = 0;
    registry = await loopback((req, res) => {
      requests++; if (req.url.includes('.tgz')) { tarballs++; res.writeHead(500); res.end(); return; }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(packument));
    });
    packument = { name, 'dist-tags': { latest: '1.0.0' }, versions: { '1.0.0': make() }, time: { '1.0.0': '2026-01-01T00:00:00.000Z' } };
    const packumentCache = new Map(), parsed = new URL(registry.origin);
    const options = { registry: registry.origin, cache: fixture.env.npm_config_cache, packumentCache, fullMetadata: true,
      verifySignatures: true, fetchRetries: 0, timeout: 2000,
      [`//${parsed.host}/:_keys`]: [{ keyid, expires: null, pemkey: publicKey.export({ type: 'spki', format: 'pem' }) }] };
    const cached = await pacote.packument(`${name}@1.0.0`, options);
    const good = await pacote.manifest(`${name}@1.0.0`, options);
    assert.equal(good.name, name); assert.equal(good._signatures.length, 1);
    const substitutions = [make('different-signed-package'), make(name, '1.0.0', 'different-id@1.0.0'), make(name, '2.0.0')];
    await registry.close(); registry = null;
    const original = cached.versions['1.0.0'];
    for (const changed of substitutions) {
      cached.versions['1.0.0'] = changed;
      await assert.rejects(pacote.manifest(`${name}@1.0.0`, { ...options, offline: true }), { code: 'EMANIFESTMISMATCH' });
    }
    cached.versions['1.0.0'] = original;
    assert.equal((await pacote.manifest(`${name}@1.0.0`, { ...options, offline: true })).name, name);
    assert.equal(requests, 1); assert.equal(tarballs, 0);
  } finally { await registry?.close(); await fixture.close(); }
});
