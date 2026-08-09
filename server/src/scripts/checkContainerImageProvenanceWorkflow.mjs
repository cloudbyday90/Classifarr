/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import { resolve } from 'node:path';

import { load } from 'js-yaml';

function githubExpression(expression) {
  return '$' + `{{ ${expression} }}`;
}

const ENV_REGISTRY_EXPRESSION = githubExpression('env.REGISTRY');
const ENV_IMAGE_NAME_EXPRESSION = githubExpression('env.IMAGE_NAME');
const GITHUB_REPOSITORY_EXPRESSION = githubExpression('github.repository');
const GITHUB_SHA_EXPRESSION = githubExpression('github.sha');
const GITHUB_TOKEN_EXPRESSION = githubExpression('github.token');
const IMAGE_DIGEST_VARIABLE = '$' + '{IMAGE_DIGEST}';

export const ATTEST_ACTION_REFERENCE =
  'actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6';
export const EXPECTED_SIGNER_WORKFLOW =
  `${GITHUB_REPOSITORY_EXPRESSION}/.github/workflows/ci.yml`;
export const DEFAULT_WORKFLOW_PATH = resolve(
  import.meta.dirname,
  '../../../.github/workflows/ci.yml'
);

const EXPECTED_PERMISSIONS = Object.freeze({
  attestations: 'write',
  contents: 'read',
  'id-token': 'write',
  packages: 'write',
});

const EXPECTED_ATTESTATIONS = Object.freeze([
  Object.freeze({
    name: 'Attest GHCR image provenance',
    subjectName: `${ENV_REGISTRY_EXPRESSION}/${ENV_IMAGE_NAME_EXPRESSION}`,
  }),
  Object.freeze({
    name: 'Attest Docker Hub image provenance',
    subjectName: 'docker.io/cloudbyday90/classifarr',
  }),
]);

const EXPECTED_DIGEST_EXPRESSION = githubExpression('steps.build-and-push-image.outputs.digest');
const EXPECTED_BUILD_ACTION =
  'docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a';

function asRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function asString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function findStep(steps, name) {
  const step = steps.find(candidate => candidate?.name === name);
  if (!step) {
    throw new Error(`docker-release must contain the "${name}" step.`);
  }
  return step;
}

function findStepIndex(steps, name) {
  const index = steps.findIndex(candidate => candidate?.name === name);
  if (index === -1) {
    throw new Error(`docker-release must contain the "${name}" step.`);
  }
  return index;
}

function assertExactObject(value, expected, label) {
  const actual = asRecord(value, label);
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    throw new Error(`${label} must grant only ${expectedKeys.join(', ')}.`);
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      throw new Error(`${label}.${key} must equal "${expectedValue}".`);
    }
  }
}

function assertAttestationStep(step, expectation) {
  if (step.uses !== ATTEST_ACTION_REFERENCE) {
    throw new Error(`${expectation.name} must use the SHA-pinned actions/attest v4.2.2 action.`);
  }

  const inputs = asRecord(step.with, `${expectation.name}.with`);
  if (inputs['subject-name'] !== expectation.subjectName) {
    throw new Error(`${expectation.name} must attest ${expectation.subjectName}.`);
  }
  if (inputs['subject-digest'] !== EXPECTED_DIGEST_EXPRESSION) {
    throw new Error(`${expectation.name} must use the Buildx digest output.`);
  }
  if (inputs['push-to-registry'] !== true) {
    throw new Error(`${expectation.name} must push the attestation to its OCI registry.`);
  }
}

function assertVerificationStep(step) {
  const environment = asRecord(step.env, 'Verify container image provenance.env');
  const expectedEnvironment = {
    EXPECTED_SIGNER_WORKFLOW,
    GH_TOKEN: GITHUB_TOKEN_EXPRESSION,
    IMAGE_DIGEST: EXPECTED_DIGEST_EXPRESSION,
    SOURCE_REPOSITORY: GITHUB_REPOSITORY_EXPRESSION,
    SOURCE_REVISION: GITHUB_SHA_EXPRESSION,
  };

  assertExactObject(environment, expectedEnvironment, 'Verify container image provenance.env');

  const command = asString(step.run, 'Verify container image provenance.run');
  const requiredFragments = [
    'set -euo pipefail',
    'for attempt in 1 2 3 4 5',
    'gh attestation verify "$image_uri"',
    '--repo "$SOURCE_REPOSITORY"',
    '--signer-workflow "$EXPECTED_SIGNER_WORKFLOW"',
    '--source-digest "$SOURCE_REVISION"',
    '--deny-self-hosted-runners',
    '--no-public-good',
    `verify_image "oci://${ENV_REGISTRY_EXPRESSION}/${ENV_IMAGE_NAME_EXPRESSION}@${IMAGE_DIGEST_VARIABLE}"`,
    `verify_image "oci://docker.io/cloudbyday90/classifarr@${IMAGE_DIGEST_VARIABLE}"`,
    '>> "$GITHUB_STEP_SUMMARY"',
  ];

  for (const fragment of requiredFragments) {
    if (!command.includes(fragment)) {
      throw new Error(`Verify container image provenance.run must contain ${JSON.stringify(fragment)}.`);
    }
  }
}

export function loadWorkflow(workflowPath = DEFAULT_WORKFLOW_PATH) {
  // The caller controls the path only in tests; the production command uses the fixed repository workflow.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return load(fs.readFileSync(workflowPath, 'utf8'));
}

export function validateContainerImageProvenanceWorkflow(workflow) {
  const jobs = asRecord(asRecord(workflow, 'workflow').jobs, 'workflow.jobs');
  const dockerRelease = asRecord(jobs['docker-release'], 'workflow.jobs.docker-release');
  const steps = dockerRelease.steps;

  if (!Array.isArray(steps)) {
    throw new Error('docker-release.steps must be an array.');
  }
  if (dockerRelease.if !== "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')") {
    throw new Error('docker-release must remain a tag-only push job.');
  }

  assertExactObject(dockerRelease.permissions, EXPECTED_PERMISSIONS, 'docker-release.permissions');

  const buildStep = findStep(steps, 'Build and push Docker image');
  if (buildStep.id !== 'build-and-push-image' || buildStep.uses !== EXPECTED_BUILD_ACTION) {
    throw new Error('Build and push Docker image must retain the named Buildx digest-producing step.');
  }

  const buildStepIndex = findStepIndex(steps, 'Build and push Docker image');
  const attestationStepIndexes = EXPECTED_ATTESTATIONS.map(expectation => {
    const index = findStepIndex(steps, expectation.name);
    assertAttestationStep(steps[index], expectation);
    return index;
  });
  const verificationStepIndex = findStepIndex(steps, 'Verify container image provenance');
  assertVerificationStep(steps[verificationStepIndex]);

  if (attestationStepIndexes.some(index => index <= buildStepIndex)) {
    throw new Error('Container attestations must execute after the image push completes.');
  }
  if (verificationStepIndex <= Math.max(...attestationStepIndexes)) {
    throw new Error('Container provenance verification must execute after every attestation.');
  }

  return {
    attestedSubjects: EXPECTED_ATTESTATIONS.map(({ subjectName }) => subjectName),
    digestExpression: EXPECTED_DIGEST_EXPRESSION,
    signerWorkflow: EXPECTED_SIGNER_WORKFLOW,
  };
}

function main() {
  try {
    const result = validateContainerImageProvenanceWorkflow(loadWorkflow());
    process.stdout.write(
      `Verified container provenance workflow contract for ${result.attestedSubjects.join(' and ')}.\n`
    );
  } catch (error) {
    process.stderr.write(`Container provenance workflow contract check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
