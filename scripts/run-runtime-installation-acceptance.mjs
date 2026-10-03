/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInstallationWithRouting } from './lib/installationRoutingAcceptance.mjs';
import { readProvenanceFailure } from './lib/publishedUpgradeProvenance.mjs';
import { createRuntimeInstallationReceipt, formatRuntimeInstallationSummary, installationFailureStage,
  INSTALLATION_RECEIPT_PATH, INSTALLATION_SUMMARY_PATH } from './lib/runtimeInstallationReceipt.mjs';

const root = resolve(import.meta.dirname, '..');
export function readInstallationSource(run = spawnSync) {
  const git = args => {
    const result = run('git', args, { cwd: root, encoding: 'utf8', shell: false, windowsHide: true,
      timeout: 10_000, maxBuffer: 1024 * 1024 });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') throw new Error('source_unavailable');
    return result.stdout.trim();
  };
  const sourceRevision = git(['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40,64}$/.test(sourceRevision)) throw new Error('source_invalid');
  return { sourceRevision, worktreeClean: git(['status', '--porcelain', '--untracked-files=normal']) === '' };
}

export async function runRuntimeInstallationAcceptance({ ci = false, resourceBudget = false, expectedRevision = process.env.CLASSIFARR_INSTALLATION_SOURCE_REVISION,
  workflow = ci ? { runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT } : null,
  source = readInstallationSource, drill = runInstallationWithRouting, save = saveReceipt } = {}) {
  let identity = {}, receipt;
  let verifiedWorkflow = null;
  let stage = 'preflight';
  try {
    identity = source();
    if (ci && (!identity.worktreeClean || identity.sourceRevision !== expectedRevision)) throw new Error('ci_source_mismatch');
    if (ci && (typeof workflow?.runId !== 'string' || typeof workflow?.runAttempt !== 'string' ||
      !/^[1-9][0-9]{0,19}$/.test(workflow.runId) || !/^[1-9][0-9]{0,9}$/.test(workflow.runAttempt))) throw new Error('ci_run_invalid');
    if (ci) verifiedWorkflow = { runId: workflow.runId, runAttempt: workflow.runAttempt };
    const result = await drill({ resourceBudget, sourceRevision: identity.sourceRevision });
    stage = 'evidence';
    const after = source();
    if (after.sourceRevision !== identity.sourceRevision || (ci && !after.worktreeClean)) throw new Error('source_changed');
    identity.worktreeClean = identity.worktreeClean && after.worktreeClean;
    receipt = createRuntimeInstallationReceipt({ ...identity, workflow, resourceBudget, result });
  } catch (error) {
    receipt = createRuntimeInstallationReceipt({ ...identity, resourceBudget, workflow: verifiedWorkflow,
      failureStage: stage === 'evidence' ? stage : installationFailureStage(error),
      provenanceFailure: stage === 'preflight' ? readProvenanceFailure(error) : null });
  }
  save(receipt, formatRuntimeInstallationSummary(receipt));
  return receipt;
}

function saveReceipt(receipt, summary) {
  mkdirSync(resolve(root, '.tmp/ci'), { recursive: true, mode: 0o700 });
  writeFileSync(resolve(root, INSTALLATION_RECEIPT_PATH), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  writeFileSync(resolve(root, INSTALLATION_SUMMARY_PATH), summary, { mode: 0o600 });
  if (receipt.status === 'passed' && process.env.GITHUB_OUTPUT) {
    // Validated sha256 only; no command output or user-supplied multiline values.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    appendFileSync(process.env.GITHUB_OUTPUT, `candidate-image-id=${receipt.candidateImageId}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    // GitHub-provided runner file, not application or PR input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (new Set(args).size !== args.length || args.some(arg => !['--ci', '--resource-budget'].includes(arg))) throw new Error('invalid_arguments');
    const receipt = await runRuntimeInstallationAcceptance({ ci: args.includes('--ci'), resourceBudget: args.includes('--resource-budget') });
    process.stdout.write(`Runtime installation acceptance: ${receipt.status}. Receipt: ${INSTALLATION_RECEIPT_PATH}\n`);
    if (receipt.provenanceFailure) process.stdout.write(`Next: ${receipt.provenanceFailure.nextStep}\n`);
    if (receipt.status !== 'passed') process.exitCode = 1;
  } catch {
    process.stderr.write('Runtime installation acceptance could not produce evidence.\n');
    process.exitCode = 1;
  }
}
