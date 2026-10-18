/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runDockerCheckCommand } from './dockerCheckCommand.mjs';
import { ROW_BOUND_FIXTURES, ROW_APPLICATION_FILES, normalizeRowSource, rowSha256 } from '../fixtures/ollamaGatewayRehearsal/rowModeContract.mjs';

export function bindStudySources({ revision, image, read = path => readFileSync(path, 'utf8'),
  git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1048576 }) }) {
  assert.match(revision, /^[a-f0-9]{40}$/); assert.match(image, /^sha256:[a-f0-9]{64}$/);
  assert.equal(git(['rev-parse','HEAD']).trim(), revision, 'row_mode_checkout_revision');
  assert.equal(git(['status','--porcelain']).trim(), '', 'row_mode_checkout_dirty');
  const committed = path => {
    const bytes = read(path); assert.ok(Buffer.byteLength(bytes) < 131072);
    assert.equal(normalizeRowSource(bytes), normalizeRowSource(git(['show',`${revision}:${path}`])), 'row_mode_uncommitted_source');
    return bytes;
  };
  const files = Object.fromEntries(ROW_BOUND_FIXTURES.map(name => [name, rowSha256(committed(`scripts/fixtures/ollamaGatewayRehearsal/${name}`))]));
  const application = Object.fromEntries(ROW_APPLICATION_FILES.map(name => [name, rowSha256(normalizeRowSource(committed(`server/src/ollamaGateway/${name}`)))]));
  const manifest = { version: 1, revision, image, files, application };
  return { manifest, sha256: rowSha256(JSON.stringify(manifest)) };
}

export function verifyCopiedStudySources(source,binding) {
  const result = runDockerCheckCommand(['exec','--user','1000:1000',source,'node','--input-type=module','-e',
    'import {readFile} from "node:fs/promises";import {createHash} from "node:crypto";for(const [name,sha] of Object.entries(JSON.parse(process.argv[1]))){if(createHash("sha256").update(await readFile("/fixtures/"+name)).digest("hex")!==sha)process.exitCode=1}',
    JSON.stringify(binding.manifest.files)],{ timeoutMs:10000 });
  assert.equal(result.ok,true,'row_mode_copied_source_drift');
}
