/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPromotionCommand } from './lib/releasePromotionCommand.mjs';
import { loadPromotionAuthority } from './lib/releasePromotionAuthority.mjs';
import { promoteReleaseImages } from './lib/releaseImagePromotion.mjs';
import { routingWorkflowIdentity } from './lib/publishedRoutingReceipt.mjs';

export function runPromotion({ args = process.argv.slice(2), env = process.env, command = createPromotionCommand(),
  record = value => {
    mkdirSync('.tmp/ci', { recursive: true });
    writeFileSync('.tmp/ci/published-release-image-alias-promotion.json', `${JSON.stringify(value, null, 2)}\n`);
  } } = {}) {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--write'));
  record({ schemaVersion: 'classifarr.release.image-promotion.v2', status: 'authority_check_started' });
  let authorityVerified = false;
  try {
    const automatic = env.GITHUB_EVENT_NAME === 'push';
    if (env.GITHUB_ACTIONS === 'true') assert.equal(env.GITHUB_REF, `refs/tags/${env.SOURCE_TAG}`);
    if (automatic) {
      assert.match(env.SOURCE_REVISION ?? '', /^[a-f0-9]{40}$/);
      assert.match(env.IMAGE_DIGEST ?? '', /^sha256:[a-f0-9]{64}$/);
      assert.equal(env.GITHUB_REF, `refs/tags/${env.SOURCE_TAG}`);
    }
    const subject = loadPromotionAuthority({ tag: env.SOURCE_TAG, command,
      sourceRevision: automatic ? env.SOURCE_REVISION : undefined,
      digest: automatic ? env.IMAGE_DIGEST : undefined,
      workflow: automatic ? routingWorkflowIdentity(env) : undefined });
    authorityVerified = true;
    return promoteReleaseImages({ subject, command, write: args[0] === '--write', record });
  } catch {
    if (!authorityVerified) record({ schemaVersion: 'classifarr.release.image-promotion.v2', status: 'authority_check_failed' });
    // The graph/promotion receipt, when present, retains partial progress.
    throw new Error('release_promotion_failed; inspect the bounded promotion receipt');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try { process.stdout.write(`${JSON.stringify(runPromotion())}\n`); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
