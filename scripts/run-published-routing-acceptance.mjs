/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPublishedRoutingAcceptance } from './lib/publishedRoutingAcceptance.mjs';
import { PUBLISHED_ROUTING_SCHEMA, routingWorkflowIdentity } from './lib/publishedRoutingReceipt.mjs';
import { ROUTING_PLATFORMS } from './lib/publishedRoutingSubject.mjs';
import { assertSourceRevision, parsePublishedImageReference } from './lib/publishedDigestConsumerSmoke.mjs';

const failureCodes = ['published_routing_identity_failed', 'published_routing_rehearsal_failed', 'published_routing_evidence_failed'];

export async function publishedRoutingMain(args, { env = process.env, cwd = resolve(import.meta.dirname, '..'),
  run = spawnSync, accept = runPublishedRoutingAcceptance } = {}) {
  assert.equal(args.length, 6);
  const flags = ['--image', '--source-revision', '--platform'];
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(flags.includes(args[i]) && !options.has(args[i]));
    options.set(args[i], args[i + 1]);
  }
  const image = parsePublishedImageReference(options.get('--image')).image;
  const sourceRevision = assertSourceRevision(options.get('--source-revision'));
  const platform = options.get('--platform');
  assert.ok(ROUTING_PLATFORMS.includes(platform));
  const workflow = routingWorkflowIdentity(env);
  assert.equal(env.GITHUB_SHA, sourceRevision);
  const checkSource = () => {
    for (const [gitArgs, expected] of [[['rev-parse', 'HEAD'], sourceRevision], [['status', '--porcelain'], '']]) {
      const result = run('git', gitArgs, { cwd, encoding: 'utf8', shell: false, windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 });
      assert.ok(!result.error && result.status === 0);
      assert.equal(result.stdout.trim(), expected);
    }
  };
  const directory = resolve(cwd, '.tmp/published-routing');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const receiptPath = resolve(directory, `${platform.split('/')[1]}.json`);
  let receipt = { schemaVersion: PUBLISHED_ROUTING_SCHEMA, status: 'blocked', failureStage: 'source' };
  let stage = 'source';
  try {
    checkSource();
    stage = 'acceptance';
    const result = await accept({ image, sourceRevision, platform, workflow });
    stage = 'source';
    checkSource();
    receipt = result;
    return result;
  } catch (error) {
    const code = failureCodes.includes(error?.message) ? error.message : `published_routing_${stage}_failed`;
    receipt.failureStage = code;
    throw new Error(code);
  } finally {
    // Overwrite an earlier local receipt even on failure; never retain stale success.
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  publishedRoutingMain(process.argv.slice(2)).then(() => {
    process.stdout.write('Published routing acceptance passed.\n');
  }).catch(error => {
    const code = [...failureCodes, 'published_routing_source_failed', 'published_routing_acceptance_failed'].includes(error?.message)
      ? error.message : 'published_routing_input_invalid';
    process.stderr.write(`Published routing acceptance blocked: ${code}; no release evidence authorized.\n`);
    process.exitCode = 1;
  });
}
