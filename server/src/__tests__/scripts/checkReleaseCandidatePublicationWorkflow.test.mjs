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

import {
  RELEASE_CANDIDATE_ARTIFACT_NAME,
  RELEASE_PUBLICATION_ENVIRONMENT,
  PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME,
  loadWorkflow,
  validateReleaseCandidatePublicationWorkflow,
} from '../../scripts/checkReleaseCandidatePublicationWorkflow.mjs';

describe('checkReleaseCandidatePublicationWorkflow', () => {
  test('accepts the checked-in digest-only release publication boundary', () => {
    expect(validateReleaseCandidatePublicationWorkflow(loadWorkflow())).toEqual({
      environment: RELEASE_PUBLICATION_ENVIRONMENT,
      releaseArtifact: RELEASE_CANDIDATE_ARTIFACT_NAME,
      smokeArtifact: PUBLISHED_DIGEST_SMOKE_ARTIFACT_NAME,
    });
  });

  test('rejects candidate publication outside the protected release environment', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['release-candidate-publication'].environment = 'production';

    expect(() => validateReleaseCandidatePublicationWorkflow(workflow))
      .toThrow('release-candidate-publication.environment');
  });

  test('rejects a release creator that could synthesize an unverified tag', () => {
    const workflow = structuredClone(loadWorkflow());
    const step = workflow.jobs['release-candidate-publication'].steps.find(
      candidate => candidate.name === 'Create and verify immutable GitHub release'
    );
    step.run = step.run.replace('--verify-tag', '');

    expect(() => validateReleaseCandidatePublicationWorkflow(workflow))
      .toThrow('Create and verify immutable GitHub release must use draft assets');
  });

  test('rejects a smoke job that can write release content', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['published-digest-consumer-smoke'].permissions.contents = 'write';

    expect(() => validateReleaseCandidatePublicationWorkflow(workflow))
      .toThrow('published-digest-consumer-smoke.permissions.contents');
  });

  test('rejects an alias check that omits the clean-pull verification', () => {
    const workflow = structuredClone(loadWorkflow());
    const step = workflow.jobs['published-digest-consumer-smoke'].steps.find(
      candidate => candidate.name === 'Verify published latest image alias'
    );
    step.run = step.run.replace('docker pull "${IMAGE}:latest"', '');

    expect(() => validateReleaseCandidatePublicationWorkflow(workflow))
      .toThrow('Verify published latest image alias must validate');
  });

  test('rejects generic package-version deletion for the multi-platform image', () => {
    const workflow = structuredClone(loadWorkflow());
    const cleanupJob = workflow.jobs['cleanup-old-releases'];
    cleanupJob.steps.unshift({
      name: 'Delete old GHCR packages',
      uses: 'actions/delete-package-versions@e5bc658cc4c965c472efe991f8beea3981499c55',
    });

    expect(() => validateReleaseCandidatePublicationWorkflow(workflow))
      .toThrow('cleanup-old-releases must not use generic GHCR package-version deletion.');
  });
});
