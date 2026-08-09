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
const INSTALLATION_EVIDENCE_ARTIFACT = 'policy-release-installation-evidence';
const RELEASE_ACCEPTANCE_ENVIRONMENT = 'release-acceptance';
const GITHUB_REF_EXPRESSION = githubExpression('github.ref');
const GITHUB_REF_NAME_EXPRESSION = githubExpression('github.ref_name');
const GITHUB_REF_TYPE_EXPRESSION = githubExpression('github.ref_type');
const GITHUB_SHA_EXPRESSION = githubExpression('github.sha');
const INPUT_CHANGE_REFERENCE_EXPRESSION = githubExpression('inputs.change_reference');
const INPUT_DEPLOYMENT_FINGERPRINT_EXPRESSION = githubExpression('inputs.deployment_fingerprint');
const CONCURRENCY_GROUP_EXPRESSION =
  'release-installation-evidence-' + githubExpression('inputs.deployment_fingerprint');
const APPROVAL_WORKFLOW_URL_EXPRESSION = [
  githubExpression('github.server_url'),
  githubExpression('github.repository'),
  'actions/runs',
  githubExpression('github.run_id'),
].join('/');

export const DEFAULT_WORKFLOW_PATH = resolve(
  import.meta.dirname,
  '../../../.github/workflows/release-installation-evidence.yml'
);

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

function assertExactKeys(value, expectedKeys, label) {
  const actual = asRecord(value, label);
  const actualKeys = Object.keys(actual).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (actualKeys.join(',') !== sortedExpectedKeys.join(',')) {
    throw new Error(`${label} must contain only ${sortedExpectedKeys.join(', ')}.`);
  }
}

function findStep(steps, name) {
  const step = steps.find(candidate => candidate?.name === name);
  if (!step) {
    throw new Error(`record-installation-evidence must contain the ${JSON.stringify(name)} step.`);
  }
  return step;
}

function assertPinnedAction(step, action, label) {
  if (step.uses !== action) {
    throw new Error(`${label} must use ${action}.`);
  }
}

function assertInput(input, description, label) {
  assertExactObject(input, {
    description,
    required: true,
    type: 'string',
  }, label);
}

function assertWorkflowDispatch(workflow) {
  const dispatch = asRecord(workflow.on, 'workflow.on').workflow_dispatch;
  const inputs = asRecord(asRecord(dispatch, 'workflow.on.workflow_dispatch').inputs, 'workflow dispatch inputs');

  assertExactKeys(inputs, ['change_reference', 'deployment_fingerprint'], 'workflow dispatch inputs');
  assertInput(
    inputs.deployment_fingerprint,
    'Immutable deployed image digest or equivalent deployment fingerprint',
    'deployment_fingerprint input'
  );
  assertInput(
    inputs.change_reference,
    'Bounded release, change, or deployment reference',
    'change_reference input'
  );
}

function assertTagVerificationStep(step) {
  assertExactObject(step.env, {
    RELEASE_REF: GITHUB_REF_EXPRESSION,
    RELEASE_REF_TYPE: GITHUB_REF_TYPE_EXPRESSION,
    RELEASE_TAG: GITHUB_REF_NAME_EXPRESSION,
  }, 'Verify tagged release context.env');

  const requiredFragments = [
    'set -euo pipefail',
    '"$RELEASE_REF_TYPE" != "tag"',
    '"$RELEASE_REF" != "refs/tags/$RELEASE_TAG"',
    '"$RELEASE_TAG" != v*',
    'Release Installation Evidence must run from a v* release tag.',
    'npm run release:check-candidate-version -- --tag "$RELEASE_TAG"',
  ];
  if (typeof step.run !== 'string' || requiredFragments.some(fragment => !step.run.includes(fragment))) {
    throw new Error('Verify tagged release context must reject non-v* refs and validate the tag version contract.');
  }
}

function assertEvidenceStep(step) {
  assertExactObject(step.env, {
    APPROVAL_WORKFLOW_URL: APPROVAL_WORKFLOW_URL_EXPRESSION,
    CHANGE_REFERENCE: INPUT_CHANGE_REFERENCE_EXPRESSION,
    DEPLOYMENT_FINGERPRINT: INPUT_DEPLOYMENT_FINGERPRINT_EXPRESSION,
    SOURCE_REVISION: GITHUB_SHA_EXPRESSION,
  }, 'Create fingerprint-bound installation evidence.env');

  const requiredFragments = [
    '--deployment-fingerprint "$DEPLOYMENT_FINGERPRINT"',
    '--source-revision "$SOURCE_REVISION"',
    '--approval-environment release-acceptance',
    '--approval-workflow-url "$APPROVAL_WORKFLOW_URL"',
    '--change-reference "$CHANGE_REFERENCE"',
    '--attested-at "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"',
    '--output .tmp/release/policy-release-installation-evidence.json',
  ];
  if (typeof step.run !== 'string' ||
    step.run.includes('inputs.deployment_fingerprint') ||
    step.run.includes('inputs.change_reference') ||
    requiredFragments.some(fragment => !step.run.includes(fragment))) {
    throw new Error('Create fingerprint-bound installation evidence must use quoted environment inputs only.');
  }
}

function assertInstallationEvidenceJob(job) {
  assertExactObject(job.environment, {
    name: RELEASE_ACCEPTANCE_ENVIRONMENT,
  }, 'record-installation-evidence.environment');
  assertExactObject(job.permissions, {
    contents: 'read',
  }, 'record-installation-evidence.permissions');
  assertExactObject(job.concurrency, {
    'cancel-in-progress': false,
    group: CONCURRENCY_GROUP_EXPRESSION,
  }, 'record-installation-evidence.concurrency');
  if (job['timeout-minutes'] !== 10) {
    throw new Error('record-installation-evidence.timeout-minutes must equal 10.');
  }
  if (!Array.isArray(job.steps)) {
    throw new Error('record-installation-evidence.steps must be an array.');
  }

  const checkoutStep = findStep(job.steps, 'Checkout deployed source revision');
  assertPinnedAction(checkoutStep, CHECKOUT_ACTION, 'Checkout deployed source revision');
  assertExactObject(checkoutStep.with, {
    'persist-credentials': false,
  }, 'Checkout deployed source revision.with');

  const setupNodeStep = findStep(job.steps, 'Setup Node.js');
  assertPinnedAction(setupNodeStep, SETUP_NODE_ACTION, 'Setup Node.js');
  assertExactObject(setupNodeStep.with, {
    'node-version-file': '.nvmrc',
  }, 'Setup Node.js.with');

  assertTagVerificationStep(findStep(job.steps, 'Verify tagged release context'));
  assertEvidenceStep(findStep(job.steps, 'Create fingerprint-bound installation evidence'));

  const uploadStep = findStep(job.steps, 'Upload installation evidence artifact');
  assertPinnedAction(uploadStep, UPLOAD_ARTIFACT_ACTION, 'Upload installation evidence artifact');
  assertExactObject(uploadStep.with, {
    'if-no-files-found': 'error',
    name: INSTALLATION_EVIDENCE_ARTIFACT,
    path: '.tmp/release/policy-release-installation-evidence.json',
    'retention-days': 90,
  }, 'Upload installation evidence artifact.with');
}

export function loadWorkflow(workflowPath = DEFAULT_WORKFLOW_PATH) {
  // The production command checks the fixed repository workflow; tests supply a fixture copy.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return load(fs.readFileSync(workflowPath, 'utf8'));
}

export function validateReleaseInstallationEvidenceWorkflow(workflow) {
  const source = asRecord(workflow, 'workflow');
  assertWorkflowDispatch(source);
  const jobs = asRecord(source.jobs, 'workflow.jobs');
  assertInstallationEvidenceJob(
    asRecord(jobs['record-installation-evidence'], 'workflow.jobs.record-installation-evidence')
  );

  return {
    artifactName: INSTALLATION_EVIDENCE_ARTIFACT,
    environment: RELEASE_ACCEPTANCE_ENVIRONMENT,
  };
}

function main() {
  try {
    const result = validateReleaseInstallationEvidenceWorkflow(loadWorkflow());
    process.stdout.write(
      `Verified release installation evidence workflow contract for ${result.environment}.\n`
    );
  } catch (error) {
    process.stderr.write(`Release installation evidence workflow contract check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
