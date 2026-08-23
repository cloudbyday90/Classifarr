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
import { AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME } from './checkAiProviderFaultReceiptWorkflow.mjs';

function githubExpression(expression) {
  return '$' + `{{ ${expression} }}`;
}

const CHECKOUT_ACTION = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const DOWNLOAD_ARTIFACT_ACTION = 'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c';
const SETUP_NODE_ACTION = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const UPLOAD_ARTIFACT_ACTION = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const TAG_PUSH_IF = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')";
const BUILD_DIGEST_EXPRESSION = githubExpression('steps.build-and-push-image.outputs.digest');
const DOCKER_RELEASE_DIGEST_EXPRESSION = githubExpression('needs.docker-release.outputs.image_digest');
const GITHUB_REF_NAME_EXPRESSION = githubExpression('github.ref_name');
const GITHUB_REPOSITORY_EXPRESSION = githubExpression('github.repository');
const GITHUB_SHA_EXPRESSION = githubExpression('github.sha');
const GITHUB_TOKEN_EXPRESSION = githubExpression('github.token');
const IMAGE_VARIABLE = '$' + '{IMAGE}';
const IMAGE_DIGEST_VARIABLE = '$' + '{IMAGE_DIGEST}';
const MANIFEST_DIGEST_VARIABLE = '$' + '{MANIFEST_DIGEST}';
const SOURCE_REVISION_VARIABLE = '$' + '{SOURCE_REVISION}';

export const DEFAULT_WORKFLOW_PATH = resolve(
  import.meta.dirname,
  '../../../.github/workflows/ci.yml'
);
export const RELEASE_PUBLICATION_ENVIRONMENT = 'release-publication';
export const RELEASE_CANDIDATE_ARTIFACT_NAME = 'release-candidate-evidence';
export const PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME = 'published-digest-consumer-smoke';
export const PROVIDER_FAULT_RECEIPT_DOWNLOAD_PATH =
  '.tmp/release-candidate/provider-fault-receipt';

const EXPECTED_SMOKE_PERMISSIONS = Object.freeze({
  attestations: 'read',
  contents: 'read',
});
const EXPECTED_PUBLICATION_PERMISSIONS = Object.freeze({
  attestations: 'read',
  contents: 'write',
});

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

function findStep(steps, name, jobName) {
  const step = steps.find(candidate => candidate?.name === name);
  if (!step) {
    throw new Error(`${jobName} must contain the ${JSON.stringify(name)} step.`);
  }
  return step;
}

function assertPinnedAction(step, action, label) {
  if (step.uses !== action) {
    throw new Error(`${label} must use ${action}.`);
  }
}

function assertTagOnlyJob(job, name) {
  if (job.if !== TAG_PUSH_IF) {
    throw new Error(`${name} must remain a tag-only push job.`);
  }
}

function assertJobNeeds(job, expected, name) {
  const actual = Array.isArray(job.needs) ? job.needs : [job.needs];
  if (actual.length !== expected.length || expected.some(value => !actual.includes(value))) {
    throw new Error(`${name}.needs must contain only ${expected.join(', ')}.`);
  }
}

function assertArtifactStep({ step, artifactName, path, label }) {
  assertPinnedAction(step, UPLOAD_ARTIFACT_ACTION, label);
  assertExactObject(step.with, {
    'if-no-files-found': 'error',
    name: artifactName,
    path,
    'retention-days': 90,
  }, `${label}.with`);
}

function assertDownloadStep({ step, artifactName, path, label }) {
  assertPinnedAction(step, DOWNLOAD_ARTIFACT_ACTION, label);
  assertExactObject(step.with, {
    name: artifactName,
    path,
  }, `${label}.with`);
}

function assertDockerReleaseOutput(dockerRelease) {
  assertExactObject(dockerRelease.outputs, {
    image_digest: BUILD_DIGEST_EXPRESSION,
  }, 'docker-release.outputs');
  assertJobNeeds(
    dockerRelease,
    [
      'build-and-test',
      'database-tests',
      'release-acceptance',
      'release-candidate-provider-fault-receipt',
    ],
    'docker-release'
  );
}

function assertSafeContainerRetentionJob(job, name) {
  assertExactObject(job.permissions, {}, `${name}.permissions`);
  if (!Array.isArray(job.steps)) {
    throw new Error(`${name}.steps must be an array.`);
  }
  const unsafePackageDeletion = job.steps.some(step =>
    typeof step?.uses === 'string' && step.uses.startsWith('actions/delete-package-versions@')
  );
  if (unsafePackageDeletion) {
    throw new Error(`${name} must not use generic GHCR package-version deletion.`);
  }
}

function assertLatestAliasStep(step) {
  assertExactObject(step.env, {
    IMAGE_DIGEST: DOCKER_RELEASE_DIGEST_EXPRESSION,
  }, 'Verify published latest image alias.env');

  const requiredFragments = [
    'set -euo pipefail',
    'IMAGE="ghcr.io/cloudbyday90/classifarr"',
    'RELEASE_REFERENCE="' + IMAGE_VARIABLE + '@' + IMAGE_DIGEST_VARIABLE + '"',
    'test "$RELEASE_DIGEST" = "$IMAGE_DIGEST"',
    'test "$LATEST_DIGEST" = "$IMAGE_DIGEST"',
    'docker buildx imagetools inspect --raw "$RELEASE_REFERENCE"',
    'docker buildx imagetools inspect "' + IMAGE_VARIABLE + '@' + MANIFEST_DIGEST_VARIABLE + '" >/dev/null',
    'docker pull "' + IMAGE_VARIABLE + ':latest"',
  ];
  if (typeof step.run !== 'string' || requiredFragments.some(fragment => !step.run.includes(fragment))) {
    throw new Error('Verify published latest image alias must validate the index, child manifests, and a clean pull.');
  }
}

function assertConsumerSmokeJob(job) {
  assertTagOnlyJob(job, 'published-digest-consumer-smoke');
  assertJobNeeds(job, ['docker-release'], 'published-digest-consumer-smoke');
  assertExactObject(
    job.permissions,
    EXPECTED_SMOKE_PERMISSIONS,
    'published-digest-consumer-smoke.permissions'
  );
  if (!Array.isArray(job.steps)) {
    throw new Error('published-digest-consumer-smoke.steps must be an array.');
  }

  assertPinnedAction(
    findStep(job.steps, 'Checkout code', 'published-digest-consumer-smoke'),
    CHECKOUT_ACTION,
    'published-digest-consumer-smoke Checkout code'
  );
  assertPinnedAction(
    findStep(job.steps, 'Setup Node.js', 'published-digest-consumer-smoke'),
    SETUP_NODE_ACTION,
    'published-digest-consumer-smoke Setup Node.js'
  );

  const smokeStep = findStep(
    job.steps,
    'Run published digest consumer smoke',
    'published-digest-consumer-smoke'
  );
  assertExactObject(smokeStep.env, {
    GH_TOKEN: GITHUB_TOKEN_EXPRESSION,
    IMAGE_DIGEST: DOCKER_RELEASE_DIGEST_EXPRESSION,
    SOURCE_REVISION: GITHUB_SHA_EXPRESSION,
  }, 'Run published digest consumer smoke.env');
  const requiredFragments = [
    'set -euo pipefail',
    'npm run release:smoke:published-digest --',
    `ghcr.io/cloudbyday90/classifarr@${IMAGE_DIGEST_VARIABLE}`,
    '--source-revision "$SOURCE_REVISION"',
  ];
  if (typeof smokeStep.run !== 'string' ||
    requiredFragments.some(fragment => !smokeStep.run.includes(fragment))) {
    throw new Error('Run published digest consumer smoke must use the published GHCR digest and source revision.');
  }

  assertLatestAliasStep(findStep(
    job.steps,
    'Verify published latest image alias',
    'published-digest-consumer-smoke'
  ));

  assertArtifactStep({
    artifactName: PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME,
    label: 'Upload published digest consumer smoke evidence',
    path: '.tmp/release-consumer-smoke/',
    step: findStep(
      job.steps,
      'Upload published digest consumer smoke evidence',
      'published-digest-consumer-smoke'
    ),
  });
}

function assertPublicationJob(job) {
  assertTagOnlyJob(job, 'release-candidate-publication');
  assertJobNeeds(
    job,
    [
      'docker-release',
      'published-digest-consumer-smoke',
      'release-acceptance',
      'release-candidate-provider-fault-receipt',
    ],
    'release-candidate-publication'
  );
  if (job.environment !== RELEASE_PUBLICATION_ENVIRONMENT) {
    throw new Error(`release-candidate-publication.environment must equal ${RELEASE_PUBLICATION_ENVIRONMENT}.`);
  }
  assertExactObject(
    job.permissions,
    EXPECTED_PUBLICATION_PERMISSIONS,
    'release-candidate-publication.permissions'
  );
  if (!Array.isArray(job.steps)) {
    throw new Error('release-candidate-publication.steps must be an array.');
  }

  assertPinnedAction(
    findStep(job.steps, 'Checkout code', 'release-candidate-publication'),
    CHECKOUT_ACTION,
    'release-candidate-publication Checkout code'
  );
  assertPinnedAction(
    findStep(job.steps, 'Setup Node.js', 'release-candidate-publication'),
    SETUP_NODE_ACTION,
    'release-candidate-publication Setup Node.js'
  );
  const versionStep = findStep(
    job.steps,
    'Check release candidate version contract',
    'release-candidate-publication'
  );
  assertExactObject(versionStep.env, {
    RELEASE_TAG: GITHUB_REF_NAME_EXPRESSION,
  }, 'Check release candidate version contract.env');
  if (typeof versionStep.run !== 'string' || !versionStep.run.includes(
    'npm run release:check-candidate-version -- --tag "$RELEASE_TAG"'
  )) {
    throw new Error('Check release candidate version contract must validate the selected tag.');
  }
  assertDownloadStep({
    artifactName: 'policy-release-acceptance-readout',
    label: 'Download CI release acceptance readout',
    path: '.tmp/release-candidate/ci-readout',
    step: findStep(
      job.steps,
      'Download CI release acceptance readout',
      'release-candidate-publication'
    ),
  });
  assertDownloadStep({
    artifactName: PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME,
    label: 'Download published digest consumer smoke evidence',
    path: '.tmp/release-candidate/consumer-smoke',
    step: findStep(
      job.steps,
      'Download published digest consumer smoke evidence',
      'release-candidate-publication'
    ),
  });
  assertDownloadStep({
    artifactName: AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
    label: 'Download bounded AI provider fault receipt',
    path: PROVIDER_FAULT_RECEIPT_DOWNLOAD_PATH,
    step: findStep(
      job.steps,
      'Download bounded AI provider fault receipt',
      'release-candidate-publication'
    ),
  });

  const assembleStep = findStep(
    job.steps,
    'Assemble release candidate evidence',
    'release-candidate-publication'
  );
  assertExactObject(assembleStep.env, {
    IMAGE_DIGEST: DOCKER_RELEASE_DIGEST_EXPRESSION,
    RELEASE_TAG: GITHUB_REF_NAME_EXPRESSION,
    SOURCE_REVISION: GITHUB_SHA_EXPRESSION,
  }, 'Assemble release candidate evidence.env');
  const requiredAssemblyFragments = [
    'set -euo pipefail',
    'npm run release:assemble-candidate-evidence --',
    '--tag "$RELEASE_TAG"',
    '--source-revision "$SOURCE_REVISION"',
    '--digest "$IMAGE_DIGEST"',
    '--ci-readout .tmp/release-candidate/ci-readout/policy-release-acceptance-readout.json',
    '--consumer-smoke .tmp/release-candidate/consumer-smoke/' +
      `${SOURCE_REVISION_VARIABLE}-published-digest-consumer-smoke.json`,
    '--provider-fault-receipt ' +
      `${PROVIDER_FAULT_RECEIPT_DOWNLOAD_PATH}/ai-provider-fault-compose-receipt.json`,
  ];
  if (typeof assembleStep.run !== 'string' ||
    requiredAssemblyFragments.some(fragment => !assembleStep.run.includes(fragment))) {
    throw new Error('Assemble release candidate evidence must bind the tag, source revision, digest, and all evidence artifacts.');
  }

  assertArtifactStep({
    artifactName: RELEASE_CANDIDATE_ARTIFACT_NAME,
    label: 'Upload release candidate evidence',
    path: '.tmp/release-candidate/',
    step: findStep(
      job.steps,
      'Upload release candidate evidence',
      'release-candidate-publication'
    ),
  });

  const publishStep = findStep(
    job.steps,
    'Create and verify immutable GitHub release',
    'release-candidate-publication'
  );
  assertExactObject(publishStep.env, {
    GH_TOKEN: GITHUB_TOKEN_EXPRESSION,
    RELEASE_TAG: GITHUB_REF_NAME_EXPRESSION,
    SOURCE_REPOSITORY: GITHUB_REPOSITORY_EXPRESSION,
  }, 'Create and verify immutable GitHub release.env');
  const requiredPublicationFragments = [
    'set -euo pipefail',
    'gh release create "$RELEASE_TAG"',
    '--repo "$SOURCE_REPOSITORY"',
    '--verify-tag',
    '--fail-on-no-commits',
    '--draft',
    '--notes-file',
    'gh release edit "$RELEASE_TAG" --repo "$SOURCE_REPOSITORY" --draft=false',
    'gh release verify "$RELEASE_TAG" --repo "$SOURCE_REPOSITORY" --format json',
    'for attempt in 1 2 3 4 5',
    '[[ "$RELEASE_TAG" == *-* ]]',
    '--prerelease',
    '--latest=false',
  ];
  if (typeof publishStep.run !== 'string' ||
    requiredPublicationFragments.some(fragment => !publishStep.run.includes(fragment))) {
    throw new Error('Create and verify immutable GitHub release must use draft assets, remote-tag verification, and release attestation verification.');
  }
}

export function loadWorkflow(workflowPath = DEFAULT_WORKFLOW_PATH) {
  // The production command checks the fixed repository workflow; tests supply a fixture copy.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return load(fs.readFileSync(workflowPath, 'utf8'));
}

export function validateReleaseCandidatePublicationWorkflow(workflow) {
  const jobs = asRecord(asRecord(workflow, 'workflow').jobs, 'workflow.jobs');
  assertDockerReleaseOutput(asRecord(jobs['docker-release'], 'workflow.jobs.docker-release'));
  assertSafeContainerRetentionJob(
    asRecord(jobs['cleanup-old-releases'], 'workflow.jobs.cleanup-old-releases'),
    'cleanup-old-releases'
  );
  assertSafeContainerRetentionJob(
    asRecord(jobs['cleanup-old-releases-manual'], 'workflow.jobs.cleanup-old-releases-manual'),
    'cleanup-old-releases-manual'
  );
  assertConsumerSmokeJob(
    asRecord(jobs['published-digest-consumer-smoke'], 'workflow.jobs.published-digest-consumer-smoke')
  );
  assertPublicationJob(
    asRecord(jobs['release-candidate-publication'], 'workflow.jobs.release-candidate-publication')
  );

  return {
    environment: RELEASE_PUBLICATION_ENVIRONMENT,
    providerFaultReceiptArtifact: AI_PROVIDER_FAULT_RECEIPT_ARTIFACT_NAME,
    releaseArtifact: RELEASE_CANDIDATE_ARTIFACT_NAME,
    smokeArtifact: PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME,
  };
}

function main() {
  try {
    const result = validateReleaseCandidatePublicationWorkflow(loadWorkflow());
    process.stdout.write(
      `Verified release candidate workflow contract for ${result.releaseArtifact}.\n`
    );
  } catch (error) {
    process.stderr.write(`Release candidate workflow contract check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  main();
}
