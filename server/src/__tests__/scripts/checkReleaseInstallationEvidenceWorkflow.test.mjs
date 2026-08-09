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
  loadWorkflow,
  validateReleaseInstallationEvidenceWorkflow,
} from '../../scripts/checkReleaseInstallationEvidenceWorkflow.mjs';

describe('checkReleaseInstallationEvidenceWorkflow', () => {
  test('accepts the checked-in tag-restricted installation evidence workflow', () => {
    expect(validateReleaseInstallationEvidenceWorkflow(loadWorkflow())).toEqual({
      artifactName: 'policy-release-installation-evidence',
      environment: 'release-acceptance',
    });
  });

  test('rejects an installation-evidence job outside its acceptance environment', () => {
    const workflow = structuredClone(loadWorkflow());
    workflow.jobs['record-installation-evidence'].environment.name = 'production';

    expect(() => validateReleaseInstallationEvidenceWorkflow(workflow))
      .toThrow('record-installation-evidence.environment.name');
  });

  test('rejects a workflow that accepts a non-tagged dispatch', () => {
    const workflow = structuredClone(loadWorkflow());
    const step = workflow.jobs['record-installation-evidence'].steps.find(
      candidate => candidate.name === 'Verify tagged release context'
    );
    step.run = step.run.replace('"$RELEASE_REF_TYPE" != "tag"', 'false');

    expect(() => validateReleaseInstallationEvidenceWorkflow(workflow))
      .toThrow('Verify tagged release context must reject non-v* refs');
  });

  test('rejects direct shell interpolation of a manual workflow input', () => {
    const workflow = structuredClone(loadWorkflow());
    const step = workflow.jobs['record-installation-evidence'].steps.find(
      candidate => candidate.name === 'Create fingerprint-bound installation evidence'
    );
    step.run = step.run.replace(
      '$DEPLOYMENT_FINGERPRINT',
      '$' + '{{ inputs.deployment_fingerprint }}'
    );

    expect(() => validateReleaseInstallationEvidenceWorkflow(workflow))
      .toThrow('Create fingerprint-bound installation evidence must use quoted environment inputs only');
  });
});
