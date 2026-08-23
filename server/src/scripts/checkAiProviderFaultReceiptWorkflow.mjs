/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import fs from 'node:fs';
import { resolve } from 'node:path';

import { load } from 'js-yaml';

function githubExpression(expression) {
  return '$' + `{{ ${expression} }}`;
}

const CHECKOUT_ACTION = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_ACTION = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const UPLOAD_ARTIFACT_ACTION = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const TAG_PUSH_IF = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')";
const GITHUB_SHA_EXPRESSION = githubExpression('github.sha');
const RUN_OUTCOME_EXPRESSION = githubExpression('steps.run-provider-fault-compose-integration.outcome');
const PROVIDER_FAULT_JOB_NAME = 'release-candidate-provider-fault-receipt';
const RECEIPT_SOURCE_REVISION_ENV = 'CLASSIFARR_AI_PROVIDER_FAULT_RECEIPT_SOURCE_REVISION';

export const DEFAULT_WORKFLOW_PATH = resolve(
  import.meta.dirname,
  '../../../.github/workflows/ci.yml',
);
export const AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME = 'ai-provider-fault-compose-receipt';
export const AI_PROVIDER_FAULT_RECEIPT_PATH = '.tmp/ci/ai-provider-fault-compose-receipt.json';

function asRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertExactObject(value, expected, label) {
  const actual = asRecord(value, label);
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    throw new Error(`${label} must contain only ${expectedKeys.join(', ')}.`);
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      throw new Error(`${label}.${key} must equal ${JSON.stringify(expectedValue)}.`);
    }
  }
}

function findStep(steps, name) {
  const step = steps.find(candidate => candidate?.name === name);
  if (!step) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME} must contain the ${JSON.stringify(name)} step.`);
  }
  return step;
}

function assertPinnedAction(step, action, label) {
  if (step.uses !== action) {
    throw new Error(`${label} must use ${action}.`);
  }
}

function assertRequiredRun(step, fragments, label) {
  if (
    typeof step.run !== 'string' ||
    fragments.some(fragment => !step.run.includes(fragment))
  ) {
    throw new Error(`${label} must retain its fixed command contract.`);
  }
}

function assertReceiptUploadIsOnlyArtifact(job, steps) {
  const artifactSteps = steps.filter(step => step?.uses === UPLOAD_ARTIFACT_ACTION);
  if (artifactSteps.length !== 1) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME} must upload only its bounded receipt.`);
  }

  const uploadStep = findStep(steps, 'Upload bounded AI provider fault receipt');
  if (uploadStep.if !== 'always()') {
    throw new Error('Upload bounded AI provider fault receipt must run after either outcome.');
  }
  assertPinnedAction(
    uploadStep,
    UPLOAD_ARTIFACT_ACTION,
    'Upload bounded AI provider fault receipt',
  );
  assertExactObject(uploadStep.with, {
    'if-no-files-found': 'error',
    name: AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
    path: AI_PROVIDER_FAULT_RECEIPT_PATH,
    'retention-days': 14,
  }, 'Upload bounded AI provider fault receipt.with');

  if (job.outputs !== undefined) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME} must not expose workflow outputs.`);
  }
}

function assertNoSecretReferences(job) {
  if (JSON.stringify(job).includes('secrets.')) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME} must not access secrets.`);
  }
}

function assertWorkflowJob(job) {
  if (job.if !== TAG_PUSH_IF) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME} must remain a tag-only push job.`);
  }
  if (job['runs-on'] !== 'ubuntu-latest') {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME}.runs-on must equal ubuntu-latest.`);
  }
  if (job['timeout-minutes'] !== 15) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME}.timeout-minutes must equal 15.`);
  }
  const needs = Array.isArray(job.needs) ? job.needs : [job.needs];
  if (needs.length !== 1 || needs[0] !== 'release-acceptance') {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME}.needs must contain only release-acceptance.`);
  }
  assertExactObject(job.permissions, { contents: 'read' }, `${PROVIDER_FAULT_JOB_NAME}.permissions`);
  assertNoSecretReferences(job);

  if (!Array.isArray(job.steps)) {
    throw new Error(`${PROVIDER_FAULT_JOB_NAME}.steps must be an array.`);
  }
  const steps = job.steps;

  const checkoutStep = findStep(steps, 'Checkout code');
  assertPinnedAction(checkoutStep, CHECKOUT_ACTION, `${PROVIDER_FAULT_JOB_NAME} Checkout code`);
  assertExactObject(checkoutStep.with, {
    'persist-credentials': false,
  }, `${PROVIDER_FAULT_JOB_NAME} Checkout code.with`);

  const setupStep = findStep(steps, 'Setup Node.js');
  assertPinnedAction(setupStep, SETUP_NODE_ACTION, `${PROVIDER_FAULT_JOB_NAME} Setup Node.js`);
  assertExactObject(setupStep.with, {
    'node-version-file': '.nvmrc',
  }, `${PROVIDER_FAULT_JOB_NAME} Setup Node.js.with`);

  assertRequiredRun(
    findStep(steps, 'Set up npm and npx'),
    ['set -euo pipefail', 'npm install --global npm@12.0.2', 'npm --version', 'npx --version'],
    'Set up npm and npx',
  );
  assertRequiredRun(
    findStep(steps, 'Install server dependencies'),
    ['set -euo pipefail', 'cd server', 'npm ci'],
    'Install server dependencies',
  );

  const runStep = findStep(steps, 'Run isolated AI provider fault integration');
  if (runStep.id !== 'run-provider-fault-compose-integration' || runStep['continue-on-error'] !== true) {
    throw new Error('Run isolated AI provider fault integration must retain its receipt-first failure handling.');
  }
  assertExactObject(runStep.env, {
    [RECEIPT_SOURCE_REVISION_ENV]: GITHUB_SHA_EXPRESSION,
  }, 'Run isolated AI provider fault integration.env');
  assertRequiredRun(
    runStep,
    ['set -euo pipefail', 'npm run test:integration:ai-provider-fault-compose'],
    'Run isolated AI provider fault integration',
  );

  const receiptCheckStep = findStep(steps, 'Verify bounded AI provider fault receipt');
  if (receiptCheckStep.if !== 'always()') {
    throw new Error('Verify bounded AI provider fault receipt must run after either outcome.');
  }
  assertExactObject(receiptCheckStep.env, {
    [RECEIPT_SOURCE_REVISION_ENV]: GITHUB_SHA_EXPRESSION,
  }, 'Verify bounded AI provider fault receipt.env');
  assertRequiredRun(
    receiptCheckStep,
    ['set -euo pipefail', 'node scripts/check-ai-provider-fault-compose-receipt.mjs'],
    'Verify bounded AI provider fault receipt',
  );

  assertReceiptUploadIsOnlyArtifact(job, steps);

  const enforceStep = findStep(steps, 'Enforce AI provider fault integration outcome');
  if (enforceStep.if !== 'always()') {
    throw new Error('Enforce AI provider fault integration outcome must run after receipt publication.');
  }
  assertRequiredRun(
    enforceStep,
    ['set -euo pipefail', 'test "' + RUN_OUTCOME_EXPRESSION + '" = "success"'],
    'Enforce AI provider fault integration outcome',
  );
}

export function loadWorkflow(workflowPath = DEFAULT_WORKFLOW_PATH) {
  // The production command checks the fixed repository workflow; tests supply a fixture copy.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return load(fs.readFileSync(workflowPath, 'utf8'));
}

export function validateAiProviderFaultReceiptWorkflow(workflow) {
  const jobs = asRecord(asRecord(workflow, 'workflow').jobs, 'workflow.jobs');
  assertWorkflowJob(asRecord(jobs[PROVIDER_FAULT_JOB_NAME], `workflow.jobs.${PROVIDER_FAULT_JOB_NAME}`));
  return {
    artifact: AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
    receiptPath: AI_PROVIDER_FAULT_RECEIPT_PATH,
  };
}

function main() {
  try {
    const result = validateAiProviderFaultReceiptWorkflow(loadWorkflow());
    process.stdout.write(`Verified AI provider fault receipt contract for ${result.artifact}.\n`);
  } catch (error) {
    process.stderr.write(`AI provider fault receipt workflow contract check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
