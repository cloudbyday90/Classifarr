/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  EXPECTED_SIGNER_WORKFLOW,
  loadWorkflow,
  validateContainerImageProvenanceWorkflow,
} from '../../scripts/checkContainerImageProvenanceWorkflow.mjs';

describe('checkContainerImageProvenanceWorkflow', () => {
  test('accepts the checked-in tag-release provenance contract', () => {
    expect(validateContainerImageProvenanceWorkflow(loadWorkflow())).toEqual({
      attestedSubjects: [
        '${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}',
        'docker.io/cloudbyday90/classifarr',
      ],
      digestExpression: '${{ steps.build-and-push-image.outputs.digest }}',
      signerWorkflow: EXPECTED_SIGNER_WORKFLOW,
    });
  });

  test('rejects a workflow that verifies an unexpected signer', () => {
    const workflow = structuredClone(loadWorkflow());
    const verificationStep = workflow.jobs['docker-release'].steps.find(
      step => step.name === 'Verify container image provenance'
    );
    verificationStep.env.EXPECTED_SIGNER_WORKFLOW = 'attacker/example/.github/workflows/ci.yml';

    expect(() => validateContainerImageProvenanceWorkflow(workflow))
      .toThrow('Verify container image provenance.env.EXPECTED_SIGNER_WORKFLOW');
  });

  test('rejects a workflow that grants unneeded provenance metadata permission', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['docker-release'].permissions['artifact-metadata'] = 'write';

    expect(() => validateContainerImageProvenanceWorkflow(workflow))
      .toThrow('docker-release.permissions must grant only');
  });
});
