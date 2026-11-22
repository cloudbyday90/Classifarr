/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertReleaseTag } from './lib/releaseCandidateEvidence.mjs';
import { assertSourceRevision } from './lib/publishedDigestConsumerSmoke.mjs';
import { loadPublishedReleaseVerificationEvidence } from './lib/releasePromotionAuthority.mjs';
import { createPromotionCommand } from './lib/releasePromotionCommand.mjs';
import { validateReleaseWorkflowIdentity, verifyPublishedReleaseAttempt } from './lib/publishedReleaseAttempt.mjs';
import { readReleaseRegistryTags, verifyPromotionGraph } from './lib/releaseRegistryInspection.mjs';

const FLAGS = ['--tag', '--source-revision', '--digest', '--run-id', '--run-attempt'];
const SCHEMA = 'classifarr.release.verification.v1';

function parseArgs(args) {
  assert.equal(args.length, FLAGS.length * 2);
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    assert.ok(FLAGS.includes(flag) && !options.has(flag));
    options.set(flag, args[index + 1]);
  }
  const tag = assertReleaseTag(options.get('--tag'));
  const sourceRevision = assertSourceRevision(options.get('--source-revision'));
  const digest = options.get('--digest');
  assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  const workflow = validateReleaseWorkflowIdentity({ runId: options.get('--run-id'), runAttempt: options.get('--run-attempt') });
  return { tag, sourceRevision, digest, workflow };
}

export function verifyPublishedRelease(args, { command = createPromotionCommand(), now = () => new Date().toISOString() } = {}) {
  let stage = 'input';
  const receipt = { schemaVersion: SCHEMA, status: 'blocked', release: null, workflow: null, registries: [] };
  try {
    const { workflow, ...expected } = parseArgs(args);
    receipt.workflow = workflow;
    stage = 'release';
    const { routingSubjects, ...release } = loadPublishedReleaseVerificationEvidence({ ...expected, workflow, command });
    receipt.release = release;
    stage = 'workflow';
    verifyPublishedReleaseAttempt({ ...expected, workflow, command });

    const checkTags = () => {
      receipt.registries = readReleaseRegistryTags(command, expected.tag);
      assert.ok(receipt.registries.every(({ versionDigest, latestDigest }) =>
        versionDigest === expected.digest && latestDigest === expected.digest));
    };
    stage = 'registry_tags';
    checkTags();
    stage = 'registry_graph';
    for (const { repository } of receipt.registries) {
      verifyPromotionGraph(command, `${repository}@${expected.digest}`, { routingSubjects });
    }
    stage = 'registry_recheck';
    checkTags();
    const observedAt = now();
    assert.equal(new Date(observedAt).toISOString(), observedAt);
    return { ...receipt, status: 'passed', observedAt, failureStage: null };
  } catch {
    return { ...receipt, failureStage: stage };
  }
}

if (import.meta.main) {
  const receipt = verifyPublishedRelease(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.status !== 'passed') process.exitCode = 1;
}
