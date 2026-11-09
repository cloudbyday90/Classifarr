/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const payload = 'Classifarr system curl compression control';
const server = createServer((_req, res) => { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end(gzipSync(payload)); });
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { stdout } = await promisify(execFile)('curl', ['--fail', '--silent', '--show-error', '--compressed', '--max-time', '2',
    `http://127.0.0.1:${server.address().port}`], { timeout: 4000, maxBuffer: 4096 });
  assert.equal(stdout, payload);
  process.stdout.write(JSON.stringify({ curlCompressed: true, nodeZlib: process.versions.zlib }) + '\n');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
