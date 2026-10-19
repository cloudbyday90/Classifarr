/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { studyPolicy } from './gatewayStudyPolicy.mjs';

const normalize = bytes => bytes.toString('utf8').replaceAll('\r\n','\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function bindStudySources({ revision,image,fixtureRevision = revision,study = 'rowmode',profile = 'extended',
  read = path => readFileSync(path), git = args => execFileSync('git',args,{windowsHide:true,timeout:10000,maxBuffer:1048576}) }) {
  for (const value of [revision,fixtureRevision]) assert.match(value,/^[a-f0-9]{40}$/);
  assert.match(image,/^sha256:[a-f0-9]{64}$/);
  const policy = studyPolicy(study,profile);
  assert.equal(git(['rev-parse','HEAD']).toString().trim(),fixtureRevision,'study_checkout_revision');
  assert.equal(git(['status','--porcelain']).toString().trim(),'','study_checkout_dirty');
  if (study === 'rowmode') assert.equal(revision,fixtureRevision,'row_mode_parity_revision');
  const committed = (path,ref) => {
    assert.match(git(['ls-tree',ref,'--',path]).toString(),/^100644 blob [a-f0-9]{40}\t/,'study_input_not_regular');
    const bytes = Buffer.from(git(['show',`${ref}:${path}`]));
    assert.ok(bytes.length > 0 && bytes.length < 131072,'study_input_size');
    return bytes;
  };
  const sources = Object.fromEntries(policy.files.map(name => {
    const path = `scripts/fixtures/ollamaGatewayRehearsal/${name}`, bytes = committed(path,fixtureRevision);
    assert.equal(normalize(read(path)),normalize(bytes),'study_uncommitted_source'); return [name,bytes];
  }));
  const application = Object.fromEntries(policy.application.map(name => [name,sha(normalize(committed(`server/src/ollamaGateway/${name}`,revision)))]));
  const manifest = { version:2,study,profile,fixtureRevision,imageRevision:revision,image,entries:policy.entries,
    files:Object.fromEntries(Object.entries(sources).map(([name,bytes]) => [name,sha(bytes)])),application };
  return { manifest,sha256:sha(JSON.stringify(manifest)),sources };
}
